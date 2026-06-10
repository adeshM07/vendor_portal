"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  MapPin,
  Phone,
  User,
  Loader2,
  CheckCircle2,
  Navigation,
  KeyRound,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime, formatDurationDays, formatShortDateRange } from "@/lib/format";
import {
  acceptBooking,
  approveExtension,
  canVendorActOnExtension,
  enrichBookingDetailWithExtensions,
  fetchVendorBookingDetail,
  rejectBooking,
  rejectExtension,
  updateEquipmentLocation,
  verifyEndOtp,
  verifyStartOtp,
  type VendorBookingDetail,
  type VendorExtension,
} from "@/lib/vendor";
import { ApiRequestError } from "@/lib/api";
import { OtpInput } from "@/components/login/OtpInput";
import { BookingMap } from "./BookingMap";

const BOOKING_OTP_LENGTH = 6;
const MIN_BOOKING_OTP_LENGTH = 4;

interface BookingDetailDrawerProps {
  bookingId: string;
  knownExtensions?: VendorExtension[];
  onClose: () => void;
  onUpdated: () => void;
}

export function BookingDetailDrawer({
  bookingId,
  knownExtensions,
  onClose,
  onUpdated,
}: BookingDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <BookingDetailPanel
        key={bookingId}
        bookingId={bookingId}
        knownExtensions={knownExtensions}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    </div>,
    document.body
  );
}

function BookingDetailPanel({
  bookingId,
  knownExtensions,
  onClose,
  onUpdated,
}: {
  bookingId: string;
  knownExtensions?: VendorExtension[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<VendorBookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState<"start" | "end" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDetail = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setError("");
    try {
      const data = await fetchVendorBookingDetail(bookingId);
      const enriched = await enrichBookingDetailWithExtensions(data, knownExtensions);
      setDetail(enriched);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to load booking details."
      );
    } finally {
      if (showLoading) setIsLoading(false);
      else setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDetail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (!detail?.pending_extension) return;
    const actionable = canVendorActOnExtension(detail.pending_extension, detail.available_actions, {
      inVendorQueue: knownExtensions?.some((ext) => ext.booking_id === bookingId),
      bookingStatus: detail.status,
    });
    if (actionable) return;

    const intervalId = window.setInterval(() => {
      void loadDetail(false);
    }, 8000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, detail?.pending_extension?.id, knownExtensions]);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    setError("");
    try {
      await fn();
      const refreshed = await enrichBookingDetailWithExtensions(
        await fetchVendorBookingDetail(bookingId),
        knownExtensions
      );
      setDetail(refreshed);
      setOtp("");
      setOtpMode(null);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Action failed. Please try again."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = () =>
    runAction("accept", async () => {
      await acceptBooking(bookingId);
    });

  const handleReject = () =>
    runAction("reject", async () => {
      await rejectBooking(bookingId);
    });

  const handleGps = (useSite: boolean) =>
    runAction("gps", async () => {
      if (!detail?.equipment_id) throw new Error("No equipment assigned.");
      const lat = useSite ? detail.site_lat : undefined;
      const lng = useSite ? detail.site_lng : undefined;
      if (lat == null || lng == null) {
        throw new Error("Site coordinates not available.");
      }
      await updateEquipmentLocation(detail.equipment_id, lat, lng);
    });

  const handleGeolocation = () =>
    runAction("gps", async () => {
      if (!detail?.equipment_id) throw new Error("No equipment assigned.");
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      await updateEquipmentLocation(
        detail.equipment_id,
        pos.coords.latitude,
        pos.coords.longitude
      );
    });

  const openOtpMode = (target: "start" | "end") => {
    setOtp("");
    setError("");
    setOtpMode(target);
  };

  const closeOtpMode = () => {
    setOtp("");
    setError("");
    setOtpMode(null);
  };

  const handleVerifyOtp = () => {
    if (otp.length < MIN_BOOKING_OTP_LENGTH) {
      setError(`Enter the ${MIN_BOOKING_OTP_LENGTH}-digit OTP from the customer's app.`);
      return;
    }
    if (otpMode === "start") {
      return runAction("otp", async () => {
        await verifyStartOtp(bookingId, otp.trim());
      });
    }
    if (otpMode === "end") {
      return runAction("otp", async () => {
        await verifyEndOtp(bookingId, otp.trim());
      });
    }
    setError("Choose whether to verify the start or end OTP.");
  };

  const actions = detail?.available_actions;
  const pendingExtension = detail?.pending_extension;
  const inVendorQueue = knownExtensions?.some(
    (ext) =>
      ext.booking_id === bookingId &&
      (!pendingExtension?.id || ext.id === pendingExtension.id)
  );
  const canActOnExtension = canVendorActOnExtension(pendingExtension, actions, {
    inVendorQueue,
    bookingStatus: detail?.status,
  });

  return (
    <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-gray-200 bg-white shadow-2xl animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Upcoming Booking</h3>
          {detail && (
            <p className="font-mono text-[11px] text-gray-400">
              {detail.booking_number}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void loadDetail(false)}
            disabled={isRefreshing || isLoading}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:opacity-40"
            aria-label="Refresh booking"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  {detail.sku?.name ?? "Equipment"}
                </h4>
                <p className="text-xs text-gray-500">
                  {formatShortDateRange(detail.scheduled_start, detail.scheduled_end)} ·{" "}
                  {formatDurationDays(detail.scheduled_start, detail.scheduled_end)}
                </p>
              </div>
              <StatusBadge status={detail.status} />
            </div>

            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(detail.total_amount)}
            </p>

            {detail.site_lat != null && detail.site_lng != null ? (
              <BookingMap
                lat={detail.site_lat}
                lng={detail.site_lng}
                address={detail.site_address}
              />
            ) : detail.site_address ? (
              <Section icon={<MapPin className="h-4 w-4" />} title="Booking For">
                <p className="text-sm text-gray-600">{detail.site_address}</p>
              </Section>
            ) : null}

            <div className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm">
              <Row label="Amount" value={formatCurrency(detail.total_amount)} />
              <Row
                label="Scheduled"
                value={`${formatDateTime(detail.scheduled_start)} → ${formatDateTime(detail.scheduled_end)}`}
              />
              {detail.work_type && (
                <Row label="What is the Purpose?" value={detail.work_type} />
              )}
              {detail.pickup_address && (
                <Row label="Pickup" value={detail.pickup_address} />
              )}
              {detail.delivery_address && (
                <Row label="Delivery" value={detail.delivery_address} />
              )}
            </div>

            {(detail.sender_name || detail.receiver_name) && (
              <Section icon={<User className="h-4 w-4" />} title="Contacts">
                {detail.sender_name && (
                  <ContactRow
                    label="Sender"
                    name={detail.sender_name}
                    phone={detail.sender_contact}
                  />
                )}
                {detail.receiver_name && (
                  <ContactRow
                    label="Receiver"
                    name={detail.receiver_name}
                    phone={detail.receiver_contact}
                  />
                )}
              </Section>
            )}

            {pendingExtension && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                  Extension Request
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  +{pendingExtension.extension_hours}h ·{" "}
                  {formatCurrency(pendingExtension.extension_amount)}
                </p>
                {canActOnExtension ? (
                  <p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Payment confirmed — awaiting your approval
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-orange-700">
                    Waiting for customer to complete extension payment
                  </p>
                )}
                {pendingExtension.response_deadline && (
                  <p className="mt-1 text-xs text-gray-500">
                    Respond by {formatDateTime(pendingExtension.response_deadline)}
                  </p>
                )}
                {canActOnExtension && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={actionLoading === "ext-approve"}
                      onClick={() =>
                        runAction("ext-approve", async () => {
                          await approveExtension(
                            pendingExtension.id,
                            pendingExtension.payment_method === "cod" ? "cod" : "juspay"
                          );
                        })
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40"
                    >
                      {actionLoading === "ext-approve" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      Accept Extension
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === "ext-reject"}
                      onClick={() =>
                        runAction("ext-reject", async () => {
                          await rejectExtension(pendingExtension.id);
                        })
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
                    >
                      {actionLoading === "ext-reject" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      Reject Extension
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Actions
              </p>

              {(actions?.can_accept || actions?.can_reject) && (
                <div className="flex gap-2">
                  {actions?.can_accept && (
                    <ActionButton
                      label="Accept Booking"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      variant="emerald"
                      loading={actionLoading === "accept"}
                      onClick={handleAccept}
                      className="flex-1"
                    />
                  )}
                  {(actions?.can_reject ?? actions?.can_accept) && (
                    <ActionButton
                      label="Reject Booking"
                      icon={<XCircle className="h-4 w-4" />}
                      variant="red"
                      loading={actionLoading === "reject"}
                      onClick={handleReject}
                      className="flex-1"
                    />
                  )}
                </div>
              )}

              {actions?.can_update_location && detail.equipment_id && (
                <div className="space-y-2">
                  <ActionButton
                    label="Send Site GPS (auto-arrive)"
                    icon={<Navigation className="h-4 w-4" />}
                    variant="blue"
                    loading={actionLoading === "gps"}
                    onClick={() => handleGps(true)}
                    disabled={detail.site_lat == null}
                  />
                  <ActionButton
                    label="Use My Location"
                    icon={<MapPin className="h-4 w-4" />}
                    variant="zinc"
                    loading={actionLoading === "gps"}
                    onClick={handleGeolocation}
                  />
                </div>
              )}

              {actions?.can_verify_start_otp && (
                <OtpBlock
                  mode={otpMode}
                  onOpen={() => openOtpMode("start")}
                  onClose={closeOtpMode}
                  target="start"
                  otp={otp}
                  setOtp={setOtp}
                  onSubmit={handleVerifyOtp}
                  loading={actionLoading === "otp"}
                  error={otpMode === "start" ? error : ""}
                  onClearError={() => setError("")}
                />
              )}

              {actions?.can_verify_end_otp && (
                <OtpBlock
                  mode={otpMode}
                  onOpen={() => openOtpMode("end")}
                  onClose={closeOtpMode}
                  target="end"
                  otp={otp}
                  setOtp={setOtp}
                  onSubmit={handleVerifyOtp}
                  loading={actionLoading === "otp"}
                  error={otpMode === "end" ? error : ""}
                  onClearError={() => setError("")}
                />
              )}

              {!actions?.can_accept &&
                !actions?.can_reject &&
                !actions?.can_update_location &&
                !actions?.can_verify_start_otp &&
                !actions?.can_verify_end_otp && (
                  <p className="text-xs text-gray-400">
                    No actions available for this booking status.
                  </p>
                )}
            </div>
          </div>
        ) : null}

        {error && !otpMode && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function ContactRow({
  label,
  name,
  phone,
}: {
  label: string;
  name: string;
  phone: string | null;
}) {
  return (
    <div className="mt-2 text-sm">
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium text-gray-900">{name}</span>
      {phone && (
        <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Phone className="h-3 w-3" />
          {phone}
        </span>
      )}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  variant,
  loading,
  onClick,
  disabled,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  variant: "emerald" | "blue" | "zinc" | "red";
  loading: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    zinc: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
    red: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
  };

  return (
    <button
      type="button"
      disabled={loading || disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className ?? ""}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function OtpBlock({
  mode,
  onOpen,
  onClose,
  target,
  otp,
  setOtp,
  onSubmit,
  loading,
  error,
  onClearError,
}: {
  mode: "start" | "end" | null;
  onOpen: () => void;
  onClose: () => void;
  target: "start" | "end";
  otp: string;
  setOtp: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error?: string;
  onClearError?: () => void;
}) {
  const isOpen = mode === target;
  const label = target === "start" ? "Start Task" : "Verify End OTP";
  const canSubmit = otp.length >= MIN_BOOKING_OTP_LENGTH && !loading;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-100"
      >
        <KeyRound className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <p className="text-xs text-gray-500">
        Enter OTP from customer&apos;s app ({MIN_BOOKING_OTP_LENGTH}–{BOOKING_OTP_LENGTH} digits)
      </p>
      <OtpInput
        length={BOOKING_OTP_LENGTH}
        compact
        value={otp}
        onChange={(value) => {
          setOtp(value);
          onClearError?.();
        }}
        disabled={loading}
        onEnter={canSubmit ? onSubmit : undefined}
      />
      {error && (
        <p className="text-center text-xs text-red-600">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-200 py-2 text-xs text-gray-500 hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Confirm
        </button>
      </div>
    </form>
  );
}

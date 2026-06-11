"use client";

import { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  MapPin,
  Navigation,
  XCircle,
} from "lucide-react";
import { OtpInput } from "@/components/login/OtpInput";
import { ApiRequestError } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  acceptBooking,
  approveExtension,
  canVendorActOnExtension,
  enrichBookingDetailWithExtensions,
  fetchVendorBookingDetail,
  fetchVendorExtensions,
  isExtensionDecisionComplete,
  rejectBooking,
  rejectExtension,
  updateEquipmentLocation,
  verifyEndOtp,
  verifyStartOtp,
  type VendorBookingDetail,
  type VendorExtension,
} from "@/lib/vendor";

const BOOKING_OTP_LENGTH = 6;
const MIN_BOOKING_OTP_LENGTH = 4;

interface BookingActionsPanelProps {
  bookingId: string;
  detail: VendorBookingDetail;
  knownExtensions?: VendorExtension[];
  onUpdated: (detail: VendorBookingDetail) => void;
}

export function BookingActionsPanel({
  bookingId,
  detail,
  knownExtensions,
  onUpdated,
}: BookingActionsPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState<"start" | "end" | null>(null);

  const actions = detail.available_actions;
  const pendingExtension = detail.pending_extension;
  const inVendorQueue = knownExtensions?.some(
    (ext) =>
      ext.booking_id === bookingId &&
      (!pendingExtension?.id || ext.id === pendingExtension.id)
  );
  const canActOnExtension = canVendorActOnExtension(pendingExtension, actions, {
    inVendorQueue,
    bookingStatus: detail.status,
  });
  const extensionResolved = isExtensionDecisionComplete(
    detail.status,
    pendingExtension?.status
  );

  const refreshDetail = async () => {
    const [{ items }, data] = await Promise.all([
      fetchVendorExtensions("pending", 1, 50),
      fetchVendorBookingDetail(bookingId),
    ]);
    const refreshed = await enrichBookingDetailWithExtensions(data, items);
    onUpdated(refreshed);
    return refreshed;
  };

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    setError("");
    try {
      await fn();
      const refreshed = await refreshDetail();
      setOtp("");
      setOtpMode(null);
      onUpdated(refreshed);
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
      if (!detail.equipment_id) throw new Error("No equipment assigned.");
      const lat = useSite ? detail.site_lat : undefined;
      const lng = useSite ? detail.site_lng : undefined;
      if (lat == null || lng == null) {
        throw new Error("Site coordinates not available.");
      }
      await updateEquipmentLocation(detail.equipment_id, lat, lng);
    });

  const handleGeolocation = () =>
    runAction("gps", async () => {
      if (!detail.equipment_id) throw new Error("No equipment assigned.");
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

  const hasBookingActions =
    actions?.can_accept ||
    actions?.can_reject ||
    actions?.can_update_location ||
    actions?.can_verify_start_otp ||
    actions?.can_verify_end_otp;

  if (!hasBookingActions && !pendingExtension) return null;

  return (
    <div className="space-y-4">
      {pendingExtension && !extensionResolved && (
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
          {pendingExtension.response_deadline && canActOnExtension && (
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
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-40"
              >
                {actionLoading === "ext-approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-40"
              >
                {actionLoading === "ext-reject" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Reject Extension
              </button>
            </div>
          )}
        </div>
      )}

      {hasBookingActions && (
        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Vendor Actions
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
        </div>
      )}

      {error && !otpMode && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
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
  const label = target === "start" ? "Start Task (Enter OTP)" : "Verify End OTP";
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
        Enter OTP from customer&apos;s app ({MIN_BOOKING_OTP_LENGTH}–{BOOKING_OTP_LENGTH}{" "}
        digits)
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
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
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

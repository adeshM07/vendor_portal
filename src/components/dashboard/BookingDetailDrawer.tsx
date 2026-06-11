"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MapPin, Phone, User, Loader2, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime, formatDurationDays, formatShortDateRange } from "@/lib/format";
import {
  canVendorActOnExtension,
  enrichBookingDetailWithExtensions,
  fetchVendorBookingDetail,
  isExtensionDecisionComplete,
  type VendorBookingDetail,
  type VendorExtension,
} from "@/lib/vendor";
import { ApiRequestError } from "@/lib/api";
import { BookingActionsPanel } from "./BookingActionsPanel";
import { BookingMap } from "./BookingMap";

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
  const [error, setError] = useState("");
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
    if (
      isExtensionDecisionComplete(detail.status, detail.pending_extension.status)
    ) {
      return;
    }

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
  }, [bookingId, detail?.pending_extension?.id, detail?.status, knownExtensions]);

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

            <BookingActionsPanel
              bookingId={bookingId}
              detail={detail}
              knownExtensions={knownExtensions}
              onUpdated={(updated) => {
                setDetail(updated);
                onUpdated();
              }}
            />
          </div>
        ) : null}

        {error && (
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


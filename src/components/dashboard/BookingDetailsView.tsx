"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ScrollText,
  User,
  XCircle,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { BookingStatusPill } from "./BookingStatusPill";
import { BookingMap } from "./BookingMap";
import {
  buildTimeline,
  displayValue,
  formatCheckIn,
  formatCheckOut,
  formatCreatedDate,
  formatExtensionDetailsForBooking,
  getExtensionDisplayStatus,
  hasExtensionInfo,
  formatTotalDuration,
  getPaymentStatus,
  getPropertyName,
  getSiteImageUrls,
  isCancelled,
} from "@/lib/booking-details";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ApiRequestError } from "@/lib/api";
import { BookingActionsPanel } from "./BookingActionsPanel";
import { LiveTrackingCard } from "./LiveTrackingCard";
import { isLiveTrackingVisible } from "@/lib/live-tracking";
import {
  canVendorActOnExtension,
  enrichBookingDetailWithExtensions,
  fetchVendorBookingDetail,
  fetchVendorExtensions,
  isExtensionDecisionComplete,
  type VendorBookingDetail,
  type VendorExtension,
} from "@/lib/vendor";

interface BookingDetailsViewProps {
  bookingId: string;
  returnHref?: string;
  /** Local dev only — force Live Tracking on completed bookings for UI testing. */
  previewLiveTracking?: boolean;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 sm:max-w-[60%] sm:text-right">
        {value}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} icon={icon} />
      <div className="px-5 pb-5">{children}</div>
    </Card>
  );
}

export function BookingDetailsView({
  bookingId,
  returnHref = "/dashboard",
  previewLiveTracking = false,
}: BookingDetailsViewProps) {
  const [detail, setDetail] = useState<VendorBookingDetail | null>(null);
  const [knownExtensions, setKnownExtensions] = useState<VendorExtension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDetail = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError("");
    try {
      const [{ items }, data] = await Promise.all([
        fetchVendorExtensions("pending", 1, 50),
        fetchVendorBookingDetail(bookingId),
      ]);
      setKnownExtensions(items);
      const enriched = await enrichBookingDetailWithExtensions(data, items);
      setDetail(enriched);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to load booking details."
      );
    } finally {
      if (showLoading) setIsLoading(false);
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

    const actionable = canVendorActOnExtension(
      detail.pending_extension,
      detail.available_actions,
      {
        inVendorQueue: knownExtensions.some((ext) => ext.booking_id === bookingId),
        bookingStatus: detail.status,
      }
    );
    if (actionable) return;

    const intervalId = window.setInterval(() => {
      void loadDetail(false);
    }, 8000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, detail?.pending_extension?.id, detail?.status, knownExtensions]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-gray-500">Loading booking details…</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          href={returnHref}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-700">
            {error || "Booking not found."}
          </p>
        </div>
      </div>
    );
  }

  const timeline = buildTimeline(detail);
  const siteImages = getSiteImageUrls(detail);
  const showCancellation = isCancelled(detail);

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-5 px-4 pb-10 pt-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={returnHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bookings
        </Link>
        <BookingStatusPill status={detail.status} />
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
          Booking Details
        </h1>
        <p className="mt-1 font-mono text-xs text-gray-400">
          {detail.booking_number}
        </p>
      </div>

      <BookingActionsPanel
        bookingId={bookingId}
        detail={detail}
        knownExtensions={knownExtensions}
        onUpdated={(updated) => {
          setDetail(updated);
          void fetchVendorExtensions("pending", 1, 50).then(({ items }) =>
            setKnownExtensions(items)
          );
        }}
      />

      {/* 1. Booking Summary */}
      <SectionCard
        title="Booking Summary"
        icon={<ScrollText className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow label="Booking ID" value={displayValue(detail.booking_number)} />
        <DetailRow
          label="Booking Status"
          value={displayValue(detail.status.replace(/_/g, " "))}
        />
        <DetailRow label="Booking Created Date" value={formatCreatedDate(detail)} />
      </SectionCard>

      {/* 2. Customer Information */}
      <SectionCard
        title="Customer Information"
        icon={<User className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow label="Sender Name" value={displayValue(detail.sender_name)} />
        <DetailRow label="Sender Contact" value={displayValue(detail.sender_contact)} />
        <DetailRow label="Receiver Name" value={displayValue(detail.receiver_name)} />
        <DetailRow label="Receiver Contact" value={displayValue(detail.receiver_contact)} />
      </SectionCard>

      {/* 3. Property/Item Information */}
      <SectionCard
        title="Equipment & Site Details"
        icon={<Package className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow
          label="Property / Item Name"
          value={displayValue(getPropertyName(detail))}
        />
        <DetailRow label="Type of Work" value={displayValue(detail.work_type)} />
        <DetailRow label="Type of Load" value={displayValue(detail.type_of_load)} />
        <DetailRow label="Type of Soil" value={displayValue(detail.type_of_soil)} />
        {detail.pickup_address && (
          <DetailRow label="Pickup Address" value={displayValue(detail.pickup_address)} />
        )}
        {detail.delivery_address && (
          <DetailRow label="Delivery Address" value={displayValue(detail.delivery_address)} />
        )}
        {siteImages.length > 0 && (
          <div className="border-t border-gray-50 pt-4">
            <p className="mb-3 text-xs font-medium text-gray-500">Site Images</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {siteImages.map((url, index) => (
                <a
                  key={`${url}-${index}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Site image ${index + 1}`}
                    className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
        {detail.site_lat != null && detail.site_lng != null && (
          <div className="mt-4">
            <BookingMap
              lat={detail.site_lat}
              lng={detail.site_lng}
              address={detail.site_address}
            />
          </div>
        )}
      </SectionCard>

      {isLiveTrackingVisible(detail.status, { preview: previewLiveTracking }) && (
        <LiveTrackingCard
          bookingId={bookingId}
          bookingStatus={detail.status}
          siteLat={detail.site_lat}
          siteLng={detail.site_lng}
          siteAddress={detail.site_address}
        />
      )}

      {/* 4. Booking Information */}
      <SectionCard
        title="Booking Information"
        icon={<Calendar className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow label="Check-in Date" value={formatCheckIn(detail)} />
        <DetailRow label="Check-out Date" value={formatCheckOut(detail)} />
        <DetailRow label="Total Duration" value={formatTotalDuration(detail)} />
        {detail.actual_start && (
          <DetailRow
            label="Actual Start"
            value={formatDateTime(detail.actual_start)}
          />
        )}
        {detail.actual_end && (
          <DetailRow label="Actual End" value={formatDateTime(detail.actual_end)} />
        )}
      </SectionCard>

      {/* 5. Payment Information */}
      <SectionCard
        title="Payment Information"
        icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow
          label="Booking Amount"
          value={formatCurrency(detail.total_amount)}
        />
        <DetailRow
          label="Payment Status"
          value={displayValue(getPaymentStatus(detail))}
        />
      </SectionCard>

      {/* 6. Extension Information */}
      <SectionCard
        title="Extension Information"
        description={
          hasExtensionInfo(detail)
            ? isExtensionDecisionComplete(
                detail.status,
                detail.pending_extension?.status
              )
              ? "Extension on this booking"
              : "Active extension request on this booking"
            : "No extension requests"
        }
        icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
      >
        {detail.pending_extension ? (
          <>
            <DetailRow
              label="Extension Request Details"
              value={formatExtensionDetailsForBooking(detail)}
            />
            <DetailRow
              label="Extension Status"
              value={displayValue(getExtensionDisplayStatus(detail))}
            />
            {detail.pending_extension.approved_at && (
              <DetailRow
                label="Approved At"
                value={formatDateTime(detail.pending_extension.approved_at)}
              />
            )}
            {detail.pending_extension.response_deadline &&
              !isExtensionDecisionComplete(
                detail.status,
                detail.pending_extension.status
              ) && (
              <DetailRow
                label="Response Deadline"
                value={formatDateTime(detail.pending_extension.response_deadline)}
              />
            )}
          </>
        ) : detail.status === "extended" ? (
          <DetailRow label="Extension Status" value="Approved" />
        ) : (
          <p className="py-2 text-sm text-gray-500">No extension requests for this booking.</p>
        )}
      </SectionCard>

      {/* 7. Cancellation Information */}
      {showCancellation && (
        <SectionCard
          title="Cancellation Information"
          icon={<XCircle className="h-4 w-4" strokeWidth={1.5} />}
        >
          <DetailRow
            label="Cancellation Reason"
            value={displayValue(detail.cancellation_reason)}
          />
          <DetailRow
            label="Cancelled At"
            value={
              detail.cancelled_at
                ? formatDateTime(detail.cancelled_at)
                : "—"
            }
          />
        </SectionCard>
      )}

      {/* 8. Booking Timeline */}
      <SectionCard
        title="Booking Timeline"
        icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />}
      >
        <ol className="relative space-y-0">
          {timeline.map((event, index) => (
            <li key={event.label} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    event.completed
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-gray-50 text-gray-400"
                  }`}
                >
                  {index + 1}
                </div>
                {index < timeline.length - 1 && (
                  <div
                    className={`mt-1 w-0.5 flex-1 ${
                      event.completed ? "bg-emerald-200" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm font-semibold text-gray-900">{event.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {event.timestamp
                    ? formatDateTime(event.timestamp)
                    : (event.unavailableLabel ?? "Not available")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Package,
  ScrollText,
  StickyNote,
  User,
  XCircle,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { BookingStatusPill } from "./BookingStatusPill";
import { BookingMap } from "./BookingMap";
import {
  buildTimeline,
  collectDocuments,
  displayValue,
  formatCheckIn,
  formatCheckOut,
  formatCreatedDate,
  formatExtensionDetails,
  formatTotalDuration,
  getCustomerEmail,
  getCustomerName,
  getCustomerPhone,
  getLocation,
  getPaymentStatus,
  getPropertyName,
  isCancelled,
} from "@/lib/booking-details";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ApiRequestError } from "@/lib/api";
import {
  enrichBookingDetailWithExtensions,
  fetchVendorBookingDetail,
  type VendorBookingDetail,
} from "@/lib/vendor";

interface BookingDetailsViewProps {
  bookingId: string;
  returnHref?: string;
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
}: BookingDetailsViewProps) {
  const [detail, setDetail] = useState<VendorBookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const data = await fetchVendorBookingDetail(bookingId);
        const enriched = await enrichBookingDetailWithExtensions(data);
        if (!cancelled) setDetail(enriched);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : "Failed to load booking details."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

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
  const documents = collectDocuments(detail);
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
        <DetailRow label="Customer Name" value={displayValue(getCustomerName(detail))} />
        <DetailRow
          label="Customer Contact Number"
          value={displayValue(getCustomerPhone(detail))}
        />
        <DetailRow label="Customer Email" value={displayValue(getCustomerEmail(detail))} />
        {(detail.sender_name || detail.receiver_name) && (
          <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3">
            {detail.sender_name && (
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-500">Sender: </span>
                {detail.sender_name}
                {detail.sender_contact ? ` · ${detail.sender_contact}` : ""}
              </p>
            )}
            {detail.receiver_name && (
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-500">Receiver: </span>
                {detail.receiver_name}
                {detail.receiver_contact ? ` · ${detail.receiver_contact}` : ""}
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* 3. Property/Item Information */}
      <SectionCard
        title="Property / Item Information"
        icon={<Package className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow
          label="Property / Item Name"
          value={displayValue(getPropertyName(detail))}
        />
        <DetailRow label="Location" value={displayValue(getLocation(detail))} />
        {detail.work_type && (
          <DetailRow label="Purpose" value={displayValue(detail.work_type)} />
        )}
        {detail.pickup_address && (
          <DetailRow label="Pickup Address" value={displayValue(detail.pickup_address)} />
        )}
        {detail.delivery_address && (
          <DetailRow label="Delivery Address" value={displayValue(detail.delivery_address)} />
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
          label="Security Deposit"
          value={
            detail.security_deposit != null
              ? formatCurrency(detail.security_deposit)
              : "—"
          }
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
          detail.pending_extension
            ? "Active extension request on this booking"
            : "No extension requests"
        }
        icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
      >
        {detail.pending_extension ? (
          <>
            <DetailRow
              label="Extension Request Details"
              value={formatExtensionDetails(detail.pending_extension)}
            />
            <DetailRow
              label="Extension Status"
              value={displayValue(detail.pending_extension.status)}
            />
            {detail.pending_extension.response_deadline && (
              <DetailRow
                label="Response Deadline"
                value={formatDateTime(detail.pending_extension.response_deadline)}
              />
            )}
          </>
        ) : (
          <p className="py-2 text-sm text-gray-500">No extension requests for this booking.</p>
        )}
      </SectionCard>

      {/* 7. Vendor Notes */}
      <SectionCard
        title="Vendor Notes"
        icon={<StickyNote className="h-4 w-4" strokeWidth={1.5} />}
      >
        {detail.vendor_notes ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {detail.vendor_notes}
          </p>
        ) : (
          <p className="text-sm text-gray-500">No vendor notes available.</p>
        )}
      </SectionCard>

      {/* 8. Cancellation Information */}
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

      {/* 9. Booking Timeline */}
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
                  {event.timestamp ? formatDateTime(event.timestamp) : "Not available"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      {/* 10. Documents & Attachments */}
      <SectionCard
        title="Documents & Attachments"
        icon={<FileText className="h-4 w-4" strokeWidth={1.5} />}
      >
        {documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={`${doc.type ?? "doc"}-${doc.url}`}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-amber-700 transition hover:border-amber-200 hover:bg-amber-50"
                >
                  <span>{doc.name}</span>
                  <span className="text-xs text-gray-400">Open</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No documents or attachments available for this booking.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

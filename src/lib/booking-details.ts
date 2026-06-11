import {
  formatDate,
  formatDateTime,
  formatDurationDays,
  formatStatusLabel,
} from "@/lib/format";
import type { PendingExtension, VendorBookingDetail } from "@/lib/vendor";

export interface BookingDocument {
  name: string;
  url: string;
  type?: string;
}

export interface TimelineEvent {
  label: string;
  timestamp: string | null;
  completed: boolean;
}

export function displayValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function getCustomerName(detail: VendorBookingDetail): string | null {
  return (
    detail.customer_name ??
    detail.sender_name ??
    detail.receiver_name ??
    null
  );
}

export function getCustomerPhone(detail: VendorBookingDetail): string | null {
  return (
    detail.customer_phone ??
    detail.customer_contact ??
    detail.sender_contact ??
    detail.receiver_contact ??
    null
  );
}

export function getCustomerEmail(detail: VendorBookingDetail): string | null {
  return detail.customer_email ?? null;
}

export function getPropertyName(detail: VendorBookingDetail): string | null {
  return detail.sku?.name ?? null;
}

export function getLocation(detail: VendorBookingDetail): string | null {
  return (
    detail.site_address ??
    detail.delivery_address ??
    detail.pickup_address ??
    null
  );
}

export function getPaymentStatus(detail: VendorBookingDetail): string | null {
  if (detail.payment_status) return formatStatusLabel(detail.payment_status);
  if (detail.total_amount > 0) return "Paid";
  return null;
}

export function isCancelled(detail: VendorBookingDetail): boolean {
  return detail.status.toLowerCase().includes("cancel");
}

export function buildTimeline(detail: VendorBookingDetail): TimelineEvent[] {
  const extensionRequestedAt =
    detail.pending_extension?.response_deadline ?? null;
  const completedOrCancelled = isCancelled(detail)
    ? detail.cancelled_at ?? detail.actual_end
    : detail.actual_end;

  return [
    {
      label: "Booking Created",
      timestamp: detail.created_at || null,
      completed: Boolean(detail.created_at),
    },
    {
      label: "Booking Confirmed",
      timestamp: detail.confirmed_at ?? null,
      completed: Boolean(detail.confirmed_at) || !["pending", "available"].includes(detail.status),
    },
    {
      label: "Booking Started",
      timestamp: detail.actual_start ?? null,
      completed: Boolean(detail.actual_start),
    },
    {
      label: "Extension Requested",
      timestamp: extensionRequestedAt,
      completed: Boolean(detail.pending_extension),
    },
    {
      label: isCancelled(detail) ? "Cancelled" : "Completed",
      timestamp: completedOrCancelled ?? null,
      completed: Boolean(completedOrCancelled) || detail.status === "ended",
    },
  ];
}

export function collectDocuments(detail: VendorBookingDetail): BookingDocument[] {
  const docs: BookingDocument[] = [];

  if (Array.isArray(detail.documents)) {
    for (const doc of detail.documents) {
      if (doc?.url) docs.push(doc);
    }
  }

  if (detail.agreement_url) {
    docs.push({ name: "Booking Agreement", url: detail.agreement_url, type: "agreement" });
  }
  if (detail.invoice_url) {
    docs.push({ name: "Invoice", url: detail.invoice_url, type: "invoice" });
  }
  if (detail.receipt_url) {
    docs.push({ name: "Receipt", url: detail.receipt_url, type: "receipt" });
  }

  return docs;
}

export function formatExtensionDetails(ext: PendingExtension): string {
  const parts = [
    `+${ext.extension_hours} hour${ext.extension_hours === 1 ? "" : "s"}`,
    `Amount: ₹${ext.extension_amount.toLocaleString("en-IN")}`,
    `Status: ${formatStatusLabel(ext.status)}`,
  ];
  if (ext.payment_method) parts.push(`Payment: ${ext.payment_method.toUpperCase()}`);
  if (ext.paid_at) parts.push(`Paid: ${formatDateTime(ext.paid_at)}`);
  return parts.join(" · ");
}

export function formatCheckIn(detail: VendorBookingDetail): string {
  return detail.scheduled_start ? formatDateTime(detail.scheduled_start) : "—";
}

export function formatCheckOut(detail: VendorBookingDetail): string {
  return detail.scheduled_end ? formatDateTime(detail.scheduled_end) : "—";
}

export function formatTotalDuration(detail: VendorBookingDetail): string {
  if (!detail.scheduled_start || !detail.scheduled_end) return "—";
  return formatDurationDays(detail.scheduled_start, detail.scheduled_end);
}

export function formatCreatedDate(detail: VendorBookingDetail): string {
  return detail.created_at ? formatDate(detail.created_at) : "—";
}

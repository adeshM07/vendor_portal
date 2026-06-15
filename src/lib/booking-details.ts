import {
  formatDate,
  formatDateTime,
  formatDurationDays,
  formatStatusLabel,
} from "@/lib/format";
import {
  collectSiteImageUrls,
  isExtensionDecisionComplete,
  resolveSiteImageUrl,
  type PendingExtension,
  type VendorBookingDetail,
} from "@/lib/vendor";

export interface TimelineEvent {
  label: string;
  timestamp: string | null;
  completed: boolean;
  /** Shown when completed but the API did not return a timestamp. */
  unavailableLabel?: string;
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
  const ext = detail.pending_extension;
  const extensionComplete = isExtensionDecisionComplete(detail.status, ext?.status);
  const hasExtension = Boolean(ext) || detail.status === "extended";
  const extensionTimestamp = extensionComplete
    ? ext?.approved_at ?? ext?.paid_at ?? ext?.created_at ?? null
    : ext?.created_at ?? ext?.paid_at ?? ext?.response_deadline ?? null;
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
      label: extensionComplete ? "Extension Approved" : "Extension Requested",
      timestamp: extensionTimestamp,
      completed:
        hasExtension &&
        (extensionComplete ||
          Boolean(ext?.created_at || ext?.paid_at || ext?.response_deadline)),
      unavailableLabel: extensionComplete ? "Approved" : undefined,
    },
    {
      label: isCancelled(detail) ? "Cancelled" : "Completed",
      timestamp: completedOrCancelled ?? null,
      completed: Boolean(completedOrCancelled) || detail.status === "ended",
    },
  ];
}

/** Collect site image URLs from normalized booking detail (and any extra API fields). */
export function getSiteImageUrls(detail: VendorBookingDetail): string[] {
  const fromDetail = collectSiteImageUrls(detail as unknown as Record<string, unknown>);
  if (fromDetail.length > 0) return fromDetail;

  const urls = new Set<string>();
  if (detail.site_image_url) urls.add(resolveSiteImageUrl(detail.site_image_url));
  if (detail.site_image_urls) {
    for (const url of detail.site_image_urls) {
      if (url) urls.add(resolveSiteImageUrl(url));
    }
  }
  return [...urls];
}

export function getExtensionDisplayStatus(detail: VendorBookingDetail): string {
  if (detail.status === "extended") return "approved";
  const extStatus = detail.pending_extension?.status;
  if (!extStatus) return "—";
  if (isExtensionDecisionComplete(detail.status, extStatus)) {
    return detail.status === "extended" ? "approved" : extStatus;
  }
  return extStatus;
}

export function hasExtensionInfo(detail: VendorBookingDetail): boolean {
  return Boolean(detail.pending_extension) || detail.status === "extended";
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

export function formatExtensionDetailsForBooking(detail: VendorBookingDetail): string {
  if (!detail.pending_extension) return "—";
  const ext = detail.pending_extension;
  const parts = [
    `+${ext.extension_hours} hour${ext.extension_hours === 1 ? "" : "s"}`,
    `Amount: ₹${ext.extension_amount.toLocaleString("en-IN")}`,
    `Status: ${formatStatusLabel(getExtensionDisplayStatus(detail))}`,
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

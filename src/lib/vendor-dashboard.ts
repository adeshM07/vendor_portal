import {
  fetchVendorBookings,
  fetchVendorExtensions,
  fetchVendorMe,
  type BookingTab,
  type PaginationMeta,
  type VendorBookingListItem,
  type VendorExtension,
  type VendorProfile,
} from "@/lib/vendor";

export interface VendorDashboardSnapshot {
  profile: VendorProfile | null;
  bookings: VendorBookingListItem[];
  counts: { available: number; active: number; completed: number };
  pendingExtensions: VendorExtension[];
  completedBookings: VendorBookingListItem[];
}

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  per_page: 50,
  total_items: 0,
  total_pages: 0,
};

function countFrom(
  result: PromiseSettledResult<{ items: VendorBookingListItem[]; pagination: PaginationMeta }>
): number {
  return result.status === "fulfilled" ? result.value.pagination.total_items : 0;
}

function listFrom(
  result: PromiseSettledResult<{ items: VendorBookingListItem[]; pagination: PaginationMeta }>
): VendorBookingListItem[] {
  return result.status === "fulfilled" ? result.value.items : [];
}

function extensionsFrom(
  result: PromiseSettledResult<{ items: VendorExtension[]; pagination: PaginationMeta }>
): VendorExtension[] {
  return result.status === "fulfilled" ? result.value.items : [];
}

/** Resilient parallel fetch — one completed list call (no duplicate). Tab list must succeed. */
export async function fetchVendorDashboardSnapshot(
  activeTab: BookingTab
): Promise<VendorDashboardSnapshot> {
  const [
    profileResult,
    availableResult,
    activeResult,
    completedResult,
    tabResult,
    extensionsResult,
  ] = await Promise.allSettled([
    fetchVendorMe(),
    fetchVendorBookings("available", 1, 1),
    fetchVendorBookings("active", 1, 1),
    fetchVendorBookings("completed", 1, 50),
    fetchVendorBookings(activeTab, 1, 50),
    fetchVendorExtensions("pending", 1, 20),
  ]);

  if (tabResult.status === "rejected") {
    throw tabResult.reason;
  }

  const tabRes = tabResult.value;

  return {
    profile: profileResult.status === "fulfilled" ? profileResult.value : null,
    bookings: tabRes.items,
    counts: {
      available: countFrom(availableResult),
      active: countFrom(activeResult),
      completed:
        completedResult.status === "fulfilled"
          ? completedResult.value.pagination.total_items
          : 0,
    },
    pendingExtensions: extensionsFrom(extensionsResult),
    completedBookings: listFrom(completedResult),
  };
}

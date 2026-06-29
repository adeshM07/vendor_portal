import { materialOrderToPortalItem, type PortalListItem } from "@/lib/portal-items";
import {
  fetchMaterialVendorMe,
  refreshVendorOrdersSnapshot,
  type MaterialOrderListItem,
} from "@/lib/material-vendor";
import { writeMaterialOrderListCaches } from "@/lib/material-order-list-cache";
import type { VendorDashboardSnapshot } from "@/lib/vendor-dashboard";
import type { BookingTab, VendorProfile } from "@/lib/vendor";
import { MATERIAL_VENDOR_PHONE_RANGE } from "@/lib/material-vendor-auth";

export interface VendorPortalSnapshot extends VendorDashboardSnapshot {
  materialPortalItems: PortalListItem[];
  materialOrders: MaterialOrderListItem[];
  materialLoadWarning: string;
  materialCounts: { available: number; active: number; completed: number };
}

function pageSlice<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

function isIgnorableMaterialError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unknown tab") ||
    normalized.includes("validation failed") ||
    normalized.includes("validation error") ||
    normalized.includes("no material orders returned")
  );
}

function buildMaterialEmptyWarning(
  materialMe: Awaited<ReturnType<typeof fetchMaterialVendorMe>>
): string {
  if (!materialMe) {
    return `Could not load your material supplier profile. Sign in with a linked supplier phone (${MATERIAL_VENDOR_PHONE_RANGE}) and confirm GET /materials/vendor/me returns is_linked: true.`;
  }
  if (!materialMe.is_linked) {
    return `Your login (${materialMe.phone ?? "this number"}) is not linked to a material supplier. Use phones ${MATERIAL_VENDOR_PHONE_RANGE}.`;
  }
  return "No orders in the competitive pool right now. New customer orders appear in Upcoming for all eligible suppliers — the first to accept gets the job.";
}

function materialProfileToVendorProfile(
  materialMe: Awaited<ReturnType<typeof fetchMaterialVendorMe>>
): VendorProfile | null {
  if (!materialMe) return null;
  return {
    vendor_id: materialMe.vendor_id,
    name: materialMe.name,
    contact_name: materialMe.name,
    phone: materialMe.phone,
    email: null,
    user_id: materialMe.vendor_id ?? "",
    is_linked: materialMe.is_linked,
  };
}

/** Material-only vendor portal snapshot (no rental bookings). */
export async function fetchVendorPortalSnapshot(
  activeTab: BookingTab
): Promise<VendorPortalSnapshot> {
  const [materialMe, snapshotResult] = await Promise.all([
    fetchMaterialVendorMe().catch(() => null),
    refreshVendorOrdersSnapshot().catch((err: unknown) => ({
      available: [] as MaterialOrderListItem[],
      active: [] as MaterialOrderListItem[],
      completed: [] as MaterialOrderListItem[],
      error: err instanceof Error ? err.message : "",
    })),
  ]);

  const materialBuckets = {
    available: snapshotResult.available,
    active: snapshotResult.active,
    completed: snapshotResult.completed,
  };

  const linkageWarning =
    materialMe && !materialMe.is_linked ? buildMaterialEmptyWarning(materialMe) : "";

  const apiError =
    "error" in snapshotResult && typeof snapshotResult.error === "string"
      ? snapshotResult.error
      : "";

  const totalMaterial =
    materialBuckets.available.length +
    materialBuckets.active.length +
    materialBuckets.completed.length;

  let materialLoadWarning = linkageWarning;
  if (!materialLoadWarning && apiError && !isIgnorableMaterialError(apiError)) {
    materialLoadWarning = apiError;
  }
  if (!materialLoadWarning && totalMaterial === 0) {
    materialLoadWarning = buildMaterialEmptyWarning(materialMe);
  }

  const upcomingHint =
    activeTab !== "available" && materialBuckets.available.length > 0
      ? `${materialBuckets.available.length} material order(s) waiting in Upcoming — first vendor to accept wins.`
      : "";

  const materialOrders = pageSlice(materialBuckets[activeTab], 1, 20);
  const materialPortalItems = materialOrders
    .map(materialOrderToPortalItem)
    .sort((a, b) => {
      const aTime = a.sort_at ? new Date(a.sort_at).getTime() : 0;
      const bTime = b.sort_at ? new Date(b.sort_at).getTime() : 0;
      return bTime - aTime;
    });

  writeMaterialOrderListCaches([
    ...materialBuckets.available,
    ...materialBuckets.active,
    ...materialBuckets.completed,
  ]);

  const materialCounts = {
    available: materialBuckets.available.length,
    active: materialBuckets.active.length,
    completed: materialBuckets.completed.length,
  };

  return {
    profile: materialProfileToVendorProfile(materialMe),
    bookings: [],
    counts: materialCounts,
    pendingExtensions: [],
    completedBookings: [],
    materialOrders,
    materialPortalItems,
    materialCounts,
    materialLoadWarning: materialLoadWarning || upcomingHint,
  };
}

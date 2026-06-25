import type { MaterialOrderListItem } from "@/lib/material-vendor";

const CACHE_PREFIX = "l2b_material_order_row_";

export function writeMaterialOrderListCache(order: MaterialOrderListItem): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(order);
    sessionStorage.setItem(`${CACHE_PREFIX}${order.id}`, json);
    if (order.order_number && order.order_number !== order.id) {
      sessionStorage.setItem(`${CACHE_PREFIX}${order.order_number}`, json);
    }
  } catch {
    // sessionStorage full or unavailable
  }
}

export function writeMaterialOrderListCaches(orders: MaterialOrderListItem[]): void {
  for (const order of orders) {
    writeMaterialOrderListCache(order);
  }
}

export function readMaterialOrderListCache(
  orderId: string
): MaterialOrderListItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${orderId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MaterialOrderListItem;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

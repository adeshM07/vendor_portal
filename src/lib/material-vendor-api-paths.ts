/**
 * Material vendor API paths — from backend Swagger:
 * http://localhost:8000/material/material-docs#/
 * Spec: /material/material-openapi.json
 *
 * Base URL: NEXT_PUBLIC_MATERIAL_API_BASE_URL
 *   (default http://localhost:8000/material/api/v1)
 */

export type MaterialVendorOrderTab = "available" | "active" | "completed";

/** Vendor-scoped routes (Material: Vendor tag). */
export const MATERIAL_VENDOR_API = {
  vendorMe: "/materials/vendor/me",
  /** GET — open pool + assigned orders (§4.14); no query params in Swagger */
  vendorOrders: "/materials/vendor/orders",
  vendorOrderAccept: (orderId: string) => `/materials/vendor/orders/${orderId}/accept`,
  vendorOrderReject: (orderId: string) => `/materials/vendor/orders/${orderId}/reject`,
  vendorOrderQc: (orderId: string) => `/materials/vendor/orders/${orderId}/qc`,
  vendorOrderStatus: (orderId: string) => `/materials/vendor/orders/${orderId}/status`,
  vendorOrderConfirmDelivery: (orderId: string) =>
    `/materials/vendor/orders/${orderId}/confirm-delivery`,
  vendorOrderLocation: (orderId: string) => `/materials/vendor/orders/${orderId}/location`,
} as const;

/** Buyer order detail — used for vendor detail view (no GET vendor/{id} in Swagger). */
export const MATERIAL_ORDER_API = {
  orderDetail: (orderId: string) => `/materials/orders/${orderId}`,
} as const;

export const MATERIAL_VENDOR_ORDER_TABS: MaterialVendorOrderTab[] = [
  "available",
  "active",
  "completed",
];

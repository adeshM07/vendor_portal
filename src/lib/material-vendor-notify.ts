import {
  MATERIAL_API_BASE_URL,
  ApiRequestError,
  type ApiErrorBody,
  type ApiSuccessBody,
} from "@/lib/api";
import { getVendorSession } from "@/lib/auth";

export type VendorNotifySubscriptionStatus = "pending" | "fulfilled" | string;

export interface VendorNotifySubscription {
  subscription_id: string;
  product_id: string;
  product_name: string;
  brand_id: string | null;
  brand_name: string | null;
  variant_id: string | null;
  variant_label: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subscribed_at: string;
  status: VendorNotifySubscriptionStatus;
}

export interface VendorNotifyProductSummary {
  product_id: string;
  product_name: string;
  pending_count: number;
}

export interface VendorNotifySummary {
  pending_count: number;
  by_product: VendorNotifyProductSummary[];
}

function vendorAuthHeaders(): HeadersInit {
  const session = getVendorSession();
  if (!session?.accessToken) {
    throw new ApiRequestError("Session expired. Please sign in again.", "UNAUTHORIZED", 401);
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessToken}`,
  };
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function unwrapApiData<T>(body: ApiSuccessBody<T> | T): T {
  if (body && typeof body === "object" && "success" in body && body.success && "data" in body) {
    return body.data as T;
  }
  return body as T;
}

function normalizeSubscription(raw: Record<string, unknown>): VendorNotifySubscription | null {
  const subscriptionId = pickString(raw, ["subscription_id", "subscriptionId", "id"]);
  const productId = pickString(raw, ["product_id", "productId"]);
  const productName = pickString(raw, ["product_name", "productName", "name"]);
  const subscribedAt = pickString(raw, ["subscribed_at", "subscribedAt", "created_at"]);
  if (!subscriptionId || !productId || !productName || !subscribedAt) return null;

  return {
    subscription_id: subscriptionId,
    product_id: productId,
    product_name: productName,
    brand_id: pickString(raw, ["brand_id", "brandId"]),
    brand_name: pickString(raw, ["brand_name", "brandName"]),
    variant_id: pickString(raw, ["variant_id", "variantId"]),
    variant_label: pickString(raw, ["variant_label", "variantLabel", "variant_name"]),
    customer_name: pickString(raw, ["customer_name", "customerName"]),
    customer_phone: pickString(raw, ["customer_phone", "customerPhone"]),
    subscribed_at: subscribedAt,
    status: pickString(raw, ["status"]) ?? "pending",
  };
}

function normalizeSummary(raw: Record<string, unknown>): VendorNotifySummary {
  const byProductRaw = raw.by_product ?? raw.byProduct ?? raw.products;
  const by_product = Array.isArray(byProductRaw)
    ? byProductRaw
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as Record<string, unknown>;
          const productId = pickString(record, ["product_id", "productId"]);
          const productName = pickString(record, ["product_name", "productName", "name"]);
          if (!productId || !productName) return null;
          return {
            product_id: productId,
            product_name: productName,
            pending_count: pickNumber(record, ["pending_count", "pendingCount", "count"]),
          };
        })
        .filter((item): item is VendorNotifyProductSummary => item !== null)
    : [];

  return {
    pending_count: pickNumber(raw, ["pending_count", "pendingCount", "total_pending"]),
    by_product,
  };
}

async function parseVendorNotifyResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const body = (await response.json()) as ApiSuccessBody<T> | ApiErrorBody;
  if (!response.ok || !("success" in body) || !body.success) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? fallbackMessage,
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      errorBody.error?.details
    );
  }
  return unwrapApiData<T>(body);
}

export async function fetchVendorNotifySubscriptions(): Promise<VendorNotifySubscription[]> {
  const response = await fetch(
    `${MATERIAL_API_BASE_URL}/materials/vendor/notify-subscriptions`,
    { headers: vendorAuthHeaders(), cache: "no-store" }
  );

  const data = await parseVendorNotifyResponse<Record<string, unknown>>(
    response,
    "Failed to load stock alert requests."
  );

  const list = data.subscriptions ?? data.items ?? data;
  if (!Array.isArray(list)) return [];

  return list
    .map((entry) =>
      entry && typeof entry === "object"
        ? normalizeSubscription(entry as Record<string, unknown>)
        : null
    )
    .filter((item): item is VendorNotifySubscription => item !== null);
}

export async function fetchVendorNotifySummary(): Promise<VendorNotifySummary> {
  const response = await fetch(
    `${MATERIAL_API_BASE_URL}/materials/vendor/notify-subscriptions/summary`,
    { headers: vendorAuthHeaders(), cache: "no-store" }
  );

  const data = await parseVendorNotifyResponse<Record<string, unknown>>(
    response,
    "Failed to load stock alert summary."
  );

  return normalizeSummary(data);
}

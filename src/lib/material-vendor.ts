import {
  API_BASE_URL,
  MATERIAL_API_BASE_URL,
  ApiRequestError,
  type ApiErrorBody,
  type ApiSuccessBody,
} from "@/lib/api";
import { getVendorSession } from "@/lib/auth";
import {
  readMaterialOrderListCache,
  writeMaterialOrderListCaches,
} from "@/lib/material-order-list-cache";

/** Mirrors rental vendor tabs for consistent portal UX. */
export type MaterialOrderTab = "available" | "active" | "completed";

export interface MaterialPaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

export interface MaterialOrderLineItem {
  id: string;
  product_name: string;
  brand_name: string | null;
  variant_name: string | null;
  subtype_name?: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
  hsn_code?: string | null;
  qty_display?: string | null;
  unit_label?: string | null;
  product_slug?: string | null;
  product_id?: string | null;
  product_image_url?: string | null;
  /** Populated from GET /materials/products/{slug}/availability when enriched. */
  available_stock?: number | null;
  stock_unit?: string | null;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  stock_insufficient?: boolean;
  stock_validation_message?: string | null;
}

export interface MaterialStatusTimelineStep {
  step: string;
  label: string;
  reached_at: string | null;
  is_current: boolean;
}

export interface MaterialBillSummary {
  subtotal: string | null;
  tax_total: string | null;
  shipping_total: string | null;
  coupon_discount: string | null;
  grand_total: string | null;
}

export interface MaterialDeliverTo {
  type: string;
  label: string | null;
  full_address: string | null;
}

export interface MaterialOrderPayment {
  method: string;
  collect_amount: string | null;
  paid: boolean;
}

export interface MaterialOrderAvailableActions {
  can_accept: boolean;
  can_reject: boolean;
  can_mark_qc: boolean;
  can_advance_status: boolean;
  can_confirm_delivery: boolean;
  can_update_location: boolean;
}

export interface MaterialOrderListItem {
  id: string;
  order_number: string;
  status: string;
  status_label?: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  delivery_address: string | null;
  item_count: number;
  total_amount: number;
  created_at: string;
  scheduled_date: string | null;
  items?: MaterialOrderLineItem[];
}

export interface MaterialOrderDetail extends MaterialOrderListItem {
  order_id: string;
  status_label: string;
  delivery_mode: string | null;
  estimated_delivery_date: string | null;
  items_count_label: string | null;
  delivery_otp: string | null;
  status_timeline: MaterialStatusTimelineStep[];
  deliver_to: MaterialDeliverTo;
  bill_summary: MaterialBillSummary;
  payment: MaterialOrderPayment;
  customer_phone: string | null;
  customer_email: string | null;
  po_number: string | null;
  items: MaterialOrderLineItem[];
  available_actions: MaterialOrderAvailableActions;
}

function materialAuthHeaders(): HeadersInit {
  const session = getVendorSession();
  if (!session?.accessToken) {
    throw new ApiRequestError("Session expired. Please sign in again.", "UNAUTHORIZED", 401);
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessToken}`,
  };
}

function normalizePagination(
  raw: Record<string, unknown> | MaterialPaginationMeta | undefined,
  fallbackCount: number
): MaterialPaginationMeta {
  const p = (raw ?? {}) as Record<string, unknown>;
  const meta = (p.meta ?? p.pagination ?? p) as Record<string, unknown>;
  const page = Number(meta.page ?? p.page ?? 1);
  const perPage = Number(meta.per_page ?? meta.perPage ?? p.per_page ?? p.perPage ?? 20);
  const totalItems = Number(
    meta.total_items ??
      meta.totalItems ??
      meta.total ??
      meta.total_count ??
      meta.count ??
      p.total_items ??
      p.totalItems ??
      fallbackCount
  );
  const totalPages = Number(
    meta.total_pages ??
      meta.totalPages ??
      p.total_pages ??
      p.totalPages ??
      (perPage > 0 ? Math.ceil(totalItems / perPage) : 0)
  );
  return { page, per_page: perPage, total_items: totalItems, total_pages: totalPages };
}

const TAB_BUCKET_KEYS: Record<MaterialOrderTab, string[]> = {
  available: [
    "open_pool",
    "available",
    "available_orders",
    "pending",
    "upcoming",
    "new_orders",
    "open_orders",
  ],
  active: ["assigned", "active", "active_orders", "in_progress", "ongoing", "current_orders"],
  completed: ["completed", "completed_orders", "past", "history", "closed_orders"],
};

const LIST_ARRAY_KEYS = [
  "items",
  "orders",
  "vendor_orders",
  "material_orders",
  "order_list",
  "records",
  "list",
  "results",
  "rows",
  "content",
  "data",
];

function extractListArray(rawData: unknown, tab?: MaterialOrderTab): unknown[] {
  if (Array.isArray(rawData)) return rawData;
  if (!rawData || typeof rawData !== "object") return [];

  const obj = rawData as Record<string, unknown>;
  if (tab) {
    for (const key of TAB_BUCKET_KEYS[tab]) {
      if (Array.isArray(obj[key])) return obj[key];
    }
  }

  for (const key of LIST_ARRAY_KEYS) {
    if (Array.isArray(obj[key])) return obj[key];
  }

  return [];
}

/** Statuses where the order is in the competitive vendor pool (Upcoming). */
export function isPendingVendorAcceptance(status: string): boolean {
  const normalized = status.toLowerCase();
  return [
    "pending_vendor_acceptance",
    "pending",
    "awaiting_vendor",
    "awaiting_vendor_acceptance",
    "awaiting_acceptance",
    "open",
    "open_for_vendors",
    "unassigned",
  ].includes(normalized);
}

/** Another vendor won the race — order no longer available to accept. */
export function isMaterialOrderAlreadyTakenError(err: ApiRequestError): boolean {
  if (err.status === 409 || err.status === 423) return true;
  const code = err.code.toLowerCase();
  const msg = err.message.toLowerCase();
  return (
    code.includes("already_accepted") ||
    code.includes("already_assigned") ||
    code.includes("order_taken") ||
    code.includes("not_available") ||
    code.includes("conflict") ||
    msg.includes("already accepted") ||
    msg.includes("already assigned") ||
    msg.includes("another vendor") ||
    msg.includes("no longer available")
  );
}

export function getMaterialActionUserMessage(err: ApiRequestError): string {
  if (isMaterialOrderAlreadyTakenError(err)) {
    return "Another vendor accepted this order. It has been removed from your list.";
  }
  return err.message;
}

/** Classify an order into dashboard tabs when the API returns an unfiltered list. */
export function classifyMaterialOrderTab(status: string): MaterialOrderTab {
  const normalized = status.toLowerCase();
  if (
    ["delivered", "cancelled", "canceled", "rejected", "declined", "completed"].includes(
      normalized
    )
  ) {
    return "completed";
  }
  if (isPendingVendorAcceptance(normalized)) {
    return "available";
  }
  return "active";
}

async function parseMaterialPaginated<T>(
  response: Response,
  tab?: MaterialOrderTab
): Promise<{ items: T[]; pagination: MaterialPaginationMeta }> {
  const body = (await response.json()) as
    | { success?: boolean; data?: unknown; pagination?: MaterialPaginationMeta }
    | ApiErrorBody
    | Record<string, unknown>;

  if (!response.ok || ("success" in body && body.success === false)) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? "Something went wrong. Please try again.",
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  let rawData: unknown = body;
  let paginationSource: Record<string, unknown> | MaterialPaginationMeta | undefined;

  if ("success" in body && body.success === true && "data" in body) {
    rawData = body.data;
    const envelope = body as Record<string, unknown>;
    paginationSource =
      (envelope.pagination as MaterialPaginationMeta | undefined) ??
      (envelope.meta as MaterialPaginationMeta | undefined) ??
      ((body.data as Record<string, unknown> | undefined)?.meta as
        | MaterialPaginationMeta
        | undefined) ??
      ((body.data as Record<string, unknown> | undefined)?.pagination as
        | MaterialPaginationMeta
        | undefined);
  } else if ("data" in body && body.data !== undefined) {
    rawData = body.data;
    const envelope = body as Record<string, unknown>;
    paginationSource =
      (envelope.pagination as MaterialPaginationMeta | undefined) ??
      (envelope.meta as MaterialPaginationMeta | undefined) ??
      ((body.data as Record<string, unknown> | undefined)?.meta as
        | MaterialPaginationMeta
        | undefined);
  } else if (
    "items" in body ||
    "orders" in body ||
    "records" in body ||
    "list" in body
  ) {
    rawData = body;
    paginationSource = body.pagination as MaterialPaginationMeta | undefined;
  }

  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const nested = rawData as { pagination?: MaterialPaginationMeta };
    paginationSource = nested.pagination ?? paginationSource;
  }

  const items = extractListArray(rawData, tab) as T[];

  return {
    items,
    pagination: normalizePagination(paginationSource, items.length),
  };
}

function materialListScore(
  items: MaterialOrderListItem[],
  pagination: MaterialPaginationMeta
): number {
  return Math.max(items.length, pagination.total_items);
}

async function parseMaterialData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiSuccessBody<T> | ApiErrorBody;
  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? "Something went wrong. Please try again.",
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }
  return (body as ApiSuccessBody<T>).data;
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
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

const MATERIAL_IMAGE_FIELD_KEYS = [
  "product_image_url",
  "productImageUrl",
  "image_url",
  "imageUrl",
  "material_image_url",
  "materialImageUrl",
  "thumbnail_url",
  "thumbnailUrl",
  "hero_image_url",
  "heroImageUrl",
  "image",
  "photo_url",
  "photoUrl",
];

/** Turn API/S3 image paths into browser-loadable URLs (mirrors rental site image handling). */
export function resolveMaterialImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  const relativePath = trimmed.replace(/^\//, "");
  const mediaBase = process.env.NEXT_PUBLIC_MATERIAL_MEDIA_BASE_URL?.trim();
  const candidates = [
    mediaBase ? `${mediaBase.replace(/\/$/, "")}/${relativePath}` : null,
    `${API_BASE_URL.replace(/\/api\/v1\/?$/, "")}/${relativePath}`,
    `${MATERIAL_API_BASE_URL.replace(/\/material\/api\/v1\/?$/, "")}/${relativePath}`,
    `${API_BASE_URL.replace(/\/$/, "")}/${relativePath}`,
    `${MATERIAL_API_BASE_URL.replace(/\/$/, "")}/${relativePath}`,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates[0] ?? trimmed;
}

function pickMaterialImageUrl(raw: Record<string, unknown>): string | null {
  const product = raw.product as Record<string, unknown> | null | undefined;
  const material = raw.material as Record<string, unknown> | null | undefined;

  for (const source of [raw, product ?? {}, material ?? {}]) {
    for (const key of MATERIAL_IMAGE_FIELD_KEYS) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        return resolveMaterialImageUrl(value.trim());
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = pickMaterialImageUrl(value as Record<string, unknown>);
        if (nested) return nested;
      }
    }
  }

  for (const source of [raw.images, product?.images, material?.images]) {
    if (!Array.isArray(source) || source.length === 0) continue;
    const first = source[0];
    if (typeof first === "string") {
      const resolved = resolveMaterialImageUrl(first);
      if (resolved) return resolved;
    }
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const resolved = pickMaterialImageUrl(first as Record<string, unknown>);
      if (resolved) return resolved;
    }
  }

  return null;
}

function enrichLineItemsWithOrderImage(
  lineItems: MaterialOrderLineItem[],
  payload: Record<string, unknown>
): MaterialOrderLineItem[] {
  const orderLevelImage = pickMaterialImageUrl(payload);
  if (!orderLevelImage) return lineItems;
  return lineItems.map((item) => ({
    ...item,
    product_image_url: item.product_image_url ?? orderLevelImage,
  }));
}

function mergeMaterialOrderLineItems(
  primary: MaterialOrderLineItem[],
  secondary: MaterialOrderLineItem[]
): MaterialOrderLineItem[] {
  const longer = primary.length >= secondary.length ? primary : secondary;
  const shorter = primary.length >= secondary.length ? secondary : primary;
  return longer.map((item, index) => {
    const other = shorter[index];
    if (!other) return item;
    return {
      ...other,
      ...item,
      product_image_url: item.product_image_url ?? other.product_image_url,
      product_name: pickRicherText(item.product_name, other.product_name) ?? item.product_name,
      brand_name: pickRicherText(item.brand_name, other.brand_name),
      variant_name: pickRicherText(item.variant_name, other.variant_name),
    };
  });
}

function unwrapOrderPayload(raw: Record<string, unknown>): Record<string, unknown> {
  let merged = { ...raw };
  for (const key of [
    "order",
    "order_detail",
    "orderDetail",
    "data",
    "customer_info",
    "customerInfo",
    "buyer_info",
    "buyerInfo",
    "delivery_info",
    "deliveryInfo",
    "shipping_info",
    "shippingInfo",
  ]) {
    const nested = raw[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      merged = { ...merged, ...(nested as Record<string, unknown>) };
    }
  }
  return merged;
}

function extractNestedRecord(
  raw: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = raw[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function extractAddressFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const obj = value as Record<string, unknown>;
  const direct = pickString(obj, [
    "full_address",
    "fullAddress",
    "address",
    "formatted_address",
    "formattedAddress",
  ]);
  if (direct) return direct;

  const parts = [
    pickString(obj, ["line1", "address_line_1", "street", "house_no"]),
    pickString(obj, ["line2", "address_line_2", "area", "landmark"]),
    pickString(obj, ["city", "locality", "district"]),
    pickString(obj, ["state", "region"]),
    pickString(obj, ["pincode", "postal_code", "zip", "pin"]),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : null;
}

function pickRicherText(
  a: string | null | undefined,
  b: string | null | undefined
): string | null {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left) return right || null;
  if (!right) return left || null;
  return right.length > left.length ? right : left;
}

function formatPartyPhone(party: Record<string, unknown> | null | undefined): string | null {
  if (!party) return null;
  const direct = pickString(party, [
    "phone",
    "phone_number",
    "mobile",
    "contact_phone",
    "contact_number",
    "phone_no",
    "contact_mobile",
    "buyer_phone",
    "customer_phone",
  ]);
  if (direct) return direct;

  const countryCode = pickString(party, [
    "phone_country_code",
    "country_code",
    "dial_code",
  ]);
  const number = pickString(party, [
    "phone_number",
    "mobile",
    "contact_number",
    "phone",
  ]);
  if (countryCode && number) {
    const normalizedCode = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
    return `${normalizedCode} ${number}`;
  }
  return number;
}

function expandParty(
  party: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!party) return {};
  let merged = { ...party };
  for (const key of ["user", "profile", "account", "contact", "person", "details"]) {
    const nested = party[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      merged = { ...merged, ...(nested as Record<string, unknown>) };
    }
  }
  return merged;
}

function extractCustomerFields(payload: Record<string, unknown>): {
  name: string | null;
  phone: string | null;
  email: string | null;
} {
  const partyKeys = [
    "buyer",
    "customer",
    "owner",
    "recipient",
    "contact",
    "ordered_by",
    "buyer_details",
    "customer_details",
    "buyer_snapshot",
    "customer_snapshot",
    "consignee",
    "ship_to",
    "purchaser",
    "end_customer",
    "placed_by",
    "placed_by_user",
    "ordering_user",
    "order_placed_by",
    "buyer_user",
    "user",
    "account_holder",
  ];

  let name = pickString(payload, [
    "customer_name",
    "customerName",
    "buyer_name",
    "buyerName",
    "contact_name",
    "recipient_name",
    "consignee_name",
    "user_name",
    "placed_by_name",
    "ordering_user_name",
    "account_name",
  ]);
  let phone = pickString(payload, [
    "customer_phone",
    "customerPhone",
    "buyer_phone",
    "buyerPhone",
    "contact_phone",
    "mobile",
    "phone_number",
    "buyer_mobile",
    "contact_number",
    "contact_mobile",
    "phone",
    "placed_by_phone",
    "ordering_user_phone",
    "account_phone",
  ]);
  let email = pickString(payload, [
    "customer_email",
    "customerEmail",
    "buyer_email",
    "buyerEmail",
    "contact_email",
    "email",
    "user_email",
    "email_address",
    "placed_by_email",
    "ordering_user_email",
    "account_email",
  ]);

  const deliveryBlock = extractNestedRecord(payload, [
    "delivery",
    "shipping",
    "delivery_details",
    "shipping_details",
  ]);
  if (deliveryBlock) {
    phone = pickRicherText(
      phone,
      pickString(deliveryBlock, [
        "contact_phone",
        "recipient_phone",
        "phone_number",
        "mobile",
      ])
    );
    email = pickRicherText(
      email,
      pickString(deliveryBlock, ["contact_email", "recipient_email", "email"])
    );
  }

  const deliverToBlock = extractNestedRecord(payload, [
    "deliver_to",
    "ship_to",
    "delivery_site",
    "saved_address",
  ]);
  if (deliverToBlock) {
    phone = pickRicherText(phone, formatPartyPhone(deliverToBlock));
    email = pickRicherText(
      email,
      pickString(deliverToBlock, [
        "email",
        "contact_email",
        "recipient_email",
      ])
    );
  }

  for (const key of partyKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      name = pickRicherText(name, value);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const expanded = expandParty(value as Record<string, unknown>);
    const firstName = pickString(expanded, ["first_name", "firstName"]);
    const lastName = pickString(expanded, ["last_name", "lastName"]);
    const combinedName = [firstName, lastName].filter(Boolean).join(" ");

    name = pickRicherText(
      name,
      pickRicherText(
        pickString(expanded, ["name", "full_name", "display_name", "contact_name"]),
        combinedName || null
      )
    );
    phone = pickRicherText(phone, formatPartyPhone(expanded));
    email = pickRicherText(email, pickString(expanded, ["email", "email_address"]));
  }

  return { name, phone, email };
}

function normalizeLineItem(raw: Record<string, unknown>): MaterialOrderLineItem {
  const product = raw.product as Record<string, unknown> | null | undefined;
  const brand = raw.brand as Record<string, unknown> | null | undefined;
  const variant = raw.variant as Record<string, unknown> | null | undefined;
  const quantity = pickNumber(raw, ["quantity", "qty", "ordered_quantity"]);
  const unitPrice = pickNumber(raw, ["unit_price", "unitPrice", "price"]);
  const lineTotalRaw = pickString(raw, ["line_total", "lineTotal", "total", "amount"]);
  const lineTotal = lineTotalRaw
    ? Number(lineTotalRaw)
    : pickNumber(raw, ["line_total", "lineTotal", "total", "amount"]);

  return {
    id: String(raw.id ?? raw.order_item_id ?? raw.line_id ?? raw.item_id ?? ""),
    product_name:
      pickString(raw, ["product_name", "productName", "name", "title"]) ??
      pickString(product ?? {}, ["name", "title"]) ??
      "Material item",
    brand_name:
      pickString(raw, ["brand_name", "brandName"]) ??
      pickString(brand ?? {}, ["name", "title"]),
    variant_name:
      pickString(raw, ["variant_name", "variantName", "subtype", "size"]) ??
      pickString(variant ?? {}, ["name", "label"]),
    subtype_name: pickString(raw, ["subtype_name", "subtypeName"]),
    quantity,
    unit:
      pickString(raw, ["unit_label", "unit", "uom", "selling_unit"]) ??
      pickString(raw, ["unit_label"]),
    unit_price: unitPrice,
    line_total: lineTotal > 0 ? lineTotal : unitPrice * quantity,
    hsn_code: pickString(raw, ["hsn_code", "hsnCode"]),
    qty_display: pickString(raw, ["qty_display", "qtyDisplay"]),
    unit_label: pickString(raw, ["unit_label", "unitLabel"]),
    product_slug:
      pickString(raw, ["product_slug", "productSlug", "slug"]) ??
      pickString(product ?? {}, ["slug", "product_slug"]),
    product_id:
      pickString(raw, ["product_id", "productId"]) ??
      pickString(product ?? {}, ["id", "product_id"]),
    product_image_url: pickMaterialImageUrl(raw),
  };
}

function normalizeStatusTimeline(
  raw: Record<string, unknown>
): MaterialStatusTimelineStep[] {
  const source = raw.status_timeline ?? raw.timeline ?? raw.order_timeline;
  if (!Array.isArray(source)) return [];

  return source
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const label =
        pickString(record, ["label", "status", "title", "event", "step"]) ?? "Status";
      const reachedAt =
        pickString(record, ["reached_at", "reachedAt", "timestamp", "at", "occurred_at"]) ??
        null;
      return {
        step: String(record.step ?? label),
        label,
        reached_at: reachedAt,
        is_current: Boolean(record.is_current ?? record.isCurrent ?? false),
      };
    })
    .filter((step): step is MaterialStatusTimelineStep => step !== null);
}

function normalizeBillSummary(raw: Record<string, unknown>): MaterialBillSummary {
  const bill = (raw.bill_summary ?? raw.bill ?? {}) as Record<string, unknown>;
  return {
    subtotal:
      pickString(bill, ["subtotal"]) ?? pickString(raw, ["subtotal"]),
    tax_total:
      pickString(bill, ["tax_total", "taxTotal"]) ?? pickString(raw, ["tax_total", "taxTotal"]),
    shipping_total:
      pickString(bill, ["shipping_total", "shippingTotal"]) ??
      pickString(raw, ["shipping_total", "shippingTotal"]),
    coupon_discount:
      pickString(bill, ["coupon_discount", "couponDiscount"]) ??
      pickString(raw, ["coupon_discount", "couponDiscount"]),
    grand_total:
      pickString(bill, ["grand_total", "grandTotal", "total"]) ??
      pickString(raw, ["order_value", "total_bill", "grand_total", "total_amount", "totalAmount"]),
  };
}

function collectAddressCandidates(raw: Record<string, unknown>): string[] {
  const candidates: string[] = [];
  const push = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) candidates.push(trimmed);
  };

  const objectKeys = [
    "deliver_to",
    "ship_to",
    "delivery_address",
    "shipping_address",
    "delivery_site",
    "saved_address",
    "delivery_location",
    "consignee",
    "site",
    "address",
    "destination",
  ];

  for (const key of objectKeys) {
    const value = raw[key];
    if (typeof value === "string") {
      push(value);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const obj = value as Record<string, unknown>;
    push(pickString(obj, ["full_address", "fullAddress", "address", "formatted_address"]));
    push(extractAddressFromUnknown(obj));

    const nestedAddress = extractNestedRecord(obj, [
      "address",
      "shipping_address",
      "site",
      "destination",
      "location",
    ]);
    if (nestedAddress) {
      push(extractAddressFromUnknown(nestedAddress));
      push(
        pickString(nestedAddress, ["full_address", "fullAddress", "address", "formatted_address"])
      );
    }
  }

  const deliveryBlock = extractNestedRecord(raw, [
    "delivery",
    "shipping",
    "delivery_details",
    "shipping_details",
  ]);
  if (deliveryBlock) {
    push(extractAddressFromUnknown(deliveryBlock));
    push(pickString(deliveryBlock, ["full_address", "fullAddress", "address"]));
    const nested = extractNestedRecord(deliveryBlock, [
      "deliver_to",
      "address",
      "site",
      "destination",
      "delivery_site",
    ]);
    if (nested) {
      push(extractAddressFromUnknown(nested));
      push(pickString(nested, ["full_address", "fullAddress", "address"]));
    }
  }

  push(
    pickString(raw, [
      "delivery_address",
      "deliveryAddress",
      "shipping_address",
      "site_address",
      "full_address",
      "address",
    ])
  );

  return candidates;
}

function pickSiteLabel(raw: Record<string, unknown>, deliverObj: Record<string, unknown>): string | null {
  return (
    pickString(deliverObj, ["label", "site_name", "title"]) ??
    pickString(raw, ["delivery_label", "site_name", "project_name"])
  );
}

function normalizeDeliverTo(raw: Record<string, unknown>): MaterialDeliverTo {
  const deliveryBlock = extractNestedRecord(raw, [
    "delivery",
    "shipping",
    "delivery_details",
    "shipping_details",
    "delivery_site",
  ]);
  const deliverObj =
    extractNestedRecord(raw, ["deliver_to", "ship_to", "consignee", "delivery_site"]) ??
    (deliveryBlock
      ? extractNestedRecord(deliveryBlock, [
          "deliver_to",
          "address",
          "site",
          "destination",
          "delivery_site",
        ])
      : null) ??
    extractNestedRecord(raw, ["site", "project", "destination"]) ??
    (typeof raw.delivery_address === "object" && raw.delivery_address
      ? (raw.delivery_address as Record<string, unknown>)
      : null) ??
    {};

  const candidates = collectAddressCandidates(raw);
  const fullAddress = candidates.reduce<string | null>(
    (best, candidate) => pickRicherText(best, candidate),
    null
  );

  const label = pickSiteLabel(raw, deliverObj);

  return {
    type: String(deliverObj.type ?? deliveryBlock?.type ?? "address"),
    label,
    full_address: fullAddress,
  };
}

function normalizePayment(raw: Record<string, unknown>): MaterialOrderPayment {
  const payment = (raw.payment ?? {}) as Record<string, unknown>;
  const bill = normalizeBillSummary(raw);
  return {
    method: pickString(payment, ["method"]) ?? pickString(raw, ["payment_method"]) ?? "cod",
    collect_amount:
      pickString(payment, ["collect_amount", "collectAmount"]) ?? bill.grand_total,
    paid: Boolean(payment.paid ?? false),
  };
}

function normalizeAvailableActions(
  raw: Record<string, unknown>,
  status: string
): MaterialOrderAvailableActions {
  const actions = (raw.available_actions ?? raw.actions ?? {}) as Record<string, unknown>;
  const hasExplicitActions = Object.keys(actions).length > 0;
  const normalizedStatus = status.toLowerCase();
  const pending = isPendingVendorAcceptance(normalizedStatus);
  const assignedVendorId = pickString(raw, [
    "assigned_vendor_id",
    "assignedVendorId",
    "vendor_id",
    "vendorId",
  ]);
  const isAssigned = Boolean(assignedVendorId);

  if (hasExplicitActions) {
    return {
      can_accept: Boolean(actions.can_accept ?? actions.can_approve),
      can_reject: Boolean(actions.can_reject ?? actions.can_decline),
      can_mark_qc: Boolean(actions.can_mark_qc ?? actions.can_qc),
      can_advance_status: Boolean(actions.can_advance_status ?? actions.can_update_status),
      can_confirm_delivery: Boolean(
        actions.can_confirm_delivery ?? actions.can_deliver
      ),
      can_update_location: Boolean(
        actions.can_update_location ?? actions.can_share_location
      ),
    };
  }

  return {
    can_accept: pending && !isAssigned,
    can_reject: pending && !isAssigned,
    can_mark_qc:
      !pending &&
      (normalizedStatus === "confirmed" ||
        normalizedStatus.includes("accepted")),
    can_advance_status:
      normalizedStatus === "material_ready_for_dispatch" ||
      normalizedStatus.includes("ready_for_dispatch") ||
      normalizedStatus === "out_for_delivery",
    can_confirm_delivery:
      normalizedStatus === "arrived_at_site" || normalizedStatus === "arrived",
    can_update_location: normalizedStatus === "out_for_delivery",
  };
}

function resolveMaterialOrderId(payload: Record<string, unknown>): string {
  const id = pickString(payload, [
    "order_id",
    "orderId",
    "material_order_id",
    "materialOrderId",
    "parent_order_id",
    "parentOrderId",
    "id",
    "order_uuid",
    "uuid",
  ]);
  if (id) return id;
  const numericId = payload.id ?? payload.order_id;
  if (typeof numericId === "number" && !Number.isNaN(numericId)) {
    return String(numericId);
  }
  return pickString(payload, ["order_number", "orderNumber", "reference"]) ?? "";
}

function normalizeMaterialOrderListItem(
  raw: Record<string, unknown>
): MaterialOrderListItem {
  const payload = unwrapOrderPayload(raw);
  const customerFields = extractCustomerFields(payload);
  const delivery = payload.delivery as Record<string, unknown> | null | undefined;
  const deliverTo = normalizeDeliverTo(payload);
  const bill = normalizeBillSummary(payload);
  const rawItems = payload.items ?? payload.line_items ?? payload.order_items;
  const itemCount = Array.isArray(rawItems)
    ? rawItems.length
    : pickNumber(payload, ["item_count", "items_count", "line_count"]);
  const lineItems = enrichLineItemsWithOrderImage(
    Array.isArray(rawItems)
      ? rawItems
          .map((item) =>
            normalizeLineItem(
              item && typeof item === "object" ? (item as Record<string, unknown>) : {}
            )
          )
          .filter((item) => Boolean(item.id) || item.product_name !== "Material item")
      : [],
    payload
  );

  const orderId = resolveMaterialOrderId(payload);
  const grandTotal = bill.grand_total ? Number(bill.grand_total) : 0;

  return {
    id: orderId,
    order_number: String(
      payload.order_number ?? payload.orderNumber ?? payload.reference ?? orderId
    ),
    status: String(payload.status ?? payload.order_status ?? "confirmed"),
    status_label: pickString(payload, ["status_label", "statusLabel"]),
    customer_name: customerFields.name,
    customer_phone: customerFields.phone,
    customer_email: customerFields.email,
    delivery_address: pickRicherText(
      pickString(payload, ["delivery_address", "deliveryAddress", "shipping_address", "address"]),
      deliverTo.full_address
    ) ??
      extractAddressFromUnknown(delivery) ??
      pickString(delivery ?? {}, ["address", "full_address", "line1"]),
    item_count: lineItems.length > 0 ? lineItems.length : itemCount,
    total_amount:
      grandTotal > 0
        ? grandTotal
        : pickNumber(payload, [
            "total_amount",
            "totalAmount",
            "grand_total",
            "total_bill",
            "bill_total",
            "amount",
          ]),
    created_at: String(payload.created_at ?? payload.placed_at ?? payload.order_date ?? ""),
    scheduled_date:
      pickString(payload, ["estimated_delivery_date", "scheduled_date", "scheduledDate"]) ??
      pickString(delivery ?? {}, ["scheduled_date", "date"]),
    items: lineItems,
  };
}

type MaterialCatalogImageIndex = {
  bySlug: Map<string, string>;
  byId: Map<string, string>;
  byName: Map<string, string>;
};

let catalogImageIndexPromise: Promise<MaterialCatalogImageIndex | null> | null = null;
let catalogImageIndexLoadedAt = 0;
const CATALOG_IMAGE_INDEX_TTL_MS = 5 * 60 * 1000;

function normalizeCatalogLookupKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function indexCatalogProduct(
  index: MaterialCatalogImageIndex,
  raw: Record<string, unknown>
): void {
  const imageUrl = pickMaterialImageUrl(raw);
  if (!imageUrl) return;

  const slug = normalizeCatalogLookupKey(
    pickString(raw, ["slug", "product_slug", "productSlug"])
  );
  const id = pickString(raw, ["id", "product_id", "productId"]);
  const name = normalizeCatalogLookupKey(
    pickString(raw, ["name", "product_name", "productName", "title"])
  );

  if (slug) index.bySlug.set(slug, imageUrl);
  if (id) index.byId.set(id, imageUrl);
  if (name) index.byName.set(name, imageUrl);
}

async function loadMaterialCatalogImageIndex(
  headers: HeadersInit
): Promise<MaterialCatalogImageIndex | null> {
  const now = Date.now();
  if (
    catalogImageIndexPromise &&
    now - catalogImageIndexLoadedAt < CATALOG_IMAGE_INDEX_TTL_MS
  ) {
    return catalogImageIndexPromise;
  }

  catalogImageIndexLoadedAt = now;
  catalogImageIndexPromise = (async () => {
    try {
      const response = await fetch(`${MATERIAL_API_BASE_URL}/materials/categories`, {
        headers,
        cache: "no-store",
      });
      if (!response.ok) return null;

      const body = (await response.json()) as
        | ApiSuccessBody<Record<string, unknown>>
        | Record<string, unknown>;
      const data = (
        "success" in body && body.success && "data" in body ? body.data : body
      ) as Record<string, unknown>;
      const categories = (data.categories ?? data) as unknown;
      if (!Array.isArray(categories)) return null;

      const index: MaterialCatalogImageIndex = {
        bySlug: new Map(),
        byId: new Map(),
        byName: new Map(),
      };

      for (const parent of categories) {
        if (!parent || typeof parent !== "object") continue;
        const parentRecord = parent as Record<string, unknown>;
        indexCatalogProduct(index, parentRecord);

        const children = parentRecord.children;
        if (!Array.isArray(children)) continue;

        for (const child of children) {
          if (!child || typeof child !== "object") continue;
          const childRecord = child as Record<string, unknown>;
          const slug = pickString(childRecord, ["slug"]);
          if (!slug) continue;

          const productsResponse = await fetch(
            `${MATERIAL_API_BASE_URL}/materials/categories/${encodeURIComponent(slug)}/products`,
            { headers, cache: "no-store" }
          );
          if (!productsResponse.ok) continue;

          const productsBody = (await productsResponse.json()) as
            | ApiSuccessBody<Record<string, unknown>>
            | Record<string, unknown>;
          const productsData = (
            "success" in productsBody &&
            productsBody.success &&
            "data" in productsBody
              ? productsBody.data
              : productsBody
          ) as Record<string, unknown>;
          const products = productsData.products ?? productsData.items ?? productsData;
          if (!Array.isArray(products)) continue;

          for (const product of products) {
            if (!product || typeof product !== "object") continue;
            indexCatalogProduct(index, product as Record<string, unknown>);
          }
        }
      }

      return index.bySlug.size + index.byId.size + index.byName.size > 0 ? index : null;
    } catch {
      return null;
    }
  })();

  return catalogImageIndexPromise;
}

function slugifyMaterialProductName(name: string | null | undefined): string | null {
  const trimmed = name?.trim().toLowerCase();
  if (!trimmed) return null;
  const slug = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

async function fetchCatalogProductImageBySlug(
  headers: HeadersInit,
  slug: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${MATERIAL_API_BASE_URL}/materials/products/${encodeURIComponent(slug)}`,
      { headers, cache: "no-store" }
    );
    if (!response.ok) return null;

    const body = (await response.json()) as
      | ApiSuccessBody<Record<string, unknown>>
      | Record<string, unknown>;
    const data = (
      "success" in body && body.success && "data" in body ? body.data : body
    ) as Record<string, unknown>;
    return pickMaterialImageUrl(data);
  } catch {
    return null;
  }
}

function resolveCatalogImageForLineItem(
  item: MaterialOrderLineItem,
  index: MaterialCatalogImageIndex
): string | null {
  const slug = normalizeCatalogLookupKey(item.product_slug);
  if (slug && index.bySlug.has(slug)) return index.bySlug.get(slug) ?? null;
  if (item.product_id && index.byId.has(item.product_id)) {
    return index.byId.get(item.product_id) ?? null;
  }
  const name = normalizeCatalogLookupKey(item.product_name);
  if (name && index.byName.has(name)) return index.byName.get(name) ?? null;
  return null;
}

async function enrichLineItemWithCatalogImage(
  item: MaterialOrderLineItem,
  index: MaterialCatalogImageIndex | null,
  headers: HeadersInit,
  slugCache: Map<string, string | null>
): Promise<MaterialOrderLineItem> {
  if (item.product_image_url) return item;

  if (index) {
    const imageUrl = resolveCatalogImageForLineItem(item, index);
    if (imageUrl) return { ...item, product_image_url: imageUrl };
  }

  const slugCandidates = [
    item.product_slug,
    slugifyMaterialProductName(item.product_name),
  ].filter((value): value is string => Boolean(value));

  for (const slug of slugCandidates) {
    if (!slugCache.has(slug)) {
      slugCache.set(slug, await fetchCatalogProductImageBySlug(headers, slug));
    }
    const imageUrl = slugCache.get(slug);
    if (imageUrl) return { ...item, product_image_url: imageUrl };
  }

  return item;
}

async function enrichOrderWithCatalogImages(
  order: MaterialOrderListItem,
  index: MaterialCatalogImageIndex | null,
  headers: HeadersInit,
  slugCache: Map<string, string | null>
): Promise<MaterialOrderListItem> {
  if (!order.items?.length) return order;
  const items = await Promise.all(
    order.items.map((item) => enrichLineItemWithCatalogImage(item, index, headers, slugCache))
  );
  return items.some((item) => Boolean(item.product_image_url)) ? { ...order, items } : order;
}

async function enrichVendorOrdersSnapshotWithCatalogImages(
  snapshot: VendorOrdersSnapshot,
  headers: HeadersInit
): Promise<VendorOrdersSnapshot> {
  const needsCatalogImage = [...snapshot.available, ...snapshot.active, ...snapshot.completed].some(
    (order) => order.items?.some((item) => !item.product_image_url)
  );
  if (!needsCatalogImage) return snapshot;

  const index = await loadMaterialCatalogImageIndex(headers);
  const slugCache = new Map<string, string | null>();
  const [available, active, completed] = await Promise.all([
    Promise.all(
      snapshot.available.map((order) =>
        enrichOrderWithCatalogImages(order, index, headers, slugCache)
      )
    ),
    Promise.all(
      snapshot.active.map((order) =>
        enrichOrderWithCatalogImages(order, index, headers, slugCache)
      )
    ),
    Promise.all(
      snapshot.completed.map((order) =>
        enrichOrderWithCatalogImages(order, index, headers, slugCache)
      )
    ),
  ]);

  return { available, active, completed };
}

async function enrichMaterialOrderDetailWithCatalogImages(
  detail: MaterialOrderDetail,
  headers: HeadersInit
): Promise<MaterialOrderDetail> {
  if (!detail.items.some((item) => !item.product_image_url)) return detail;
  const index = await loadMaterialCatalogImageIndex(headers);
  const slugCache = new Map<string, string | null>();
  const items = await Promise.all(
    detail.items.map((item) => enrichLineItemWithCatalogImage(item, index, headers, slugCache))
  );
  return { ...detail, items };
}

type VendorOrdersSnapshot = {
  available: MaterialOrderListItem[];
  active: MaterialOrderListItem[];
  completed: MaterialOrderListItem[];
};

let vendorOrdersSnapshotPromise: Promise<VendorOrdersSnapshot> | null = null;

export function invalidateVendorOrdersSnapshot(): void {
  vendorOrdersSnapshotPromise = null;
}

/** Always fetches fresh vendor orders (open_pool + assigned + completed) from the backend. */
export async function refreshVendorOrdersSnapshot(): Promise<VendorOrdersSnapshot> {
  invalidateVendorOrdersSnapshot();
  const snapshot = await loadVendorOrdersSnapshot();
  writeMaterialOrderListCaches([
    ...snapshot.available,
    ...snapshot.active,
    ...snapshot.completed,
  ]);
  return snapshot;
}

function unwrapVendorOrdersBuckets(data: Record<string, unknown>): Record<string, unknown> {
  if (
    Array.isArray(data.open_pool) ||
    Array.isArray(data.assigned) ||
    Array.isArray(data.completed) ||
    Array.isArray(data.available) ||
    Array.isArray(data.active)
  ) {
    return data;
  }

  for (const key of ["orders", "vendor_orders", "vendorOrders"]) {
    const nested = data[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const obj = nested as Record<string, unknown>;
    if (
      Array.isArray(obj.open_pool) ||
      Array.isArray(obj.assigned) ||
      Array.isArray(obj.completed) ||
      Array.isArray(obj.available) ||
      Array.isArray(obj.active)
    ) {
      return obj;
    }
  }

  return data;
}

function resolveVendorOrderBucketArrays(
  data: Record<string, unknown>
): {
  open_pool: unknown[] | null;
  assigned: unknown[] | null;
  completed: unknown[] | null;
} {
  const source = unwrapVendorOrdersBuckets(data);
  const pickArray = (...keys: string[]): unknown[] | null => {
    for (const key of keys) {
      if (Array.isArray(source[key])) return source[key] as unknown[];
    }
    return null;
  };

  return {
    open_pool: pickArray("open_pool", "available", "open_pool_orders", "new_orders"),
    assigned: pickArray("assigned", "active", "active_orders", "in_progress"),
    completed: pickArray("completed", "completed_orders", "past", "history"),
  };
}

function mapVendorOrderBucket(
  rows: unknown[],
  normalize: (raw: Record<string, unknown>) => MaterialOrderListItem
): MaterialOrderListItem[] {
  return rows
    .map((row) =>
      normalize(row && typeof row === "object" ? (row as Record<string, unknown>) : {})
    )
    .filter((item) => Boolean(item.id) || Boolean(item.order_number));
}

function normalizeOpenPoolVendorOrder(raw: Record<string, unknown>): MaterialOrderListItem {
  const orderValue = raw.order_value;
  const bill = (raw.bill_summary ?? {}) as Record<string, unknown>;
  const amount =
    typeof orderValue === "number"
      ? orderValue
      : Number(orderValue) ||
        Number(bill.grand_total) ||
        pickNumber(raw, ["order_value", "total_amount", "grand_total"]);

  return normalizeMaterialOrderListItem({
    ...raw,
    order_id: raw.order_id ?? raw.id,
    order_number: raw.order_number,
    status: pickString(raw, ["status"]) ?? "pending_vendor_acceptance",
    destination_area: raw.destination_area,
    delivery_mode: raw.delivery_mode,
    delivery_address: raw.destination_area ?? raw.delivery_address,
    order_value: raw.order_value,
    total_amount: amount,
    grand_total: amount,
    created_at: raw.offered_at ?? raw.created_at ?? raw.placed_at,
    placed_at: raw.offered_at ?? raw.placed_at,
    items: raw.items,
    item_count: Array.isArray(raw.items) ? raw.items.length : 0,
  });
}

function normalizeAssignedVendorOrder(raw: Record<string, unknown>): MaterialOrderListItem {
  return normalizeMaterialOrderListItem({
    ...raw,
    order_id: raw.order_id ?? raw.id,
    order_number: raw.order_number,
    status: raw.status,
    status_label: raw.status_label,
    created_at: raw.accepted_at ?? raw.created_at,
    accepted_at: raw.accepted_at,
    customer_name: raw.customer_name,
    customer_phone: raw.customer_phone,
    customer_email: raw.customer_email,
    delivery_address: raw.delivery_address,
    delivery_mode: raw.delivery_mode,
    destination_area: raw.destination_area,
    deliver_to: raw.deliver_to,
    bill_summary: raw.bill_summary,
    payment: raw.payment,
    order_value: raw.order_value,
    items: raw.items,
  });
}

function normalizeCompletedVendorOrder(raw: Record<string, unknown>): MaterialOrderListItem {
  const orderValue = raw.order_value;
  const amount =
    typeof orderValue === "number"
      ? orderValue
      : Number(orderValue) || pickNumber(raw, ["order_value", "total_amount", "grand_total"]);

  return normalizeMaterialOrderListItem({
    ...raw,
    order_id: raw.order_id ?? raw.id,
    created_at: raw.completed_at ?? raw.delivered_at ?? raw.accepted_at ?? raw.created_at,
    delivery_address: raw.destination_area ?? raw.delivery_address,
    total_amount: amount > 0 ? amount : raw.total_amount,
    item_count: Array.isArray(raw.items) ? raw.items.length : raw.item_count,
  });
}

function paginateMaterialOrders(
  items: MaterialOrderListItem[],
  page: number,
  perPage: number
): { items: MaterialOrderListItem[]; pagination: MaterialPaginationMeta } {
  const start = (page - 1) * perPage;
  const slice = items.slice(start, start + perPage);
  const total = items.length;
  return {
    items: slice,
    pagination: {
      page,
      per_page: perPage,
      total_items: total,
      total_pages: perPage > 0 ? Math.ceil(total / perPage) : 0,
    },
  };
}

async function loadVendorOrdersSnapshot(): Promise<VendorOrdersSnapshot> {
  if (!vendorOrdersSnapshotPromise) {
    vendorOrdersSnapshotPromise = (async () => {
      const headers = materialAuthHeaders();
      const endpoints = [
        `${MATERIAL_API_BASE_URL}/materials/vendor/orders`,
        `${MATERIAL_API_BASE_URL}/vendor/orders`,
      ];
      let lastError: ApiRequestError | null = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { headers, cache: "no-store" });
          if (response.status === 404) continue;

          const body = (await response.json()) as
            | ApiSuccessBody<Record<string, unknown>>
            | ApiErrorBody
            | Record<string, unknown>;

          if (!response.ok || ("success" in body && body.success === false)) {
            const errorBody = body as ApiErrorBody;
            throw new ApiRequestError(
              errorBody.error?.message ?? "Something went wrong. Please try again.",
              errorBody.error?.code ?? "UNKNOWN_ERROR",
              response.status
            );
          }

          const data = unwrapVendorOrdersBuckets(
            ("success" in body && body.success && "data" in body ? body.data : body) as Record<
              string,
              unknown
            >
          );

          const buckets = resolveVendorOrderBucketArrays(data);

          if (
            buckets.open_pool ||
            buckets.assigned ||
            buckets.completed
          ) {
            const available = buckets.open_pool
              ? mapVendorOrderBucket(buckets.open_pool, normalizeOpenPoolVendorOrder)
              : [];

            const active = buckets.assigned
              ? mapVendorOrderBucket(buckets.assigned, normalizeAssignedVendorOrder)
              : [];

            const completed = buckets.completed
              ? mapVendorOrderBucket(buckets.completed, normalizeCompletedVendorOrder)
              : [];

            return enrichVendorOrdersSnapshotWithCatalogImages(
              { available, active, completed },
              headers
            );
          }

          throw new ApiRequestError(
            "Unexpected material vendor orders response.",
            "INVALID_RESPONSE",
            500
          );
        } catch (err) {
          if (err instanceof ApiRequestError) {
            lastError = err;
            if (err.status === 404) continue;
          } else if (err instanceof Error) {
            lastError = new ApiRequestError(err.message, "NETWORK_ERROR", 0);
          }
        }
      }

      throw (
        lastError ??
        new ApiRequestError("Material vendor orders not found.", "NOT_FOUND", 404)
      );
    })();
  }

  try {
    return await vendorOrdersSnapshotPromise;
  } catch (err) {
    vendorOrdersSnapshotPromise = null;
    throw err;
  }
}

function materialOrderDetailFromListItem(list: MaterialOrderListItem): MaterialOrderDetail {
  return finalizeCustomerAndDelivery(
    normalizeMaterialOrderDetail({
      order_id: list.id,
      id: list.id,
      order_number: list.order_number,
      status: list.status,
      status_label: list.status_label,
      customer_name: list.customer_name,
      customer_phone: list.customer_phone,
      customer_email: list.customer_email,
      delivery_address: list.delivery_address,
      items: list.items,
      item_count: list.item_count,
      total_amount: list.total_amount,
      created_at: list.created_at,
      scheduled_date: list.scheduled_date,
      available_actions: normalizeAvailableActions({}, list.status),
    })
  );
}

export function normalizeMaterialOrderDetail(
  raw: Record<string, unknown>
): MaterialOrderDetail {
  const payload = unwrapOrderPayload(raw);
  const list = normalizeMaterialOrderListItem(payload);
  const customerFields = extractCustomerFields(payload);
  const rawItems = payload.items ?? payload.line_items ?? payload.order_items;
  const items = enrichLineItemsWithOrderImage(
    Array.isArray(rawItems)
      ? rawItems
          .map((item) =>
            normalizeLineItem(
              item && typeof item === "object" ? (item as Record<string, unknown>) : {}
            )
          )
          .filter((item) => Boolean(item.id) || item.product_name !== "Material item")
      : list.items ?? [],
    payload
  );

  const bill = normalizeBillSummary(payload);
  const payment = normalizePayment(payload);
  const deliverTo = normalizeDeliverTo(payload);
  const orderId = String(payload.order_id ?? list.id);

  return {
    ...list,
    order_id: orderId,
    id: orderId,
    status_label:
      pickString(payload, ["status_label", "statusLabel"]) ?? list.status_label ?? list.status,
    delivery_mode:
      pickString(payload, ["delivery_mode", "deliveryMode"]) ??
      pickString(extractNestedRecord(payload, ["delivery"]) ?? {}, [
        "delivery_mode",
        "deliveryMode",
        "mode",
      ]),
    estimated_delivery_date: pickString(payload, [
      "estimated_delivery_date",
      "estimatedDeliveryDate",
    ]),
    items_count_label: pickString(payload, ["items_count_label", "itemsCountLabel"]),
    delivery_otp: pickString(payload, ["delivery_otp", "deliveryOtp"]),
    status_timeline: normalizeStatusTimeline(payload),
    deliver_to: deliverTo,
    bill_summary: bill,
    payment,
    item_count: items.length > 0 ? items.length : list.item_count,
    items,
    customer_name: pickRicherText(customerFields.name, list.customer_name),
    customer_phone: pickRicherText(customerFields.phone, list.customer_phone),
    customer_email: pickRicherText(customerFields.email, list.customer_email),
    po_number: pickString(payload, ["po_number", "poNumber"]),
    total_amount:
      bill.grand_total && !Number.isNaN(Number(bill.grand_total))
        ? Number(bill.grand_total)
        : list.total_amount,
    delivery_address:
      pickRicherText(list.delivery_address, deliverTo.full_address),
    available_actions: normalizeAvailableActions(payload, list.status),
  };
}

function isSkippableMaterialListError(err: ApiRequestError): boolean {
  if (err.status === 404 || err.status === 400 || err.status === 422) return true;
  if (err.code === "VALIDATION_ERROR") return true;
  const message = err.message.toLowerCase();
  return message.includes("tab") || message.includes("validation");
}

/** Backend-aligned Material Vendor API paths — only valid tab values (available/active/completed). */
function vendorOrderListEndpoints(
  tab: MaterialOrderTab,
  page: number,
  perPage: number
): string[] {
  const params = new URLSearchParams({
    tab,
    page: String(page),
    per_page: String(perPage),
  });
  const query = params.toString();

  return [
    `${MATERIAL_API_BASE_URL}/materials/vendor/orders?${query}`,
    `${MATERIAL_API_BASE_URL}/vendor/orders?${query}`,
  ];
}

function normalizeMaterialListItems(
  rawItems: Record<string, unknown>[],
  tab: MaterialOrderTab,
  isUnfilteredList: boolean
): MaterialOrderListItem[] {
  let items = rawItems
    .map(normalizeMaterialOrderListItem)
    .filter((item) => Boolean(item.id));

  if (isUnfilteredList) {
    items = items.filter((item) => classifyMaterialOrderTab(item.status) === tab);
  }

  return items;
}

function vendorOrderDetailEndpoints(orderId: string): string[] {
  return [
    `${MATERIAL_API_BASE_URL}/materials/vendor/orders/${orderId}`,
    `${MATERIAL_API_BASE_URL}/vendor/orders/${orderId}`,
    `${MATERIAL_API_BASE_URL}/materials/orders/${orderId}`,
  ];
}

function detailHasDeliveryInfo(detail: MaterialOrderDetail): boolean {
  return Boolean(
    detail.delivery_address?.trim() ||
      detail.deliver_to.full_address?.trim() ||
      detail.deliver_to.label?.trim()
  );
}

function isSkippableMaterialDetailError(err: ApiRequestError): boolean {
  if (err.status === 404 || err.status === 403) return true;
  if (err.code === "NOT_FOUND" || err.code === "FORBIDDEN") return true;
  return false;
}

async function fetchMaterialOrderDetailFromEndpoint(
  endpoint: string,
  headers: HeadersInit
): Promise<MaterialOrderDetail | null> {
  const response = await fetch(endpoint, { headers, cache: "no-store" });
  if (response.status === 404) return null;

  const body = (await response.json()) as
    | ApiSuccessBody<Record<string, unknown>>
    | ApiErrorBody
    | Record<string, unknown>;

  if (!response.ok || ("success" in body && body.success === false)) {
    const errorBody = body as ApiErrorBody;
    const code = errorBody.error?.code ?? "UNKNOWN_ERROR";
    if (isSkippableMaterialDetailError(
      new ApiRequestError(
        errorBody.error?.message ?? "Request failed.",
        code,
        response.status
      )
    )) {
      return null;
    }
    throw new ApiRequestError(
      errorBody.error?.message ?? "Something went wrong. Please try again.",
      code,
      response.status
    );
  }

  const data = (
    "success" in body && body.success && "data" in body ? body.data : body
  ) as Record<string, unknown>;

  return normalizeMaterialOrderDetail(data);
}

function supplementDetailFromListItem(
  detail: MaterialOrderDetail,
  list: MaterialOrderListItem
): MaterialOrderDetail {
  const listAddress = list.delivery_address?.trim() || null;
  const mergedAddress = pickRicherText(detail.delivery_address, listAddress);
  return {
    ...detail,
    customer_name: pickRicherText(detail.customer_name, list.customer_name),
    customer_phone: pickRicherText(detail.customer_phone, list.customer_phone),
    customer_email: pickRicherText(detail.customer_email, list.customer_email),
    delivery_address: mergedAddress,
    deliver_to: {
      ...detail.deliver_to,
      label: pickRicherText(detail.deliver_to.label, null),
      full_address: pickRicherText(detail.deliver_to.full_address, mergedAddress),
    },
    created_at: pickRicherText(detail.created_at, list.created_at) ?? detail.created_at,
    scheduled_date: pickRicherText(detail.scheduled_date, list.scheduled_date),
    total_amount:
      detail.total_amount > 0 ? detail.total_amount : list.total_amount,
  };
}

function detailNeedsListSupplement(detail: MaterialOrderDetail): boolean {
  if (!detail.customer_name?.trim()) return true;
  if (!detail.customer_phone?.trim()) return true;
  if (!detail.customer_email?.trim()) return true;
  if (!detailHasDeliveryInfo(detail)) return true;

  const address = pickRicherText(
    detail.deliver_to.full_address,
    detail.delivery_address
  );
  if (address && address.length < 20) return true;

  return false;
}

async function supplementDetailFromVendorLists(
  orderId: string,
  detail: MaterialOrderDetail
): Promise<MaterialOrderDetail> {
  if (!detailNeedsListSupplement(detail)) {
    return detail;
  }

  try {
    const items = await fetchVendorMaterialOrdersUnfiltered(100);
    const match = items.find(
      (item) =>
        item.id === orderId ||
        item.order_number === orderId ||
        item.id === detail.id ||
        item.order_number === detail.order_number
    );
    if (match) {
      return supplementDetailFromListItem(detail, match);
    }
  } catch {
    // fall through
  }

  return detail;
}

/** Next FSM status for POST /materials/vendor/orders/{id}/status. */
export function inferNextMaterialStatus(status: string): string | null {
  const normalized = status.toLowerCase();
  if (
    normalized === "material_ready_for_dispatch" ||
    normalized.includes("ready_for_dispatch")
  ) {
    return "out_for_delivery";
  }
  if (normalized === "out_for_delivery") {
    return "arrived_at_site";
  }
  return null;
}

/** Vendor action button label for the next status transition. */
export function getMaterialAdvanceActionLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (
    normalized === "material_ready_for_dispatch" ||
    normalized.includes("ready_for_dispatch")
  ) {
    return "Picked Up";
  }
  if (normalized === "out_for_delivery") {
    return "In Transit";
  }
  return "Update Status";
}

export interface MaterialVendorProfile {
  vendor_id: string | null;
  name: string | null;
  phone: string | null;
  is_linked: boolean;
}

function normalizeMaterialVendorProfile(raw: Record<string, unknown>): MaterialVendorProfile {
  const payload = unwrapOrderPayload(raw);
  const vendorId = pickString(payload, ["vendor_id", "vendorId", "id"]);
  const linkedRaw = payload.is_linked ?? payload.isLinked;
  const isLinked =
    typeof linkedRaw === "boolean" ? linkedRaw : Boolean(vendorId);

  return {
    vendor_id: vendorId,
    name: pickString(payload, ["name", "vendor_name", "vendorName", "display_name"]),
    phone: pickString(payload, ["phone", "phone_number", "mobile"]),
    is_linked: isLinked,
  };
}

async function parseMaterialVendorMe(response: Response): Promise<MaterialVendorProfile> {
  const body = (await response.json()) as
    | ApiSuccessBody<Record<string, unknown>>
    | ApiErrorBody
    | Record<string, unknown>;

  if (!response.ok || ("success" in body && body.success === false)) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? "Something went wrong. Please try again.",
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  const data = (
    "success" in body && body.success && "data" in body
      ? body.data
      : body
  ) as Record<string, unknown>;

  return normalizeMaterialVendorProfile(data);
}

export async function fetchMaterialVendorMe(): Promise<MaterialVendorProfile | null> {
  const headers = materialAuthHeaders();
  for (const endpoint of [
    `${MATERIAL_API_BASE_URL}/materials/vendor/me`,
    `${MATERIAL_API_BASE_URL}/vendor/me`,
  ]) {
    try {
      const response = await fetch(endpoint, { headers, cache: "no-store" });
      if (response.status === 404) continue;
      return await parseMaterialVendorMe(response);
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchMaterialVendorMeResult(): Promise<{
  profile: MaterialVendorProfile | null;
  apiError: ApiRequestError | null;
}> {
  const headers = materialAuthHeaders();
  let lastError: ApiRequestError | null = null;

  for (const endpoint of [
    `${MATERIAL_API_BASE_URL}/materials/vendor/me`,
    `${MATERIAL_API_BASE_URL}/vendor/me`,
  ]) {
    try {
      const response = await fetch(endpoint, { headers, cache: "no-store" });
      if (response.status === 404) continue;
      const profile = await parseMaterialVendorMe(response);
      return { profile, apiError: null };
    } catch (err) {
      if (err instanceof ApiRequestError) {
        lastError = err;
        if (err.status === 404) continue;
      }
      return {
        profile: null,
        apiError:
          err instanceof ApiRequestError
            ? err
            : new ApiRequestError(
                err instanceof Error ? err.message : "Profile request failed.",
                "NETWORK_ERROR",
                0
              ),
      };
    }
  }

  return { profile: null, apiError: lastError };
}

export async function fetchVendorMaterialOrdersUnfiltered(
  perPage = 100
): Promise<MaterialOrderListItem[]> {
  const tabs: MaterialOrderTab[] = ["available", "active", "completed"];
  const merged = new Map<string, MaterialOrderListItem>();

  for (const tab of tabs) {
    try {
      const { items } = await fetchVendorMaterialOrders(tab, 1, perPage);
      for (const item of items) {
        merged.set(item.id, item);
      }
    } catch {
      continue;
    }
  }

  return [...merged.values()].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

export function splitMaterialOrdersByTab(
  orders: MaterialOrderListItem[]
): Record<MaterialOrderTab, MaterialOrderListItem[]> {
  const buckets: Record<MaterialOrderTab, MaterialOrderListItem[]> = {
    available: [],
    active: [],
    completed: [],
  };
  for (const order of orders) {
    buckets[classifyMaterialOrderTab(order.status)].push(order);
  }
  return buckets;
}

export async function fetchVendorMaterialOrders(
  tab: MaterialOrderTab,
  page = 1,
  perPage = 20
): Promise<{ items: MaterialOrderListItem[]; pagination: MaterialPaginationMeta }> {
  try {
    const snapshot = await loadVendorOrdersSnapshot();
    const bucket =
      tab === "available"
        ? snapshot.available
        : tab === "active"
          ? snapshot.active
          : snapshot.completed;
    const result = paginateMaterialOrders(bucket, page, perPage);
    if (result.items.length > 0 || result.pagination.total_items > 0) {
      writeMaterialOrderListCaches(result.items);
    }
    return result;
  } catch (err) {
    if (err instanceof ApiRequestError && (err.status === 403 || err.code === "role_forbidden")) {
      throw err;
    }
  }

  const headers = materialAuthHeaders();
  let lastError: ApiRequestError | null = null;
  let hadSuccessfulResponse = false;
  const merged = new Map<string, MaterialOrderListItem>();
  let bestPagination: MaterialPaginationMeta = {
    page,
    per_page: perPage,
    total_items: 0,
    total_pages: 0,
  };

  for (const endpoint of vendorOrderListEndpoints(tab, page, perPage)) {
    try {
      const response = await fetch(endpoint, { headers, cache: "no-store" });
      if (response.status === 404) continue;
      if (response.ok) hadSuccessfulResponse = true;

      const { items: rawItems, pagination } = await parseMaterialPaginated<
        Record<string, unknown>
      >(response, tab);

      const items = normalizeMaterialListItems(rawItems, tab, false);
      for (const item of items) {
        merged.set(item.id, item);
      }

      if (materialListScore(items, pagination) > materialListScore([], bestPagination)) {
        bestPagination = {
          ...pagination,
          total_items: Math.max(pagination.total_items, items.length),
        };
      }

      if (merged.size > 0 && bestPagination.total_items > 0) {
        continue;
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (isSkippableMaterialListError(err)) continue;
        lastError = err;
      } else if (err instanceof Error) {
        lastError = new ApiRequestError(err.message, "NETWORK_ERROR", 0);
      }
    }
  }

  const items = [...merged.values()].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  if (items.length > 0) {
    writeMaterialOrderListCaches(items);
    return {
      items,
      pagination: {
        ...bestPagination,
        total_items: Math.max(bestPagination.total_items, items.length),
      },
    };
  }

  if (lastError && !hadSuccessfulResponse) {
    const validationLike =
      lastError.status === 422 ||
      lastError.code === "VALIDATION_ERROR" ||
      lastError.message.toLowerCase().includes("validation");
    if (validationLike) {
      return {
        items: [],
        pagination: bestPagination,
      };
    }
    throw lastError;
  }

  return {
    items: [],
    pagination: bestPagination,
  };
}

function sanitizeDeliverLabel(
  label: string | null | undefined,
  customerName: string | null | undefined
): string | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;
  const customer = customerName?.trim().toLowerCase();
  if (customer && trimmed.toLowerCase() === customer) return null;
  return trimmed;
}

function finalizeCustomerAndDelivery(detail: MaterialOrderDetail): MaterialOrderDetail {
  const fullAddress = pickRicherText(
    pickRicherText(detail.deliver_to.full_address, detail.delivery_address),
    null
  );

  return {
    ...detail,
    customer_name: detail.customer_name?.trim() || null,
    customer_phone: detail.customer_phone?.trim() || null,
    customer_email: detail.customer_email?.trim() || null,
    delivery_address: fullAddress,
    deliver_to: {
      ...detail.deliver_to,
      label: sanitizeDeliverLabel(detail.deliver_to.label, detail.customer_name),
      full_address: fullAddress,
    },
    delivery_mode: detail.delivery_mode?.trim() || null,
  };
}

function mergeMaterialOrderDetails(
  primary: MaterialOrderDetail,
  secondary: MaterialOrderDetail
): MaterialOrderDetail {
  return {
    ...primary,
    customer_name: pickRicherText(primary.customer_name, secondary.customer_name),
    customer_phone: pickRicherText(primary.customer_phone, secondary.customer_phone),
    customer_email: pickRicherText(primary.customer_email, secondary.customer_email),
    delivery_address: pickRicherText(primary.delivery_address, secondary.delivery_address),
    delivery_mode: pickRicherText(primary.delivery_mode, secondary.delivery_mode),
    estimated_delivery_date: pickRicherText(
      primary.estimated_delivery_date,
      secondary.estimated_delivery_date
    ),
    po_number: pickRicherText(primary.po_number, secondary.po_number),
    delivery_otp: pickRicherText(primary.delivery_otp, secondary.delivery_otp),
    items_count_label: pickRicherText(
      primary.items_count_label,
      secondary.items_count_label
    ),
    deliver_to: {
      type: primary.deliver_to.type || secondary.deliver_to.type,
      label: pickRicherText(
        sanitizeDeliverLabel(primary.deliver_to.label, primary.customer_name),
        sanitizeDeliverLabel(secondary.deliver_to.label, secondary.customer_name)
      ),
      full_address: pickRicherText(
        primary.deliver_to.full_address,
        secondary.deliver_to.full_address
      ),
    },
    bill_summary: {
      subtotal: pickRicherText(primary.bill_summary.subtotal, secondary.bill_summary.subtotal),
      tax_total: pickRicherText(primary.bill_summary.tax_total, secondary.bill_summary.tax_total),
      shipping_total: pickRicherText(
        primary.bill_summary.shipping_total,
        secondary.bill_summary.shipping_total
      ),
      coupon_discount: pickRicherText(
        primary.bill_summary.coupon_discount,
        secondary.bill_summary.coupon_discount
      ),
      grand_total: pickRicherText(
        primary.bill_summary.grand_total,
        secondary.bill_summary.grand_total
      ),
    },
    payment: {
      method: primary.payment.method || secondary.payment.method,
      collect_amount: pickRicherText(
        primary.payment.collect_amount,
        secondary.payment.collect_amount
      ),
      paid: primary.payment.paid || secondary.payment.paid,
    },
    items: mergeMaterialOrderLineItems(primary.items, secondary.items),
    item_count: Math.max(primary.item_count, secondary.item_count),
    status_timeline:
      primary.status_timeline.length >= secondary.status_timeline.length
        ? primary.status_timeline
        : secondary.status_timeline,
    available_actions: {
      can_accept: primary.available_actions.can_accept || secondary.available_actions.can_accept,
      can_reject: primary.available_actions.can_reject || secondary.available_actions.can_reject,
      can_mark_qc:
        primary.available_actions.can_mark_qc || secondary.available_actions.can_mark_qc,
      can_advance_status:
        primary.available_actions.can_advance_status ||
        secondary.available_actions.can_advance_status,
      can_confirm_delivery:
        primary.available_actions.can_confirm_delivery ||
        secondary.available_actions.can_confirm_delivery,
      can_update_location:
        primary.available_actions.can_update_location ||
        secondary.available_actions.can_update_location,
    },
    total_amount: Math.max(primary.total_amount, secondary.total_amount),
  };
}

export async function fetchVendorMaterialOrderDetail(
  orderId: string
): Promise<MaterialOrderDetail> {
  const headers = materialAuthHeaders();
  let lastError: ApiRequestError | null = null;
  let merged: MaterialOrderDetail | null = null;

  const endpoints = vendorOrderDetailEndpoints(orderId);
  const results = await Promise.allSettled(
    endpoints.map((endpoint) => fetchMaterialOrderDetailFromEndpoint(endpoint, headers))
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (!result.value) continue;
      merged = merged
        ? mergeMaterialOrderDetails(merged, result.value)
        : result.value;
      continue;
    }

    if (result.reason instanceof ApiRequestError) {
      if (isSkippableMaterialDetailError(result.reason)) continue;
      lastError = result.reason;
    } else if (result.reason instanceof Error) {
      lastError = new ApiRequestError(result.reason.message, "NETWORK_ERROR", 0);
    }
  }

  if (merged) {
    const cached = readMaterialOrderListCache(orderId);
    if (cached) {
      merged = supplementDetailFromListItem(merged, cached);
    }
    merged = await supplementDetailFromVendorLists(orderId, merged);
    merged = await enrichMaterialOrderDetailWithCatalogImages(merged, headers);
    return finalizeCustomerAndDelivery(merged);
  }

  try {
    const listItems = await fetchVendorMaterialOrdersUnfiltered(100);
    const match = listItems.find(
      (item) => item.id === orderId || item.order_number === orderId
    );
    if (match) {
      return materialOrderDetailFromListItem(match);
    }
  } catch {
    // fall through
  }

  if (lastError) throw lastError;
  throw new ApiRequestError("Material order not found.", "NOT_FOUND", 404);
}

export async function fetchVendorMaterialOrderCounts(): Promise<{
  available: number;
  active: number;
  completed: number;
}> {
  try {
    const snapshot = await loadVendorOrdersSnapshot();
    return {
      available: snapshot.available.length,
      active: snapshot.active.length,
      completed: snapshot.completed.length,
    };
  } catch {
    return { available: 0, active: 0, completed: 0 };
  }
}

async function postVendorFulfillment(
  orderId: string,
  action: string,
  body?: Record<string, unknown>
): Promise<{ order_id: string; status: string }> {
  const headers = materialAuthHeaders();
  const endpoints = [
    `${MATERIAL_API_BASE_URL}/materials/vendor/orders/${orderId}/${action}`,
    `${MATERIAL_API_BASE_URL}/vendor/orders/${orderId}/${action}`,
  ];
  let lastError: ApiRequestError | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
      });
      if (response.status === 404) continue;
      const result = await parseMaterialData<{ order_id: string; status: string }>(response);
      invalidateVendorOrdersSnapshot();
      return result;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        lastError = err;
        if (err.status === 404) continue;
      } else if (err instanceof Error) {
        lastError = new ApiRequestError(err.message, "NETWORK_ERROR", 0);
      }
    }
  }

  if (lastError) throw lastError;
  throw new ApiRequestError("Material vendor action failed.", "ACTION_FAILED", 500);
}

async function postMaterialOrderStatus(
  orderId: string,
  toStatus: string,
  note?: string
): Promise<{ order_id: string; status: string }> {
  try {
    return await postVendorFulfillment(orderId, "status", {
      to_status: toStatus,
      note: note ?? null,
    });
  } catch (err) {
    if (!(err instanceof ApiRequestError) || err.status !== 404) {
      throw err;
    }
  }

  const response = await fetch(
    `${MATERIAL_API_BASE_URL}/materials/orders/${orderId}/status`,
    {
      method: "POST",
      headers: materialAuthHeaders(),
      body: JSON.stringify({ to_status: toStatus, note: note ?? null }),
    }
  );
  return parseMaterialData(response);
}

async function postVendorOrderAction(
  orderId: string,
  action: "accept" | "reject",
  body?: Record<string, unknown>
): Promise<{ order_id: string; status: string }> {
  const headers = materialAuthHeaders();
  const endpoints = [
    `${MATERIAL_API_BASE_URL}/materials/vendor/orders/${orderId}/${action}`,
    `${MATERIAL_API_BASE_URL}/vendor/orders/${orderId}/${action}`,
  ];
  let lastError: ApiRequestError | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
      });

      if (response.status === 404) continue;

      const result = await parseMaterialData<{ order_id: string; status: string }>(response);
      invalidateVendorOrdersSnapshot();
      return result;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (isMaterialOrderAlreadyTakenError(err)) throw err;
        lastError = err;
        if (err.status === 404) continue;
      } else if (err instanceof Error) {
        lastError = new ApiRequestError(err.message, "NETWORK_ERROR", 0);
      }
    }
  }

  if (lastError) throw lastError;
  throw new ApiRequestError("Material order action failed.", "ACTION_FAILED", 500);
}

export async function markMaterialOrderQcReady(
  orderId: string
): Promise<{ order_id: string; status: string }> {
  try {
    return await postVendorFulfillment(orderId, "qc");
  } catch (err) {
    if (err instanceof ApiRequestError && err.status !== 404) {
      throw err;
    }
  }
  return postMaterialOrderStatus(orderId, "material_ready_for_dispatch");
}

export async function advanceMaterialOrderStatus(
  orderId: string,
  toStatus: string
): Promise<{ order_id: string; status: string }> {
  const nextStatus = toStatus.trim();
  if (!nextStatus) {
    throw new ApiRequestError(
      "Next order status is required.",
      "INVALID_STATUS_TRANSITION",
      400
    );
  }
  return postMaterialOrderStatus(orderId, nextStatus);
}

export async function updateMaterialOrderLocation(
  orderId: string,
  lat: number,
  lng: number
): Promise<{ order_id: string; lat: number; lng: number }> {
  const headers = materialAuthHeaders();
  const endpoints = [
    `${MATERIAL_API_BASE_URL}/materials/vendor/orders/${orderId}/location`,
    `${MATERIAL_API_BASE_URL}/vendor/orders/${orderId}/location`,
  ];
  let lastError: ApiRequestError | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ lat, lng }),
      });
      if (response.status === 404) continue;
      return parseMaterialData<{ order_id: string; lat: number; lng: number }>(response);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        lastError = err;
        if (err.status === 404) continue;
      } else if (err instanceof Error) {
        lastError = new ApiRequestError(err.message, "NETWORK_ERROR", 0);
      }
    }
  }

  if (lastError) throw lastError;
  throw new ApiRequestError("Failed to update order location.", "LOCATION_UPDATE_FAILED", 500);
}

export async function confirmMaterialOrderDelivery(
  orderId: string,
  otp: string
): Promise<{ order_id: string; status: string }> {
  try {
    return await postVendorFulfillment(orderId, "confirm-delivery", { otp });
  } catch (err) {
    if (err instanceof ApiRequestError && err.status !== 404) {
      throw err;
    }
  }

  const response = await fetch(
    `${MATERIAL_API_BASE_URL}/materials/orders/${orderId}/confirm-delivery`,
    {
      method: "POST",
      headers: materialAuthHeaders(),
      body: JSON.stringify({ otp }),
    }
  );
  return parseMaterialData(response);
}

export async function acceptMaterialOrder(
  orderId: string
): Promise<{ order_id: string; status: string }> {
  return postVendorOrderAction(orderId, "accept");
}

export async function rejectMaterialOrder(
  orderId: string,
  reason?: string
): Promise<{ order_id: string; status: string }> {
  return postVendorOrderAction(orderId, "reject", reason ? { reason } : undefined);
}

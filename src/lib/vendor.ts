import {
  API_BASE_URL,
  RENTAL_API_BASE_URL,
  ApiRequestError,
  type ApiErrorBody,
  type ApiSuccessBody,
} from "@/lib/api";
import { getVendorSession } from "@/lib/auth";

export type BookingTab = "available" | "active" | "completed";

export interface VendorProfile {
  vendor_id: string | null;
  name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  user_id: string;
  is_linked: boolean;
}

export interface VendorBookingListItem {
  id: string;
  booking_number: string;
  sku_name: string | null;
  sku_slug: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  site_address: string | null;
  total_amount: number;
  created_at: string;
}

export interface AvailableActions {
  can_accept: boolean;
  can_reject?: boolean;
  can_update_location: boolean;
  can_verify_start_otp: boolean;
  can_verify_end_otp: boolean;
  can_approve_extension?: boolean;
  can_reject_extension?: boolean;
}

export interface PendingExtension {
  id: string;
  extension_hours: number;
  extension_amount: number;
  status: string;
  response_deadline: string | null;
  created_at?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  is_paid?: boolean;
  payment_method?: string | null;
}

export interface BookingDocumentRef {
  name: string;
  url: string;
  type?: string;
}

export interface VendorBookingDetail {
  id: string;
  booking_number: string;
  status: string;
  sku: { id: string; name: string; slug: string } | null;
  equipment_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  site_address: string | null;
  site_lat: number | null;
  site_lng: number | null;
  pickup_address: string | null;
  delivery_address: string | null;
  work_type: string | null;
  sender_name: string | null;
  sender_contact: string | null;
  receiver_name: string | null;
  receiver_contact: string | null;
  total_amount: number;
  created_at: string;
  available_actions: AvailableActions;
  pending_extension: PendingExtension | null;
  /** Optional fields returned by API — passed through by normalizeVendorBookingDetail */
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_contact?: string | null;
  security_deposit?: number | null;
  payment_status?: string | null;
  vendor_notes?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  confirmed_at?: string | null;
  documents?: BookingDocumentRef[] | null;
  agreement_url?: string | null;
  invoice_url?: string | null;
  receipt_url?: string | null;
  site_image_url?: string | null;
  site_image_urls?: string[] | null;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

interface PaginatedApiBody<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

function authHeaders(): HeadersInit {
  const session = getVendorSession();
  if (!session?.accessToken) {
    throw new ApiRequestError("Session expired. Please sign in again.", "UNAUTHORIZED", 401);
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessToken}`,
  };
}

async function parseData<T>(response: Response): Promise<T> {
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

function normalizePagination(
  raw: Record<string, unknown> | PaginationMeta | undefined,
  fallbackCount: number
): PaginationMeta {
  const p = (raw ?? {}) as Record<string, unknown>;
  const page = Number(p.page ?? 1);
  const perPage = Number(p.per_page ?? p.perPage ?? 20);
  const totalItems = Number(p.total_items ?? p.totalItems ?? fallbackCount);
  const totalPages = Number(
    p.total_pages ?? p.totalPages ?? (perPage > 0 ? Math.ceil(totalItems / perPage) : 0)
  );
  return { page, per_page: perPage, total_items: totalItems, total_pages: totalPages };
}

async function parsePaginated<T>(
  response: Response
): Promise<{ items: T[]; pagination: PaginationMeta }> {
  const body = (await response.json()) as
    | PaginatedApiBody<T>
    | { success: true; data: { items?: T[]; pagination?: PaginationMeta } }
    | ApiErrorBody;

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? "Something went wrong. Please try again.",
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  const ok = body as {
    success: true;
    data: T[] | { items?: T[]; pagination?: PaginationMeta };
    pagination?: PaginationMeta;
  };

  const rawData = ok.data;
  let items: T[] = [];
  let paginationSource: Record<string, unknown> | PaginationMeta | undefined =
    ok.pagination;

  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (rawData && typeof rawData === "object") {
    const nested = rawData as { items?: T[]; pagination?: PaginationMeta };
    items = Array.isArray(nested.items) ? nested.items : [];
    paginationSource = nested.pagination ?? ok.pagination;
  }

  const pagination = normalizePagination(paginationSource, items.length);

  return { items, pagination };
}

export function normalizeVendorBookingListItem(
  raw: Record<string, unknown>
): VendorBookingListItem {
  const sku = raw.sku as Record<string, unknown> | null | undefined;
  return {
    id: String(raw.id ?? raw.booking_id ?? ""),
    booking_number: String(raw.booking_number ?? ""),
    sku_name:
      (raw.sku_name as string | null | undefined) ??
      (sku?.name as string | null | undefined) ??
      null,
    sku_slug:
      (raw.sku_slug as string | null | undefined) ??
      (sku?.slug as string | null | undefined) ??
      null,
    status: String(raw.status ?? "confirmed"),
    scheduled_start: String(raw.scheduled_start ?? ""),
    scheduled_end: String(raw.scheduled_end ?? ""),
    site_address: (raw.site_address as string | null) ?? null,
    total_amount: Number(raw.total_amount ?? 0),
    created_at: String(raw.created_at ?? ""),
  };
}

export async function fetchVendorMe(): Promise<VendorProfile> {
  const response = await fetch(`${RENTAL_API_BASE_URL}/vendor/me`, {
    headers: authHeaders(),
  });
  return parseData<VendorProfile>(response);
}

export async function fetchVendorBookings(
  tab: BookingTab,
  page = 1,
  perPage = 20
): Promise<{ items: VendorBookingListItem[]; pagination: PaginationMeta }> {
  const params = new URLSearchParams({
    tab,
    page: String(page),
    per_page: String(perPage),
  });
  const response = await fetch(`${RENTAL_API_BASE_URL}/vendor/bookings?${params}`, {
    headers: authHeaders(),
  });
  const { items, pagination } = await parsePaginated<Record<string, unknown>>(response);
  return {
    items: items
      .map(normalizeVendorBookingListItem)
      .filter((item) => Boolean(item.id)),
    pagination,
  };
}

export async function fetchVendorBookingDetail(
  bookingId: string
): Promise<VendorBookingDetail> {
  const response = await fetch(`${RENTAL_API_BASE_URL}/vendor/bookings/${bookingId}`, {
    headers: authHeaders(),
  });
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

  const normalized = normalizeVendorBookingDetail(data);
  const urls = extractSiteImageUrlsFromApiBody(body);

  if (urls.length === 0) {
    return normalized;
  }

  return {
    ...normalized,
    site_image_url: urls[0],
    site_image_urls: urls,
  };
}

function rentalsBookingDetailEndpoints(bookingId: string): string[] {
  const endpoints: string[] = [];
  const customBase = process.env.NEXT_PUBLIC_TRACKING_API_BASE_URL?.replace(/\/$/, "");
  if (customBase) {
    endpoints.push(`${customBase}/rentals/bookings/${bookingId}`);
  }
  if (process.env.NEXT_PUBLIC_TRACKING_USE_RENTAL_API === "true") {
    endpoints.push(`${RENTAL_API_BASE_URL}/rentals/bookings/${bookingId}`);
  }
  endpoints.push(
    `${API_BASE_URL}/rentals/bookings/${bookingId}`,
    `${RENTAL_API_BASE_URL}/rentals/bookings/${bookingId}`,
    `${RENTAL_API_BASE_URL}/vendor/bookings/${bookingId}`
  );
  return [...new Set(endpoints)];
}

async function siteImageUrlsFromResponse(response: Response): Promise<string[]> {
  if (!response.ok) return [];
  const body = (await response.json()) as ApiSuccessBody<unknown> | Record<string, unknown>;
  if ("success" in body && body.success === false) return [];
  return extractSiteImageUrlsFromApiBody(body);
}

/** Rentals booking detail includes site_image_urls; vendor detail may omit them. */
export async function fetchBookingSiteImageUrls(bookingId: string): Promise<string[]> {
  const headers = authHeaders();

  for (const endpoint of rentalsBookingDetailEndpoints(bookingId)) {
    try {
      const urls = await siteImageUrlsFromResponse(
        await fetch(endpoint, { headers, cache: "no-store" })
      );
      if (urls.length > 0) return urls;
    } catch {
      // Try the next booking detail endpoint.
    }
  }

  for (const tab of ["available", "active", "completed"] as BookingTab[]) {
    try {
      const params = new URLSearchParams({ tab, page: "1", per_page: "100" });
      const response = await fetch(`${RENTAL_API_BASE_URL}/vendor/bookings?${params}`, {
        headers,
        cache: "no-store",
      });
      if (!response.ok) continue;
      const body = (await response.json()) as PaginatedApiBody<Record<string, unknown>>;
      const match = body.data.find(
        (item) => String(item.id ?? item.booking_id ?? "") === bookingId
      );
      if (!match) continue;
      const urls = extractSiteImageUrlsFromApiBody(match);
      if (urls.length > 0) return urls;
    } catch {
      // Try the next vendor bookings tab.
    }
  }

  return [];
}

export async function acceptBooking(bookingId: string): Promise<{
  booking_id: string;
  status: string;
  equipment_id: string;
}> {
  const response = await fetch(
    `${RENTAL_API_BASE_URL}/vendor/bookings/${bookingId}/accept`,
    { method: "POST", headers: authHeaders() }
  );
  return parseData(response);
}

export async function rejectBooking(
  bookingId: string,
  reason?: string
): Promise<{ booking_id: string; status: string }> {
  const response = await fetch(
    `${RENTAL_API_BASE_URL}/vendor/bookings/${bookingId}/reject`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(reason ? { reason } : {}),
    }
  );
  return parseData(response);
}

export async function updateEquipmentLocation(
  equipmentId: string,
  lat: number,
  lng: number
): Promise<{ equipment_id: string; lat: number; lng: number; auto_arrived: boolean }> {
  const response = await fetch(
    `${RENTAL_API_BASE_URL}/vendor/equipment/${equipmentId}/location`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ lat, lng }),
    }
  );
  return parseData(response);
}

export async function verifyStartOtp(
  bookingId: string,
  otp: string
): Promise<{ booking_id: string; status: string }> {
  const response = await fetch(
    `${RENTAL_API_BASE_URL}/vendor/bookings/${bookingId}/verify-start-otp`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ otp }),
    }
  );
  return parseData(response);
}

export async function verifyEndOtp(
  bookingId: string,
  otp: string,
  options?: { odometer_end?: number; actual_km?: number }
): Promise<{ booking_id: string; status: string }> {
  const response = await fetch(
    `${RENTAL_API_BASE_URL}/vendor/bookings/${bookingId}/verify-end-otp`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ otp, ...options }),
    }
  );
  return parseData(response);
}

export interface VendorExtension {
  id: string;
  booking_id: string;
  booking_number: string;
  extension_hours: number;
  extension_amount: number;
  status: string;
  response_deadline: string | null;
  created_at: string;
  paid_at?: string | null;
  is_paid?: boolean;
  payment_method?: string | null;
  sku_name?: string | null;
  sku_slug?: string | null;
  equipment_id?: string | null;
  site_address?: string | null;
  scheduled_start?: string;
  scheduled_end?: string;
  approved_at?: string | null;
  updated_at?: string | null;
}

function pickStringField(
  raw: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function hasTruthyPaidTimestamp(raw: Record<string, unknown>): boolean {
  const value =
    raw.paid_at ??
    raw.paidAt ??
    raw.payment_at ??
    raw.payment_completed_at ??
    raw.extension_paid_at ??
    raw.extensionPaidAt;
  return value != null && value !== "";
}

function flattenExtensionPaymentSource(raw: Record<string, unknown>): Record<string, unknown> {
  let merged = { ...raw };
  if (raw.extension && typeof raw.extension === "object") {
    merged = { ...merged, ...(raw.extension as Record<string, unknown>) };
  }
  for (const key of ["payment", "extension_payment", "extensionPayment"]) {
    const nested = raw[key];
    if (nested && typeof nested === "object") {
      merged = { ...merged, ...(nested as Record<string, unknown>) };
    }
  }
  return merged;
}

function flattenExtensionRawSource(raw: Record<string, unknown>): Record<string, unknown> {
  let merged = flattenExtensionPaymentSource(raw);
  if (raw.booking && typeof raw.booking === "object") {
    merged = { ...merged, ...(raw.booking as Record<string, unknown>) };
  }
  return merged;
}

function parseExtensionVehicleFields(
  source: Record<string, unknown>
): Pick<
  VendorExtension,
  | "sku_name"
  | "sku_slug"
  | "equipment_id"
  | "site_address"
  | "scheduled_start"
  | "scheduled_end"
> {
  const sku = source.sku as Record<string, unknown> | null | undefined;
  const equipment = source.equipment as Record<string, unknown> | null | undefined;

  return {
    sku_name:
      pickStringField(source, ["sku_name", "skuName"]) ??
      (typeof sku?.name === "string" ? sku.name : null),
    sku_slug:
      pickStringField(source, ["sku_slug", "skuSlug"]) ??
      (typeof sku?.slug === "string" ? sku.slug : null),
    equipment_id:
      pickStringField(source, ["equipment_id", "equipmentId"]) ??
      (typeof equipment?.id === "string" ? equipment.id : null),
    site_address: pickStringField(source, ["site_address", "siteAddress"]),
    scheduled_start:
      pickStringField(source, ["scheduled_start", "scheduledStart"]) ?? undefined,
    scheduled_end:
      pickStringField(source, ["scheduled_end", "scheduledEnd"]) ?? undefined,
  };
}

function mergeExtensionBookingContext(
  ext: VendorExtension,
  detail: VendorBookingDetail
): VendorExtension {
  return {
    ...ext,
    booking_number: ext.booking_number || detail.booking_number,
    sku_name: ext.sku_name ?? detail.sku?.name ?? null,
    sku_slug: ext.sku_slug ?? detail.sku?.slug ?? null,
    equipment_id: ext.equipment_id ?? detail.equipment_id ?? null,
    site_address: ext.site_address ?? detail.site_address ?? null,
    scheduled_start: ext.scheduled_start || detail.scheduled_start,
    scheduled_end: ext.scheduled_end || detail.scheduled_end,
  };
}

/** extend-duration proposal — customer has not paid yet. */
function extensionAwaitingCustomerPayment(raw: Record<string, unknown>): boolean {
  const status = String(raw.status ?? "").toLowerCase();
  if (
    [
      "awaiting_payment",
      "payment_pending",
      "awaiting_customer_payment",
      "proposed",
      "proposal",
    ].includes(status)
  ) {
    return true;
  }
  if (raw.is_customer_paid === false || raw.customer_paid === false) return true;
  if (raw.awaiting_customer_payment === true || raw.awaiting_payment === true) return true;

  const customerStatus = pickStringField(raw, [
    "customer_payment_status",
    "customerPaymentStatus",
  ]);
  if (
    customerStatus &&
    ["unpaid", "awaiting_payment", "payment_pending", "pending_payment"].includes(
      customerStatus.toLowerCase()
    )
  ) {
    return true;
  }

  const paymentStatus = pickStringField(raw, ["payment_status", "paymentStatus"]);
  if (
    paymentStatus &&
    ["unpaid", "awaiting_payment", "payment_pending", "pending_payment"].includes(
      paymentStatus.toLowerCase()
    )
  ) {
    return true;
  }

  return false;
}

function extensionVendorActionsEnabled(raw: Record<string, unknown>): boolean {
  const actions =
    (raw.available_actions as Record<string, unknown> | undefined) ??
    (raw.availableActions as Record<string, unknown> | undefined);
  if (!actions) return false;
  return actions.can_approve_extension === true || actions.can_reject_extension === true;
}

function extensionPaymentMessageMarked(raw: Record<string, unknown>): boolean {
  const message = pickStringField(raw, ["message"]);
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("payment marked") ||
    lower.includes("payment successful") ||
    lower.includes("awaiting vendor approval")
  );
}

function extensionPaymentMarked(raw: Record<string, unknown>): boolean {
  const flat = flattenExtensionPaymentSource(raw);
  if (extensionAwaitingCustomerPayment(flat)) return false;

  if (extensionVendorActionsEnabled(flat)) return true;
  if (flat.is_paid === true || flat.isPaid === true) return true;
  if (flat.is_customer_paid === true || flat.customer_paid === true) return true;
  if (flat.is_extension_paid === true || flat.extension_customer_paid === true) return true;
  if (flat.payment_complete === true || flat.paymentComplete === true) return true;
  if (flat.extension_paid === true || flat.extension_payment_complete === true) return true;
  if (flat.awaiting_vendor_approval === true) return true;
  if (hasTruthyPaidTimestamp(flat)) return true;

  const paidAt = pickStringField(flat, [
    "paid_at",
    "paidAt",
    "payment_at",
    "payment_completed_at",
    "extension_paid_at",
    "extensionPaidAt",
  ]);
  if (paidAt) return true;

  const paymentStatus = pickStringField(flat, [
    "payment_status",
    "paymentStatus",
    "customer_payment_status",
    "customerPaymentStatus",
    "extension_payment_status",
    "extensionPaymentStatus",
  ]);
  if (
    paymentStatus &&
    [
      "paid",
      "completed",
      "marked",
      "success",
      "awaiting_vendor_approval",
      "payment_marked",
    ].includes(paymentStatus.toLowerCase())
  ) {
    return true;
  }

  if (flat.razorpay_payment_id || flat.juspay_order_id) return true;

  // POST /rentals/bookings/{id}/extension-payment sets paid_at and returns
  // payment_method (e.g. cod) — extend-duration alone does not send this.
  const paymentMethod = pickStringField(flat, ["payment_method", "paymentMethod"]);
  if (paymentMethod) return true;

  if (extensionPaymentMessageMarked(flat)) return true;

  return false;
}

/** Booking status after extension-payment — customer paid, vendor must approve. */
function isBookingAwaitingVendorExtension(bookingStatus: string | undefined): boolean {
  return bookingStatus === "extension_pending";
}

/** Extension already approved/rejected or booking already extended. */
export function isExtensionDecisionComplete(
  bookingStatus: string | undefined,
  extensionStatus?: string | null
): boolean {
  const booking = (bookingStatus ?? "").toLowerCase();
  const extension = (extensionStatus ?? "").toLowerCase();
  if (booking === "extended" || booking === "ended") return true;
  if (extension === "approved" || extension === "rejected" || extension === "extended") {
    return true;
  }
  return false;
}

/** After extension-payment, customer has paid; vendor must approve/reject. */
export function isExtensionAwaitingVendorAction(
  ext: Pick<PendingExtension, "status" | "paid_at" | "is_paid" | "payment_method">,
  bookingStatus?: string
): boolean {
  if (ext.status !== "pending") return false;
  if (isBookingAwaitingVendorExtension(bookingStatus)) return true;
  return (
    ext.is_paid === true ||
    Boolean(ext.paid_at) ||
    Boolean(ext.payment_method)
  );
}

/** Hide extend-duration proposals; show only after extension-payment. */
function shouldShowExtensionToVendor(
  ext: Pick<PendingExtension, "status" | "paid_at" | "is_paid" | "payment_method"> | null | undefined,
  actions?: AvailableActions,
  bookingStatus?: string
): boolean {
  if (!ext || ext.status !== "pending") return false;
  if (isExtensionDecisionComplete(bookingStatus, ext.status)) return false;
  if (isBookingAwaitingVendorExtension(bookingStatus)) return true;
  if (actions?.can_approve_extension || actions?.can_reject_extension) return true;
  return isExtensionAwaitingVendorAction(ext, bookingStatus);
}

/** Pending extension visible to vendor; actionable only after customer payment. */
export function isVendorQueueExtension(
  ext: Pick<VendorExtension, "status" | "paid_at" | "is_paid">
): boolean {
  return ext.status === "pending" && isExtensionAwaitingVendorAction(ext);
}

export function vendorExtensionToPending(ext: VendorExtension): PendingExtension {
  const isPaid = isExtensionAwaitingVendorAction(ext);
  return {
    id: ext.id,
    extension_hours: ext.extension_hours,
    extension_amount: ext.extension_amount,
    status: ext.status,
    response_deadline: ext.response_deadline,
    created_at: ext.created_at || null,
    approved_at: ext.approved_at ?? ext.updated_at ?? null,
    paid_at: ext.paid_at,
    is_paid: isPaid,
    payment_method: ext.payment_method,
  };
}

export function canVendorActOnExtension(
  ext: PendingExtension | null | undefined,
  actions?: AvailableActions,
  options?: { inVendorQueue?: boolean; bookingStatus?: string }
): boolean {
  if (!ext || ext.status !== "pending") return false;
  if (isExtensionDecisionComplete(options?.bookingStatus, ext.status)) return false;
  if (isBookingAwaitingVendorExtension(options?.bookingStatus)) return true;
  if (!isExtensionAwaitingVendorAction(ext, options?.bookingStatus)) return false;
  if (actions?.can_approve_extension || actions?.can_reject_extension) return true;
  if (options?.inVendorQueue) return true;
  return false;
}

function normalizeExtensionFields(
  raw: Record<string, unknown>
): Pick<
  VendorExtension,
  | "id"
  | "booking_id"
  | "booking_number"
  | "extension_hours"
  | "extension_amount"
  | "status"
  | "response_deadline"
  | "created_at"
  | "paid_at"
  | "is_paid"
  | "payment_method"
  | "sku_name"
  | "sku_slug"
  | "equipment_id"
  | "site_address"
  | "scheduled_start"
  | "scheduled_end"
  | "approved_at"
  | "updated_at"
> {
  const source = flattenExtensionRawSource(raw);
  const paidAt = pickStringField(source, [
    "paid_at",
    "paidAt",
    "payment_at",
    "payment_completed_at",
  ]);
  const paymentMethod = pickStringField(source, ["payment_method", "paymentMethod"]);
  const paymentMarked = extensionPaymentMarked(source);
  const vehicle = parseExtensionVehicleFields(source);

  return {
    id: String(source.id ?? source.extension_id ?? raw.id ?? raw.extension_id ?? ""),
    booking_id: String(source.booking_id ?? raw.booking_id ?? ""),
    booking_number: String(source.booking_number ?? raw.booking_number ?? ""),
    extension_hours: Number(
      source.extension_hours ?? source.extended_by_hours ?? raw.extension_hours ?? raw.extended_by_hours ?? 0
    ),
    extension_amount: Number(
      source.extension_amount ?? source.extension_cost ?? raw.extension_amount ?? raw.extension_cost ?? 0
    ),
    status: String(source.status ?? raw.status ?? "pending"),
    response_deadline:
      (source.response_deadline as string | null) ??
      (raw.response_deadline as string | null) ??
      null,
    created_at: String(source.created_at ?? raw.created_at ?? ""),
    paid_at: paidAt,
    is_paid: paymentMarked,
    payment_method: paymentMethod,
    approved_at:
      pickStringField(source, [
        "approved_at",
        "approvedAt",
        "vendor_approved_at",
        "vendorApprovedAt",
      ]) ??
      pickStringField(raw, ["approved_at", "approvedAt", "vendor_approved_at"]),
    updated_at:
      pickStringField(source, ["updated_at", "updatedAt"]) ??
      pickStringField(raw, ["updated_at", "updatedAt"]),
    ...vehicle,
  };
}

export function normalizeVendorExtension(raw: Record<string, unknown>): VendorExtension {
  return normalizeExtensionFields(raw) as VendorExtension;
}

function normalizePendingExtension(
  raw: Record<string, unknown> | null | undefined,
  actions?: AvailableActions
): PendingExtension | null {
  if (!raw || (!raw.id && !raw.extension_id)) return null;
  const base = normalizeExtensionFields({
    ...raw,
    ...(actions
      ? {
          available_actions: {
            can_approve_extension: actions.can_approve_extension,
            can_reject_extension: actions.can_reject_extension,
          },
        }
      : {}),
  });

  return {
    id: base.id,
    extension_hours: base.extension_hours,
    extension_amount: base.extension_amount,
    status: base.status,
    response_deadline: base.response_deadline,
    created_at: base.created_at || null,
    approved_at: base.approved_at ?? null,
    paid_at: base.paid_at,
    is_paid: base.is_paid,
    payment_method: base.payment_method,
  };
}

function extractExtensionRecordFromBookingRaw(
  raw: Record<string, unknown>
): Record<string, unknown> | null {
  const nestedKeys = [
    "pending_extension",
    "approved_extension",
    "active_extension",
    "last_extension",
    "extension",
  ];

  for (const key of nestedKeys) {
    const value = raw[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  const extensions = raw.extensions;
  if (Array.isArray(extensions) && extensions.length > 0) {
    const records = extensions.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    );
    const resolved = records.find((entry) => {
      const status = String(entry.status ?? "").toLowerCase();
      return ["approved", "extended", "rejected"].includes(status);
    });
    if (resolved) return resolved;
    return records[records.length - 1] ?? null;
  }

  const hasExtensionFields = Boolean(
    raw.extension_hours ??
      raw.extended_by_hours ??
      raw.extension_amount ??
      raw.extension_cost
  );
  if (!hasExtensionFields) return null;

  return {
    ...raw,
    id: raw.extension_id ?? raw.id,
    booking_id: raw.id ?? raw.booking_id,
  };
}

function extensionToResolvedPending(
  ext: VendorExtension,
  bookingStatus: string
): PendingExtension {
  const pending = vendorExtensionToPending(ext);
  const extensionStatus = String(ext.status ?? "").toLowerCase();
  return {
    ...pending,
    status:
      bookingStatus === "extended" || extensionStatus === "extended"
        ? "approved"
        : extensionStatus === "approved"
          ? "approved"
          : pending.status,
    created_at: ext.created_at || pending.created_at || null,
    approved_at: ext.approved_at ?? ext.updated_at ?? ext.paid_at ?? pending.approved_at ?? null,
  };
}

async function listVendorExtensions(
  status: "pending" | "approved" | "rejected",
  page = 1,
  perPage = 50
): Promise<{ items: VendorExtension[]; pagination: PaginationMeta }> {
  const params = new URLSearchParams({
    status,
    page: String(page),
    per_page: String(perPage),
  });
  const response = await fetch(`${RENTAL_API_BASE_URL}/vendor/extensions?${params}`, {
    headers: authHeaders(),
  });
  const { items, pagination } = await parsePaginated<Record<string, unknown>>(response);
  return {
    items: items.map((item) => normalizeVendorExtension(item)),
    pagination,
  };
}

async function hydrateResolvedExtension(
  detail: VendorBookingDetail,
  knownExtensions?: VendorExtension[]
): Promise<PendingExtension | null> {
  if (detail.pending_extension) {
    const pending = detail.pending_extension;
    return extensionToResolvedPending(
      {
        id: pending.id,
        booking_id: detail.id,
        booking_number: detail.booking_number,
        extension_hours: pending.extension_hours,
        extension_amount: pending.extension_amount,
        status: pending.status,
        response_deadline: pending.response_deadline,
        created_at: pending.created_at ?? detail.created_at,
        approved_at: pending.approved_at,
        paid_at: pending.paid_at,
        is_paid: pending.is_paid,
        payment_method: pending.payment_method,
      },
      detail.status
    );
  }

  if (!isExtensionDecisionComplete(detail.status)) return null;

  const fromKnown = knownExtensions?.find((ext) => ext.booking_id === detail.id);
  if (fromKnown) return extensionToResolvedPending(fromKnown, detail.status);

  for (const status of ["approved", "rejected"] as const) {
    try {
      const { items } = await listVendorExtensions(status, 1, 50);
      const match = items.find((ext) => ext.booking_id === detail.id);
      if (match) return extensionToResolvedPending(match, detail.status);
    } catch {
      // Try the next status list.
    }
  }

  return null;
}

function normalizeAvailableActions(raw: Record<string, unknown>): AvailableActions {
  const actions =
    (raw.available_actions as Record<string, unknown> | undefined) ??
    (raw.availableActions as Record<string, unknown> | undefined) ??
    {};

  return {
    can_accept: Boolean(actions.can_accept),
    can_reject: actions.can_reject != null ? Boolean(actions.can_reject) : undefined,
    can_update_location: Boolean(actions.can_update_location),
    can_verify_start_otp: Boolean(actions.can_verify_start_otp),
    can_verify_end_otp: Boolean(actions.can_verify_end_otp),
    can_approve_extension:
      actions.can_approve_extension != null
        ? Boolean(actions.can_approve_extension)
        : undefined,
    can_reject_extension:
      actions.can_reject_extension != null
        ? Boolean(actions.can_reject_extension)
        : undefined,
  };
}

function mergePendingExtensionWithListItem(
  pending: PendingExtension,
  fromList: VendorExtension
): PendingExtension {
  return {
    ...pending,
    id: fromList.id || pending.id,
    extension_hours: fromList.extension_hours || pending.extension_hours,
    extension_amount: fromList.extension_amount || pending.extension_amount,
    paid_at: fromList.paid_at ?? pending.paid_at,
    payment_method: fromList.payment_method ?? pending.payment_method,
    is_paid: isExtensionAwaitingVendorAction({
      status: fromList.status || pending.status,
      paid_at: fromList.paid_at ?? pending.paid_at,
      is_paid: fromList.is_paid === true || pending.is_paid === true,
      payment_method: fromList.payment_method ?? pending.payment_method,
    }),
  };
}

function findExtensionForBooking(
  bookingId: string,
  sources: VendorExtension[],
  pendingId?: string
): VendorExtension | undefined {
  return sources.find(
    (ext) =>
      ext.booking_id === bookingId && (!pendingId || ext.id === pendingId)
  );
}

function unwrapBookingDetailPayload(raw: Record<string, unknown>): Record<string, unknown> {
  let merged = { ...raw };
  for (const key of [
    "booking",
    "booking_detail",
    "bookingDetail",
    "rental_booking",
    "rentalBooking",
    "order",
    "details",
  ]) {
    const nested = raw[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      merged = { ...merged, ...(nested as Record<string, unknown>) };
    }
  }
  return merged;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function isSiteImageFieldName(key: string): boolean {
  if (SITE_IMAGE_FIELD_NAMES.has(key)) return true;
  return /site.*image|image.*site|site.*photo|photo.*site/i.test(key);
}

function urlFromSiteImageEntry(entry: unknown): string | null {
  if (typeof entry === "string" && entry.trim()) return entry.trim();
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const record = entry as Record<string, unknown>;
    const candidate =
      record.url ??
      record.image_url ??
      record.site_image_url ??
      record.file_url ??
      record.public_url ??
      record.media_url ??
      record.presigned_url ??
      record.s3_url ??
      record.download_url ??
      record.signed_url ??
      record.thumbnail_url ??
      record.file ??
      record.uri ??
      record.link ??
      record.src ??
      record.path ??
      record.file_path;
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  }
  return null;
}

function parsePostgresTextArray(inner: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      if (current.trim()) result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function siteImageArrayFromValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.data)) return record.data;
    const values = Object.values(record);
    if (
      values.length > 0 &&
      values.every(
        (entry) =>
          typeof entry === "string" ||
          (entry && typeof entry === "object" && !Array.isArray(entry))
      )
    ) {
      return values;
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fall through to other string formats.
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return parsePostgresTextArray(inner);
    }
    return [trimmed];
  }
  return [];
}

const SITE_IMAGE_FIELD_NAMES = new Set([
  "site_image_url",
  "siteImageUrl",
  "site_image_urls",
  "siteImageUrls",
  "site_images",
  "siteImages",
  "image_url",
  "imageUrl",
  "image_urls",
  "imageUrls",
]);

function extractSiteImageUrlsFromApiBody(body: unknown): string[] {
  const urls = new Set<string>();

  for (const url of findSiteImageUrlsDeep(body)) {
    urls.add(url);
  }

  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  if (!record) return [...urls];

  const data = (
    "success" in record && record.success && "data" in record ? record.data : record
  ) as unknown;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const payload = unwrapBookingDetailPayload(data as Record<string, unknown>);
    for (const url of collectSiteImageUrls(payload)) {
      urls.add(url);
    }
  }

  return [...urls];
}

function findSiteImageUrlsDeep(value: unknown, depth = 0): string[] {
  if (depth > 8 || value == null) return [];
  const urls = new Set<string>();

  const addFromField = (fieldValue: unknown) => {
    for (const entry of siteImageArrayFromValue(fieldValue)) {
      const url = urlFromSiteImageEntry(entry);
      if (url) urls.add(resolveSiteImageUrl(url));
    }
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      for (const url of findSiteImageUrlsDeep(entry, depth + 1)) {
        urls.add(url);
      }
    }
    return [...urls];
  }

  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const [key, fieldValue] of Object.entries(record)) {
    if (isSiteImageFieldName(key)) {
      addFromField(fieldValue);
    }
    const parsedJson = parseJsonRecord(fieldValue);
    if (parsedJson) {
      for (const url of findSiteImageUrlsDeep(parsedJson, depth + 1)) {
        urls.add(url);
      }
    }
    for (const url of findSiteImageUrlsDeep(fieldValue, depth + 1)) {
      urls.add(url);
    }
  }

  return [...urls];
}

export function resolveSiteImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const candidates = [
    `${API_BASE_URL.replace(/\/$/, "")}${path}`,
    `${RENTAL_API_BASE_URL.replace(/\/$/, "")}${path}`,
    `${API_BASE_URL.replace(/\/api\/v1\/?$/, "")}${path}`,
    `${RENTAL_API_BASE_URL.replace(/\/api\/v1\/?$/, "")}${path}`,
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  return trimmed;
}

function flattenSiteImageSource(raw: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...raw };
  for (const key of [
    "site",
    "location",
    "property",
    "booking_site",
    "site_location",
    "booking_details",
    "bookingDetails",
    "metadata",
    "meta",
    "extra",
    "job_details",
    "request_payload",
    "creation_request",
    "booking_request",
    "snapshot",
  ]) {
    const nested = raw[key];
    const parsed = parseJsonRecord(nested) ?? nested;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.assign(merged, parsed as Record<string, unknown>);
    }
  }
  return merged;
}

/** Collect site image URLs from booking API payloads (all known field shapes). */
export function collectSiteImageUrls(raw: Record<string, unknown>): string[] {
  const urls = new Set<string>();
  const sources = [raw, flattenSiteImageSource(raw)];

  const addUrl = (value: string | null | undefined) => {
    if (!value?.trim()) return;
    urls.add(resolveSiteImageUrl(value));
  };

  for (const source of sources) {
    addUrl(
      pickStringField(source, [
        "site_image_url",
        "siteImageUrl",
        "site_image",
        "siteImage",
        "image_url",
        "imageUrl",
      ])
    );

    for (const key of [
      "site_image_urls",
      "siteImageUrls",
      "site_images",
      "siteImages",
      "image_urls",
      "imageUrls",
      "images",
      "photos",
    ]) {
      const entries = siteImageArrayFromValue(source[key]);
      for (const entry of entries) {
        addUrl(urlFromSiteImageEntry(entry));
      }
    }

    for (const key of [
      "attachments",
      "attachment_list",
      "attachmentList",
      "documents",
      "document_list",
      "media",
      "files",
      "uploads",
    ]) {
      const entries = source[key];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          const record = entry as Record<string, unknown>;
          const type = String(record.type ?? record.document_type ?? record.kind ?? "");
          if (type && !/site|image|photo/i.test(type)) continue;
        }
        addUrl(urlFromSiteImageEntry(entry));
      }
    }
  }

  const deepUrls = findSiteImageUrlsDeep(raw);
  for (const url of deepUrls) {
    urls.add(url);
  }

  return [...urls];
}

export async function hydrateBookingSiteImages(
  detail: VendorBookingDetail,
  bookingId: string
): Promise<VendorBookingDetail> {
  let urls = collectSiteImageUrls(detail as unknown as Record<string, unknown>);

  if (urls.length === 0) {
    urls = await fetchBookingSiteImageUrls(bookingId);
  }

  if (urls.length === 0) return detail;

  return {
    ...detail,
    site_image_url: urls[0],
    site_image_urls: urls,
  };
}

function normalizeVendorBookingDetail(raw: Record<string, unknown>): VendorBookingDetail {
  const payload = unwrapBookingDetailPayload(raw);
  const detail = payload as unknown as VendorBookingDetail;
  const bookingStatus = String(payload.status ?? detail.status ?? "");
  let availableActions = normalizeAvailableActions(payload);
  const pendingRaw = payload.pending_extension as Record<string, unknown> | null | undefined;
  const extensionPaidFlag =
    payload.extension_paid === true || payload.extension_payment_complete === true;
  const bookingAwaitingExtension = isBookingAwaitingVendorExtension(bookingStatus);

  let pendingExtension = normalizePendingExtension(pendingRaw, availableActions);
  if (!pendingExtension) {
    const alternateExtension = extractExtensionRecordFromBookingRaw(payload);
    pendingExtension = normalizePendingExtension(alternateExtension, availableActions);
  }
  const vendorCanActOnExtension = Boolean(
    availableActions.can_approve_extension || availableActions.can_reject_extension
  );
  if (
    pendingExtension &&
    (extensionPaidFlag || vendorCanActOnExtension || bookingAwaitingExtension) &&
    !pendingExtension.is_paid
  ) {
    pendingExtension = { ...pendingExtension, is_paid: true };
  }

  if (bookingAwaitingExtension && pendingExtension) {
    availableActions = {
      ...availableActions,
      can_approve_extension: availableActions.can_approve_extension ?? true,
      can_reject_extension: availableActions.can_reject_extension ?? true,
    };
  }

  if (!shouldShowExtensionToVendor(pendingExtension, availableActions, bookingStatus)) {
    if (
      pendingExtension &&
      (isExtensionDecisionComplete(bookingStatus, pendingExtension.status) ||
        bookingStatus === "extended")
    ) {
      pendingExtension = extensionToResolvedPending(
        {
          id: pendingExtension.id,
          booking_id: String(payload.id ?? detail.id ?? ""),
          booking_number: String(payload.booking_number ?? detail.booking_number ?? ""),
          extension_hours: pendingExtension.extension_hours,
          extension_amount: pendingExtension.extension_amount,
          status: pendingExtension.status,
          response_deadline: pendingExtension.response_deadline,
          created_at: pendingExtension.created_at ?? String(payload.created_at ?? detail.created_at ?? ""),
          approved_at: pendingExtension.approved_at,
          paid_at: pendingExtension.paid_at,
          is_paid: pendingExtension.is_paid,
          payment_method: pendingExtension.payment_method,
        },
        bookingStatus
      );
    } else {
      pendingExtension = null;
    }
  }

  if (isExtensionDecisionComplete(bookingStatus, pendingExtension?.status)) {
    availableActions = {
      ...availableActions,
      can_approve_extension: false,
      can_reject_extension: false,
    };
  }

  const siteImageUrls = collectSiteImageUrls(payload);

  return {
    ...detail,
    ...(siteImageUrls.length > 0
      ? {
          site_image_url: siteImageUrls[0],
          site_image_urls: siteImageUrls,
        }
      : {}),
    available_actions: availableActions,
    pending_extension: pendingExtension,
  };
}

function vendorExtensionFromBookingDetail(
  detail: VendorBookingDetail
): VendorExtension | null {
  const pending = detail.pending_extension;
  if (!pending || pending.status !== "pending") return null;
  if (!shouldShowExtensionToVendor(pending, detail.available_actions, detail.status)) {
    return null;
  }

  return {
    id: pending.id,
    booking_id: detail.id,
    booking_number: detail.booking_number,
    extension_hours: pending.extension_hours,
    extension_amount: pending.extension_amount,
    status: pending.status,
    response_deadline: pending.response_deadline,
    created_at: detail.created_at,
    paid_at: pending.paid_at,
    is_paid: true,
    payment_method: pending.payment_method,
    sku_name: detail.sku?.name ?? null,
    sku_slug: detail.sku?.slug ?? null,
    equipment_id: detail.equipment_id,
    site_address: detail.site_address,
    scheduled_start: detail.scheduled_start,
    scheduled_end: detail.scheduled_end,
  };
}

async function enrichExtensionFromBooking(ext: VendorExtension): Promise<VendorExtension> {
  try {
    const detail = await fetchVendorBookingDetail(ext.booking_id);
    let merged = mergeExtensionBookingContext(ext, detail);

    const pending = detail.pending_extension;
    const bookingAwaitingExtension = isBookingAwaitingVendorExtension(detail.status);

    if (bookingAwaitingExtension) {
      return {
        ...merged,
        paid_at: merged.paid_at ?? pending?.paid_at,
        payment_method: merged.payment_method ?? pending?.payment_method,
        is_paid: true,
      };
    }

    if (pending?.id && ext.id && pending.id !== ext.id) {
      return merged;
    }

    const actions = detail.available_actions;
    const vendorCanAct = Boolean(
      actions?.can_approve_extension || actions?.can_reject_extension
    );
    const pendingPaid =
      pending != null &&
      (pending.is_paid === true ||
        isExtensionAwaitingVendorAction(
          {
            status: pending.status,
            paid_at: pending.paid_at,
            is_paid: pending.is_paid,
            payment_method: pending.payment_method,
          },
          detail.status
        ));

    if (vendorCanAct || pendingPaid) {
      merged = {
        ...merged,
        paid_at: pending?.paid_at ?? merged.paid_at,
        payment_method: pending?.payment_method ?? merged.payment_method,
        is_paid: true,
      };
    }

    return merged;
  } catch {
    return ext;
  }
}

export async function fetchVendorExtensions(
  status: "pending" | "approved" | "rejected" = "pending",
  page = 1,
  perPage = 20
): Promise<{ items: VendorExtension[]; pagination: PaginationMeta }> {
  const { items: normalized, pagination } = await listVendorExtensions(status, page, perPage);
  const enriched = await Promise.all(
    normalized.map((ext) => enrichExtensionFromBooking(ext))
  );
  const vendorReady = enriched.filter((ext) => isExtensionAwaitingVendorAction(ext));

  const seenBookingIds = new Set(vendorReady.map((ext) => ext.booking_id));
  try {
    const { items: activeBookings } = await fetchVendorBookings("active", 1, 50);
    const awaitingApproval = activeBookings.filter(
      (booking) =>
        isBookingAwaitingVendorExtension(booking.status) && !seenBookingIds.has(booking.id)
    );

    const supplemented = await Promise.all(
      awaitingApproval.map(async (booking) => {
        const detail = await fetchVendorBookingDetail(booking.id);
        return vendorExtensionFromBookingDetail(detail);
      })
    );

    for (const ext of supplemented) {
      if (ext) {
        vendorReady.push(ext);
        seenBookingIds.add(ext.booking_id);
      }
    }
  } catch {
    // Keep list from /vendor/extensions when active-booking supplement fails.
  }

  return {
    items: vendorReady,
    pagination: {
      ...pagination,
      total_items: vendorReady.length,
    },
  };
}

export async function enrichBookingDetailWithExtensions(
  detail: VendorBookingDetail,
  knownExtensions?: VendorExtension[]
): Promise<VendorBookingDetail> {
  if (isExtensionDecisionComplete(detail.status, detail.pending_extension?.status)) {
    const pendingExtension = await hydrateResolvedExtension(detail, knownExtensions);
    return {
      ...detail,
      pending_extension: pendingExtension,
      available_actions: {
        ...detail.available_actions,
        can_approve_extension: false,
        can_reject_extension: false,
      },
    };
  }

  if (
    isBookingAwaitingVendorExtension(detail.status) &&
    detail.pending_extension &&
    shouldShowExtensionToVendor(
      detail.pending_extension,
      detail.available_actions,
      detail.status
    )
  ) {
    const pendingExtension = { ...detail.pending_extension, is_paid: true };
    return {
      ...detail,
      pending_extension: pendingExtension,
      available_actions: {
        ...detail.available_actions,
        can_approve_extension: detail.available_actions.can_approve_extension ?? true,
        can_reject_extension: detail.available_actions.can_reject_extension ?? true,
      },
    };
  }

  const pendingId = detail.pending_extension?.id;
  const queueSources = [...(knownExtensions ?? [])];

  if (!findExtensionForBooking(detail.id, queueSources, pendingId)) {
    const { items } = await fetchVendorExtensions("pending", 1, 50);
    queueSources.push(...items);
  }

  const match = findExtensionForBooking(detail.id, queueSources, pendingId);
  if (!match || !isExtensionAwaitingVendorAction(match, detail.status)) {
    if (
      !shouldShowExtensionToVendor(
        detail.pending_extension,
        detail.available_actions,
        detail.status
      )
    ) {
      return { ...detail, pending_extension: null };
    }
    return detail;
  }

  const pendingExtension = detail.pending_extension
    ? mergePendingExtensionWithListItem(detail.pending_extension, match)
    : vendorExtensionToPending(match);

  if (!shouldShowExtensionToVendor(pendingExtension, detail.available_actions, detail.status)) {
    return { ...detail, pending_extension: null };
  }

  const canActOnExtension = canVendorActOnExtension(pendingExtension, detail.available_actions, {
    inVendorQueue: true,
    bookingStatus: detail.status,
  });

  return {
    ...detail,
    pending_extension: pendingExtension,
    available_actions: {
      ...detail.available_actions,
      can_approve_extension:
        detail.available_actions.can_approve_extension ?? canActOnExtension,
      can_reject_extension:
        detail.available_actions.can_reject_extension ?? canActOnExtension,
    },
  };
}

export async function approveExtension(
  extensionId: string,
  paymentMethod: "cod" | "juspay" = "juspay"
): Promise<{ extension_id: string; status: string }> {
  const response = await fetch(
    `${RENTAL_API_BASE_URL}/vendor/extensions/${extensionId}/approve`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ payment_method: paymentMethod }),
    }
  );
  return parseData(response);
}

export async function rejectExtension(
  extensionId: string,
  reason?: string
): Promise<{ extension_id: string; status: string }> {
  const response = await fetch(
    `${RENTAL_API_BASE_URL}/vendor/extensions/${extensionId}/reject`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ reason: reason ?? null }),
    }
  );
  return parseData(response);
}

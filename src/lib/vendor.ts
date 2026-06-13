import {
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
  type_of_load: string | null;
  type_of_soil: string | null;
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
  const data = await parseData<Record<string, unknown>>(response);
  return normalizeVendorBookingDetail(data);
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

function normalizeVendorBookingDetail(raw: Record<string, unknown>): VendorBookingDetail {
  const detail = raw as unknown as VendorBookingDetail;
  const bookingStatus = String(raw.status ?? detail.status ?? "");
  let availableActions = normalizeAvailableActions(raw);
  const pendingRaw = raw.pending_extension as Record<string, unknown> | null | undefined;
  const extensionPaidFlag =
    raw.extension_paid === true || raw.extension_payment_complete === true;
  const bookingAwaitingExtension = isBookingAwaitingVendorExtension(bookingStatus);

  let pendingExtension = normalizePendingExtension(pendingRaw, availableActions);
  if (!pendingExtension) {
    const alternateExtension = extractExtensionRecordFromBookingRaw(raw);
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
          booking_id: String(raw.id ?? detail.id ?? ""),
          booking_number: String(raw.booking_number ?? detail.booking_number ?? ""),
          extension_hours: pendingExtension.extension_hours,
          extension_amount: pendingExtension.extension_amount,
          status: pendingExtension.status,
          response_deadline: pendingExtension.response_deadline,
          created_at: pendingExtension.created_at ?? String(raw.created_at ?? detail.created_at ?? ""),
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

  const siteImageUrls = normalizeSiteImageUrls(raw);

  return {
    ...detail,
    site_image_url:
      pickStringField(raw, ["site_image_url", "siteImageUrl"]) ??
      siteImageUrls[0] ??
      null,
    site_image_urls: siteImageUrls.length > 0 ? siteImageUrls : null,
    available_actions: availableActions,
    pending_extension: pendingExtension,
  };
}

function normalizeSiteImageUrls(raw: Record<string, unknown>): string[] {
  const urls = new Set<string>();

  const singular = pickStringField(raw, ["site_image_url", "siteImageUrl", "site_image", "siteImage"]);
  if (singular) urls.add(singular);

  for (const key of ["site_image_urls", "siteImageUrls", "site_images", "siteImages"]) {
    const value = raw[key];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) {
        urls.add(entry.trim());
        continue;
      }
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const nested = pickStringField(record, [
          "url",
          "image_url",
          "site_image_url",
          "src",
        ]);
        if (nested) urls.add(nested);
      }
    }
  }

  return [...urls];
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

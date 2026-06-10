import {
  API_BASE_URL,
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
  paid_at?: string | null;
  is_paid?: boolean;
  payment_method?: string | null;
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
  const response = await fetch(`${API_BASE_URL}/vendor/me`, {
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
  const response = await fetch(`${API_BASE_URL}/vendor/bookings?${params}`, {
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
  const response = await fetch(`${API_BASE_URL}/vendor/bookings/${bookingId}`, {
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
    `${API_BASE_URL}/vendor/bookings/${bookingId}/accept`,
    { method: "POST", headers: authHeaders() }
  );
  return parseData(response);
}

export async function rejectBooking(
  bookingId: string,
  reason?: string
): Promise<{ booking_id: string; status: string }> {
  const response = await fetch(
    `${API_BASE_URL}/vendor/bookings/${bookingId}/reject`,
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
    `${API_BASE_URL}/vendor/equipment/${equipmentId}/location`,
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
    `${API_BASE_URL}/vendor/bookings/${bookingId}/verify-start-otp`,
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
    `${API_BASE_URL}/vendor/bookings/${bookingId}/verify-end-otp`,
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
    raw.paid_at ?? raw.paidAt ?? raw.payment_at ?? raw.payment_completed_at;
  return value != null && value !== "";
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
  if (raw.is_paid === true || raw.isPaid === true) return true;
  if (raw.payment_complete === true || raw.paymentComplete === true) return true;
  if (raw.extension_paid === true || raw.extension_payment_complete === true) return true;
  if (raw.awaiting_vendor_approval === true) return true;
  if (hasTruthyPaidTimestamp(raw)) return true;

  const paidAt = pickStringField(raw, [
    "paid_at",
    "paidAt",
    "payment_at",
    "payment_completed_at",
  ]);
  if (paidAt) return true;

  const paymentStatus = pickStringField(raw, ["payment_status", "paymentStatus"]);
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

  if (raw.razorpay_payment_id || raw.juspay_order_id) return true;

  // POST /rentals/bookings/{id}/extension-payment sets paid_at and returns
  // payment_method (e.g. cod) — extend-duration alone does not send this.
  const paymentMethod = pickStringField(raw, ["payment_method", "paymentMethod"]);
  if (paymentMethod) return true;

  if (extensionPaymentMessageMarked(raw)) return true;

  return false;
}

/** After extension-payment, customer has paid; vendor must approve/reject. */
export function isExtensionAwaitingVendorAction(
  ext: Pick<PendingExtension, "status" | "paid_at" | "is_paid" | "payment_method">
): boolean {
  if (ext.status !== "pending") return false;
  return (
    ext.is_paid === true ||
    Boolean(ext.paid_at) ||
    Boolean(ext.payment_method)
  );
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
    paid_at: ext.paid_at,
    is_paid: isPaid,
    payment_method: ext.payment_method,
  };
}

export function canVendorActOnExtension(
  ext: PendingExtension | null | undefined,
  actions?: AvailableActions,
  options?: { inVendorQueue?: boolean }
): boolean {
  if (!ext || ext.status !== "pending") return false;
  if (!isExtensionAwaitingVendorAction(ext)) return false;
  if (options?.inVendorQueue) return true;
  if (actions?.can_approve_extension || actions?.can_reject_extension) return true;
  return true;
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
> {
  const source =
    raw.extension && typeof raw.extension === "object"
      ? { ...raw, ...(raw.extension as Record<string, unknown>) }
      : raw;
  const paidAt = pickStringField(source, [
    "paid_at",
    "paidAt",
    "payment_at",
    "payment_completed_at",
  ]);
  const paymentMethod = pickStringField(source, ["payment_method", "paymentMethod"]);
  const paymentMarked = extensionPaymentMarked(source);

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
  const base = normalizeExtensionFields(raw);

  return {
    id: base.id,
    extension_hours: base.extension_hours,
    extension_amount: base.extension_amount,
    status: base.status,
    response_deadline: base.response_deadline,
    paid_at: base.paid_at,
    is_paid: base.is_paid,
    payment_method: base.payment_method,
  };
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
  const availableActions = normalizeAvailableActions(raw);
  const pendingRaw = raw.pending_extension as Record<string, unknown> | null | undefined;
  const extensionPaidFlag =
    raw.extension_paid === true || raw.extension_payment_complete === true;

  let pendingExtension = normalizePendingExtension(pendingRaw, availableActions);
  if (pendingExtension && extensionPaidFlag && !pendingExtension.is_paid) {
    pendingExtension = { ...pendingExtension, is_paid: true };
  }

  return {
    ...detail,
    available_actions: availableActions,
    pending_extension: pendingExtension,
  };
}

async function enrichExtensionPaymentFromBooking(
  ext: VendorExtension
): Promise<VendorExtension> {
  if (isExtensionAwaitingVendorAction(ext)) return ext;

  try {
    const detail = await fetchVendorBookingDetail(ext.booking_id);
    const pending = detail.pending_extension;
    if (!pending) return ext;
    if (pending.id && ext.id && pending.id !== ext.id) return ext;

    const merged: VendorExtension = {
      ...ext,
      paid_at: pending.paid_at ?? ext.paid_at,
      payment_method: pending.payment_method ?? ext.payment_method,
      is_paid:
        pending.is_paid === true ||
        isExtensionAwaitingVendorAction({
          status: pending.status,
          paid_at: pending.paid_at,
          is_paid: pending.is_paid,
          payment_method: pending.payment_method,
        }),
    };
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
  const params = new URLSearchParams({
    status,
    page: String(page),
    per_page: String(perPage),
  });
  const response = await fetch(`${API_BASE_URL}/vendor/extensions?${params}`, {
    headers: authHeaders(),
  });
  const { items, pagination } = await parsePaginated<Record<string, unknown>>(response);
  const normalized = items.map((item) => normalizeVendorExtension(item));
  const enriched = await Promise.all(
    normalized.map((ext) => enrichExtensionPaymentFromBooking(ext))
  );
  return { items: enriched, pagination };
}

export async function enrichBookingDetailWithExtensions(
  detail: VendorBookingDetail,
  knownExtensions?: VendorExtension[]
): Promise<VendorBookingDetail> {
  const pendingId = detail.pending_extension?.id;
  const queueSources = [...(knownExtensions ?? [])];

  if (!findExtensionForBooking(detail.id, queueSources, pendingId)) {
    const { items } = await fetchVendorExtensions("pending", 1, 50);
    queueSources.push(...items);
  }

  const match = findExtensionForBooking(detail.id, queueSources, pendingId);
  if (!match) return detail;

  const pendingExtension = detail.pending_extension
    ? mergePendingExtensionWithListItem(detail.pending_extension, match)
    : vendorExtensionToPending(match);
  const canActOnExtension = isExtensionAwaitingVendorAction(pendingExtension);

  return {
    ...detail,
    pending_extension: pendingExtension,
    available_actions: {
      ...detail.available_actions,
      can_approve_extension: canActOnExtension,
      can_reject_extension: canActOnExtension,
    },
  };
}

export async function approveExtension(
  extensionId: string,
  paymentMethod: "cod" | "juspay" = "juspay"
): Promise<{ extension_id: string; status: string }> {
  const response = await fetch(
    `${API_BASE_URL}/vendor/extensions/${extensionId}/approve`,
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
    `${API_BASE_URL}/vendor/extensions/${extensionId}/reject`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ reason: reason ?? null }),
    }
  );
  return parseData(response);
}

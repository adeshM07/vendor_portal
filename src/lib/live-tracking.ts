import {
  API_BASE_URL,
  ApiRequestError,
  RENTAL_API_BASE_URL,
  type ApiErrorBody,
  type ApiSuccessBody,
} from "@/lib/api";
import { getVendorSession } from "@/lib/auth";
import { distanceKm } from "@/lib/format";

export type LiveTrackingStatus = "live" | "offline" | "paused";

export type BookingTrackingPhase =
  | "en_route"
  | "arrived"
  | "started"
  | "ended"
  | "other";

export interface LiveTrackingState {
  status: LiveTrackingStatus;
  latitude: number;
  longitude: number;
  lastUpdatedAt: string;
  address: string | null;
  bookingStatus: string | null;
  siteLat: number | null;
  siteLng: number | null;
  distanceToSiteKm: number | null;
}

/** Raw API payload — field names may vary by backend version. */
export interface BookingTrackingApiData {
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  location_address?: string | null;
  site_address?: string | null;
  last_updated_at?: string | null;
  updated_at?: string | null;
  recorded_at?: string | null;
  timestamp?: string | null;
  tracking_status?: string | null;
  is_live?: boolean | null;
  start_otp?: string | null;
  end_otp?: string | null;
  booking_status?: string | null;
  site_lat?: number | null;
  site_lng?: number | null;
  distance_to_site_m?: number | null;
  distance_to_site_km?: number | null;
}

/** Route points used when NEXT_PUBLIC_LIVE_TRACKING_MODE=dummy. */
export const DUMMY_TRACKING_ROUTE: ReadonlyArray<{
  latitude: number;
  longitude: number;
  address: string;
}> = [
  {
    latitude: 13.1986,
    longitude: 77.7066,
    address: "Kempegowda Airport, Bengaluru",
  },
  {
    latitude: 12.9788,
    longitude: 77.5996,
    address: "M. Chinnaswamy Stadium, Bengaluru",
  },
  {
    latitude: 12.9507,
    longitude: 77.5844,
    address: "Lalbagh Botanical Garden, Bengaluru",
  },
  {
    latitude: 12.998,
    longitude: 77.592,
    address: "Bengaluru Palace, Bengaluru",
  },
  {
    latitude: 12.9719,
    longitude: 77.5958,
    address: "UB City, Bengaluru",
  },
  {
    latitude: 13.0451,
    longitude: 77.6266,
    address: "Manyata Tech Park, Bengaluru",
  },
  {
    latitude: 12.9392,
    longitude: 77.6974,
    address: "Prestige Tech Park, Bengaluru",
  },
  {
    latitude: 12.9958,
    longitude: 77.6964,
    address: "Phoenix Marketcity, Bengaluru",
  },
  {
    latitude: 12.9822,
    longitude: 77.6083,
    address: "Commercial Street, Bengaluru",
  },
  {
    latitude: 12.8452,
    longitude: 77.6632,
    address: "Electronic City Phase 1, Bengaluru",
  },
];

const LIVE_TRACKING_VISIBLE_STATUSES = new Set([
  "active",
  "in_progress",
  "started",
  "operator_assigned",
  "arrived",
  "extended",
  "extension_pending",
  "ended",
]);

const LIVE_TRACKING_HIDDEN_STATUSES = new Set([
  "completed",
  "cancelled",
  "canceled",
  "rejected",
  "confirmed",
  "pending",
  "available",
]);

export const LIVE_TRACKING_POLL_INTERVAL_MS = 5000;

/** Same haversine distance for vendor UI and tracking card (matches map position). */
export function resolveDistanceToSiteKm(
  equipmentLat: number,
  equipmentLng: number,
  siteLat: number | null | undefined,
  siteLng: number | null | undefined
): number | null {
  if (siteLat == null || siteLng == null) return null;
  return distanceKm(equipmentLat, equipmentLng, siteLat, siteLng);
}

export function isDummyLiveTrackingEnabled(): boolean {
  // TESTING: simulated route only. Real device GPS is disabled until production.
  return true;
  /*
  const mode = process.env.NEXT_PUBLIC_LIVE_TRACKING_MODE?.trim().toLowerCase();
  if (mode === "api") return false;
  return true;
  */
}

export function isLiveTrackingVisible(
  bookingStatus: string,
  options?: { preview?: boolean }
): boolean {
  if (options?.preview && process.env.NODE_ENV === "development") {
    return true;
  }

  const normalized = bookingStatus.toLowerCase().replace(/\s+/g, "_");
  if (LIVE_TRACKING_HIDDEN_STATUSES.has(normalized)) return false;
  return LIVE_TRACKING_VISIBLE_STATUSES.has(normalized);
}

export function normalizeBookingStatusKey(status: string | null | undefined): string {
  return (status ?? "").toLowerCase().replace(/\s+/g, "_");
}

export function resolveBookingTrackingPhase(
  bookingStatus: string | null | undefined
): BookingTrackingPhase {
  const key = normalizeBookingStatusKey(bookingStatus);
  if (key === "operator_assigned") return "en_route";
  if (key === "arrived") return "arrived";
  if (key === "started" || key === "extended" || key === "extension_pending") {
    return "started";
  }
  if (key === "ended" || key === "completed") return "ended";
  return "other";
}

export function bookingTrackingPhaseLabel(phase: BookingTrackingPhase): string {
  switch (phase) {
    case "en_route":
      return "En route to site";
    case "arrived":
      return "Arrived at site";
    case "started":
      return "Job in progress";
    case "ended":
      return "Job completed";
    default:
      return "Tracking";
  }
}

export function buildDummyTrackingState(
  routeIndex: number,
  at: Date = new Date()
): LiveTrackingState {
  const point = DUMMY_TRACKING_ROUTE[routeIndex % DUMMY_TRACKING_ROUTE.length];
  return {
    status: "live",
    latitude: point.latitude,
    longitude: point.longitude,
    lastUpdatedAt: at.toISOString(),
    address: point.address,
    bookingStatus: "operator_assigned",
    siteLat: null,
    siteLng: null,
    distanceToSiteKm: null,
  };
}

export function buildMapViewUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function buildDirectionsUrl(options: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  originLabel?: string | null;
  destinationLabel?: string | null;
}): string {
  const origin = options.originLabel
    ? encodeURIComponent(`${options.originLabel}, Bengaluru, Karnataka, India`)
    : `${options.originLat},${options.originLng}`;
  const destination = options.destinationLabel
    ? encodeURIComponent(options.destinationLabel)
    : `${options.destinationLat},${options.destinationLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
}

function trackingAuthHeaders(): HeadersInit {
  const session = getVendorSession();
  if (!session?.accessToken) {
    throw new ApiRequestError("Session expired. Please sign in again.", "UNAUTHORIZED", 401);
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessToken}`,
  };
}

async function parseTrackingResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiSuccessBody<T> | ApiErrorBody;
  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? "Failed to load live tracking.",
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }
  return (body as ApiSuccessBody<T>).data;
}

function resolveTrackingStatus(raw: BookingTrackingApiData): LiveTrackingStatus {
  const status = (raw.tracking_status ?? "").toLowerCase();
  if (raw.is_live === false || status === "offline") return "offline";
  if (status === "paused") return "paused";
  return "live";
}

export function normalizeBookingTracking(
  raw: BookingTrackingApiData
): LiveTrackingState | null {
  const latitude = raw.latitude ?? raw.lat;
  const longitude = raw.longitude ?? raw.lng;
  if (latitude == null || longitude == null) return null;

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const lastUpdatedAt =
    raw.last_updated_at ??
    raw.updated_at ??
    raw.recorded_at ??
    raw.timestamp ??
    new Date().toISOString();

  const siteLatRaw = raw.site_lat;
  const siteLngRaw = raw.site_lng;
  const siteLat =
    siteLatRaw != null && !Number.isNaN(Number(siteLatRaw)) ? Number(siteLatRaw) : null;
  const siteLng =
    siteLngRaw != null && !Number.isNaN(Number(siteLngRaw)) ? Number(siteLngRaw) : null;

  let distanceToSiteKm: number | null = null;
  if (raw.distance_to_site_km != null && !Number.isNaN(Number(raw.distance_to_site_km))) {
    distanceToSiteKm = Number(raw.distance_to_site_km);
  } else if (
    raw.distance_to_site_m != null &&
    !Number.isNaN(Number(raw.distance_to_site_m))
  ) {
    distanceToSiteKm = Number(raw.distance_to_site_m) / 1000;
  } else if (siteLat != null && siteLng != null) {
    distanceToSiteKm = distanceKm(lat, lng, siteLat, siteLng);
  }

  return {
    status: resolveTrackingStatus(raw),
    latitude: lat,
    longitude: lng,
    lastUpdatedAt,
    address: raw.address ?? raw.location_address ?? raw.site_address ?? null,
    bookingStatus: raw.booking_status ?? null,
    siteLat,
    siteLng,
    distanceToSiteKm,
  };
}

function buildTrackingUrl(bookingId: string): string {
  const customBase = process.env.NEXT_PUBLIC_TRACKING_API_BASE_URL?.replace(/\/$/, "");
  if (customBase) {
    return `${customBase}/rentals/bookings/${bookingId}/tracking`;
  }

  const useRentalApi = process.env.NEXT_PUBLIC_TRACKING_USE_RENTAL_API === "true";
  if (useRentalApi) {
    return `${RENTAL_API_BASE_URL}/rentals/bookings/${bookingId}/tracking`;
  }

  return `${API_BASE_URL}/rentals/bookings/${bookingId}/tracking`;
}

/**
 * Poll this from the Live Tracking card (every 5s).
 * Backend: GET /api/v1/rentals/bookings/{booking_id}/tracking
 */
export async function fetchBookingTracking(
  bookingId: string
): Promise<LiveTrackingState> {
  const response = await fetch(buildTrackingUrl(bookingId), {
    headers: trackingAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseTrackingResponse<BookingTrackingApiData>(response);
  const normalized = normalizeBookingTracking(data);
  if (!normalized) {
    throw new ApiRequestError(
      "Tracking response did not include valid coordinates.",
      "INVALID_TRACKING_DATA",
      502
    );
  }
  return normalized;
}

/** @deprecated Use fetchBookingTracking */
export async function fetchBookingLocation(
  bookingId: string
): Promise<LiveTrackingState> {
  return fetchBookingTracking(bookingId);
}

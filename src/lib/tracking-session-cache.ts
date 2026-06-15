export interface VendorTrackingSession {
  lat: number;
  lng: number;
  lastUpdatedAt: string;
  pushCount: number;
  simulationStep?: number;
}

function sessionKey(bookingId: string): string {
  return `l2b_vendor_tracking_${bookingId}`;
}

export function readVendorTrackingSession(
  bookingId: string
): VendorTrackingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(bookingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VendorTrackingSession;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeVendorTrackingSession(
  bookingId: string,
  session: VendorTrackingSession
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(sessionKey(bookingId), JSON.stringify(session));
}

export function pickNewerTrackingSession(
  api: VendorTrackingSession | null,
  cached: VendorTrackingSession | null
): VendorTrackingSession | null {
  if (!api) return cached;
  if (!cached) return api;
  const apiTime = Date.parse(api.lastUpdatedAt);
  const cachedTime = Date.parse(cached.lastUpdatedAt);
  if (Number.isNaN(apiTime)) return cached;
  if (Number.isNaN(cachedTime)) return api;
  return apiTime >= cachedTime ? api : cached;
}

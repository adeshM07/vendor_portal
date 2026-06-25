const MIN_DEMO_ROUTE_MINUTES = 5;
const MAX_DEMO_ROUTE_MINUTES = 10;
const DEFAULT_DEMO_ROUTE_MINUTES = 8;

export function getDemoRouteDurationMinutes(): number {
  const raw = process.env.NEXT_PUBLIC_DEMO_ROUTE_DURATION_MINUTES;
  if (raw != null) {
    const minutes = Number.parseFloat(raw);
    if (!Number.isNaN(minutes) && minutes > 0) {
      return Math.min(MAX_DEMO_ROUTE_MINUTES, Math.max(MIN_DEMO_ROUTE_MINUTES, minutes));
    }
  }
  return DEFAULT_DEMO_ROUTE_MINUTES;
}

export function getDemoRouteDurationMs(): number {
  return getDemoRouteDurationMinutes() * 60 * 1000;
}

function parseGpsPushIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_GPS_PUSH_INTERVAL_MS;
  if (raw != null) {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed >= 1000) return parsed;
  }
  return 1000;
}

export const GPS_PUSH_INTERVAL_MS = parseGpsPushIntervalMs();

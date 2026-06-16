import { getDemoRouteDurationMs, GPS_PUSH_INTERVAL_MS } from "@/lib/demo-route";
import { distanceKm } from "@/lib/format";
import {
  interpolateRoutePoint,
  type LatLng,
  type RouteEndpoints,
} from "@/lib/route-interpolation";
import {
  readVendorTrackingSession,
  writeVendorTrackingSession,
  type VendorTrackingSession,
} from "@/lib/tracking-session-cache";
import { updateEquipmentLocation } from "@/lib/vendor";

type CompleteHandler = () => void | Promise<void>;

interface ActiveSimulation {
  bookingId: string;
  equipmentId: string;
  route: RouteEndpoints;
  simulatedElapsedMs: number;
  lastTickAt: number | null;
  paused: boolean;
  pushIntervalId: ReturnType<typeof setInterval> | null;
  isPushing: boolean;
  pushPending: boolean;
  completed: boolean;
  onComplete: CompleteHandler | null;
}

const active = new Map<string, ActiveSimulation>();
const listeners = new Map<string, Set<(pos: LatLng) => void>>();
let visibilityBound = false;

function routeFromSession(session: VendorTrackingSession): RouteEndpoints | null {
  if (
    session.routeStartLat == null ||
    session.routeStartLng == null ||
    session.routeEndLat == null ||
    session.routeEndLng == null
  ) {
    return null;
  }
  return {
    startLat: session.routeStartLat,
    startLng: session.routeStartLng,
    endLat: session.routeEndLat,
    endLng: session.routeEndLng,
  };
}

function getElapsedMs(sim: ActiveSimulation): number {
  return sim.simulatedElapsedMs;
}

function getSimulationStepCount(): number {
  const duration = getDemoRouteDurationMs();
  return Math.max(30, Math.round(duration / GPS_PUSH_INTERVAL_MS));
}

function getTotalRouteDistanceM(route: RouteEndpoints): number {
  return Math.round(
    distanceKm(route.startLat, route.startLng, route.endLat, route.endLng) * 1000
  );
}

function resolveDistanceToSiteM(
  route: RouteEndpoints,
  progress: number,
  previousDistanceM: number | undefined
): number {
  if (progress >= 1) return 0;

  const totalRouteM = getTotalRouteDistanceM(route);
  const progressBasedM = Math.round(totalRouteM * (1 - progress));

  if (previousDistanceM == null) return progressBasedM;
  if (progressBasedM < previousDistanceM) return progressBasedM;

  return previousDistanceM > 0 ? Math.max(0, previousDistanceM - 1) : 0;
}

function getProgress(sim: ActiveSimulation): number {
  const duration = getDemoRouteDurationMs();
  if (duration <= 0) return 1;
  return Math.min(1, getElapsedMs(sim) / duration);
}

function getPosition(sim: ActiveSimulation): LatLng {
  const progress = getProgress(sim);
  if (progress >= 1) {
    return { lat: sim.route.endLat, lng: sim.route.endLng };
  }
  return interpolateRoutePoint(sim.route, progress);
}

function flushElapsed(sim: ActiveSimulation): void {
  if (sim.paused) return;
  sim.lastTickAt = Date.now();
}

function persist(sim: ActiveSimulation): void {
  const position = getPosition(sim);
  const duration = getDemoRouteDurationMs();
  const progress = getProgress(sim);
  const steps = getSimulationStepCount();

  writeVendorTrackingSession(sim.bookingId, {
    lat: position.lat,
    lng: position.lng,
    lastUpdatedAt: new Date().toISOString(),
    pushCount: readVendorTrackingSession(sim.bookingId)?.pushCount ?? 0,
    simulationStep: Math.round(progress * steps),
    simulationActive: !sim.completed && getProgress(sim) < 1,
    simulatedElapsedMs: getElapsedMs(sim),
    equipmentId: sim.equipmentId,
    routeStartLat: sim.route.startLat,
    routeStartLng: sim.route.startLng,
    routeEndLat: sim.route.endLat,
    routeEndLng: sim.route.endLng,
  });
}

function notify(bookingId: string, position: LatLng): void {
  const subs = listeners.get(bookingId);
  if (!subs) return;
  for (const cb of subs) cb(position);
}

function schedulePush(sim: ActiveSimulation): void {
  if (sim.completed) return;
  if (sim.isPushing) {
    sim.pushPending = true;
    return;
  }
  void pushPosition(sim);
}

async function pushPosition(sim: ActiveSimulation): Promise<void> {
  if (sim.completed || sim.paused) return;
  if (sim.isPushing) {
    sim.pushPending = true;
    return;
  }

  const sessionBefore = readVendorTrackingSession(sim.bookingId);
  if (sessionBefore?.arrivedAtSite) return;

  const duration = getDemoRouteDurationMs();
  const steps = getSimulationStepCount();
  const nextElapsed = Math.min(
    duration,
    sim.simulatedElapsedMs + duration / steps
  );
  const progress = duration <= 0 ? 1 : Math.min(1, nextElapsed / duration);
  const position =
    progress >= 1
      ? { lat: sim.route.endLat, lng: sim.route.endLng }
      : interpolateRoutePoint(sim.route, progress);

  sim.simulatedElapsedMs = nextElapsed;
  sim.lastTickAt = Date.now();

  const distanceToSiteM = resolveDistanceToSiteM(
    sim.route,
    progress,
    sessionBefore?.lastDistanceToSiteM
  );

  sim.isPushing = true;
  try {
    await updateEquipmentLocation(
      sim.equipmentId,
      position.lat,
      position.lng,
      { distanceToSiteM }
    );
    const session = readVendorTrackingSession(sim.bookingId);
    const steps = getSimulationStepCount();
    writeVendorTrackingSession(sim.bookingId, {
      lat: position.lat,
      lng: position.lng,
      lastUpdatedAt: new Date().toISOString(),
      pushCount: (session?.pushCount ?? 0) + 1,
      simulationStep: Math.round(progress * steps),
      simulationActive: progress < 1,
      simulatedElapsedMs: sim.simulatedElapsedMs,
      equipmentId: sim.equipmentId,
      routeStartLat: sim.route.startLat,
      routeStartLng: sim.route.startLng,
      routeEndLat: sim.route.endLat,
      routeEndLng: sim.route.endLng,
      arrivedAtSite: progress >= 1,
      lastDistanceToSiteM: distanceToSiteM,
    });
    notify(sim.bookingId, position);
  } finally {
    sim.isPushing = false;
  }

  if (progress >= 1) {
    await completeSimulation(sim);
    return;
  }

  persist(sim);

  if (sim.pushPending) {
    sim.pushPending = false;
    schedulePush(sim);
  }
}

async function completeSimulation(sim: ActiveSimulation): Promise<void> {
  if (sim.completed) return;
  sim.completed = true;

  if (sim.pushIntervalId != null) {
    clearInterval(sim.pushIntervalId);
    sim.pushIntervalId = null;
  }

  const final = { lat: sim.route.endLat, lng: sim.route.endLng };
  notify(sim.bookingId, final);

  writeVendorTrackingSession(sim.bookingId, {
    lat: final.lat,
    lng: final.lng,
    lastUpdatedAt: new Date().toISOString(),
    pushCount: readVendorTrackingSession(sim.bookingId)?.pushCount ?? 0,
    simulationActive: false,
    simulatedElapsedMs: getDemoRouteDurationMs(),
    equipmentId: sim.equipmentId,
    routeStartLat: sim.route.startLat,
    routeStartLng: sim.route.startLng,
    routeEndLat: sim.route.endLat,
    routeEndLng: sim.route.endLng,
    arrivedAtSite: true,
    lastDistanceToSiteM: 0,
  });

  const handler = sim.onComplete;
  active.delete(sim.bookingId);
  if (handler) {
    await handler();
  }
}

function pauseSimulation(sim: ActiveSimulation): void {
  if (sim.paused || sim.completed) return;
  flushElapsed(sim);
  sim.paused = true;
  sim.lastTickAt = null;
  persist(sim);
}

function resumeSimulation(sim: ActiveSimulation): void {
  if (!sim.paused || sim.completed) return;
  sim.paused = false;
  sim.lastTickAt = Date.now();
}

function clearPushInterval(sim: ActiveSimulation): void {
  if (sim.pushIntervalId != null) {
    clearInterval(sim.pushIntervalId);
    sim.pushIntervalId = null;
  }
}

function bindVisibilityHandler(): void {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      for (const sim of active.values()) pauseSimulation(sim);
      return;
    }
    for (const sim of active.values()) resumeSimulation(sim);
  });
}

export function isSimulatedRouteActive(bookingId: string): boolean {
  const session = readVendorTrackingSession(bookingId);
  if (session?.arrivedAtSite) return false;

  const sim = active.get(bookingId);
  if (sim && !sim.completed) return true;
  return Boolean(session?.simulationActive);
}

export function getSimulatedRoutePosition(bookingId: string): LatLng | null {
  const session = readVendorTrackingSession(bookingId);
  if (session?.simulationActive) {
    return { lat: session.lat, lng: session.lng };
  }

  const sim = active.get(bookingId);
  if (sim && !sim.completed) {
    return getPosition(sim);
  }

  if (!session?.simulationActive) return null;
  const route = routeFromSession(session);
  if (!route || session.simulatedElapsedMs == null) return null;

  const duration = getDemoRouteDurationMs();
  const progress = Math.min(1, session.simulatedElapsedMs / duration);
  return interpolateRoutePoint(route, progress);
}

export function subscribeSimulatedRoute(
  bookingId: string,
  listener: (pos: LatLng) => void
): () => void {
  let subs = listeners.get(bookingId);
  if (!subs) {
    subs = new Set();
    listeners.set(bookingId, subs);
  }
  subs.add(listener);

  const current = getSimulatedRoutePosition(bookingId);
  if (current) listener(current);

  return () => {
    subs?.delete(listener);
    if (subs?.size === 0) listeners.delete(bookingId);
  };
}

export function startSimulatedRoute({
  bookingId,
  equipmentId,
  route,
  simulatedElapsedMs = 0,
  onComplete,
}: {
  bookingId: string;
  equipmentId: string;
  route: RouteEndpoints;
  simulatedElapsedMs?: number;
  onComplete?: CompleteHandler;
}): void {
  bindVisibilityHandler();

  const existingSession = readVendorTrackingSession(bookingId);
  if (existingSession?.arrivedAtSite) return;

  stopSimulatedRoute(bookingId);

  const sim: ActiveSimulation = {
    bookingId,
    equipmentId,
    route,
    simulatedElapsedMs: Math.max(0, simulatedElapsedMs),
    lastTickAt: Date.now(),
    paused: false,
    pushIntervalId: null,
    isPushing: false,
    pushPending: false,
    completed: false,
    onComplete: onComplete ?? null,
  };

  active.set(bookingId, sim);
  persist(sim);
  schedulePush(sim);
  sim.pushIntervalId = setInterval(() => {
    schedulePush(sim);
  }, GPS_PUSH_INTERVAL_MS);
}

export function setSimulatedRouteCompleteHandler(
  bookingId: string,
  handler: CompleteHandler | null
): void {
  const sim = active.get(bookingId);
  if (sim) sim.onComplete = handler;
}

export function stopSimulatedRoute(bookingId: string): void {
  const sim = active.get(bookingId);
  if (!sim) return;

  flushElapsed(sim);
  clearPushInterval(sim);

  const session = readVendorTrackingSession(bookingId);
  if (session) {
    writeVendorTrackingSession(bookingId, {
      ...session,
      simulationActive: false,
      simulatedElapsedMs: getElapsedMs(sim),
    });
  }

  active.delete(bookingId);
}

export function resumeSimulatedRoutesFromSession(): void {
  if (typeof window === "undefined") return;

  bindVisibilityHandler();

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith("l2b_vendor_tracking_")) continue;

    const bookingId = key.replace("l2b_vendor_tracking_", "");
    if (active.has(bookingId)) continue;

    const session = readVendorTrackingSession(bookingId);
    if (
      !session?.simulationActive ||
      session.arrivedAtSite ||
      !session.equipmentId
    ) {
      continue;
    }

    const route = routeFromSession(session);
    if (!route) continue;

    const duration = getDemoRouteDurationMs();
    if ((session.simulatedElapsedMs ?? 0) >= duration) continue;

    startSimulatedRoute({
      bookingId,
      equipmentId: session.equipmentId,
      route,
      simulatedElapsedMs: session.simulatedElapsedMs ?? 0,
    });
  }
}

if (typeof window !== "undefined") {
  resumeSimulatedRoutesFromSession();
}

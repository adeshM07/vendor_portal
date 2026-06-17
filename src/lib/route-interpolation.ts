export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteEndpoints {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export interface MapBbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function interpolateRoutePoint(
  route: RouteEndpoints,
  progress: number
): LatLng {
  const t = Math.min(1, Math.max(0, progress));
  return {
    lat: route.startLat + (route.endLat - route.startLat) * t,
    lng: route.startLng + (route.endLng - route.startLng) * t,
  };
}

export function computeMapBbox(
  points: ReadonlyArray<LatLng | null | undefined>,
  padding = 0.012
): MapBbox {
  const valid = points.filter(
    (p): p is LatLng => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );

  if (valid.length === 0) {
    return {
      minLat: 12.9 - padding,
      maxLat: 12.9 + padding,
      minLng: 77.5 - padding,
      maxLng: 77.5 + padding,
    };
  }

  let minLat = valid[0].lat;
  let maxLat = valid[0].lat;
  let minLng = valid[0].lng;
  let maxLng = valid[0].lng;

  for (const point of valid.slice(1)) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  return {
    minLat: minLat - padding,
    maxLat: maxLat + padding,
    minLng: minLng - padding,
    maxLng: maxLng + padding,
  };
}

/** Map lat/lng into 0–100% coordinates for overlay markers (y grows downward). */
export function projectLatLngToPercent(
  lat: number,
  lng: number,
  bbox: MapBbox
): { x: number; y: number } {
  const lngSpan = bbox.maxLng - bbox.minLng || 1;
  const latSpan = bbox.maxLat - bbox.minLat || 1;
  return {
    x: ((lng - bbox.minLng) / lngSpan) * 100,
    y: ((bbox.maxLat - lat) / latSpan) * 100,
  };
}

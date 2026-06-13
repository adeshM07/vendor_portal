export interface VendorStartLocation {
  location: string;
  lat: number;
  lng: number;
}

/** Test starting points — one per vendor (Bengaluru). */
export const VENDOR_START_LOCATIONS: ReadonlyArray<VendorStartLocation> = [
  { location: "Kempegowda Airport", lat: 13.1986, lng: 77.7066 },
  { location: "M. Chinnaswamy Stadium", lat: 12.9788, lng: 77.5996 },
  { location: "Lalbagh Botanical Garden", lat: 12.9507, lng: 77.5844 },
  { location: "Bengaluru Palace", lat: 12.998, lng: 77.592 },
  { location: "UB City", lat: 12.9719, lng: 77.5958 },
  { location: "Manyata Tech Park", lat: 13.0451, lng: 77.6266 },
  { location: "Prestige Tech Park", lat: 12.9392, lng: 77.6974 },
  { location: "Phoenix Marketcity", lat: 12.9958, lng: 77.6964 },
  { location: "Commercial Street", lat: 12.9822, lng: 77.6083 },
  { location: "Electronic City Phase 1", lat: 12.8452, lng: 77.6632 },
];

function hashToIndex(key: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

/** Pick a stable start location for a vendor (falls back to user id). */
export function getVendorStartLocation(
  vendorId: string | null | undefined,
  userId?: string | null
): VendorStartLocation {
  const key = vendorId?.trim() || userId?.trim() || "default";
  return VENDOR_START_LOCATIONS[hashToIndex(key, VENDOR_START_LOCATIONS.length)];
}

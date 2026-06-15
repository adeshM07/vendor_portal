"use client";

import { useEffect, useState } from "react";
import { fetchVendorMe } from "@/lib/vendor";
import {
  getVendorStartLocation,
  type VendorStartLocation,
} from "@/lib/vendor-start-locations";

export function useVendorStartLocation(): VendorStartLocation | null {
  const [startLocation, setStartLocation] = useState<VendorStartLocation | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchVendorMe()
      .then((profile) => {
        if (!cancelled) {
          setStartLocation(getVendorStartLocation(profile.vendor_id, profile.user_id));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStartLocation(getVendorStartLocation(null, null));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return startLocation;
}

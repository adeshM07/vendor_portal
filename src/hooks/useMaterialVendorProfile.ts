"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import {
  fetchMaterialVendorMeResult,
  type MaterialVendorProfile,
} from "@/lib/material-vendor";

function buildProfileWarning(profile: MaterialVendorProfile | null): string {
  if (!profile) {
    return "Could not load supplier profile from GET /materials/vendor/me.";
  }
  if (!profile.is_linked) {
    return "Supplier profile is not linked for this login.";
  }
  return "";
}

export function useMaterialVendorProfile() {
  const [profile, setProfile] = useState<MaterialVendorProfile | null>(null);
  const [loadWarning, setLoadWarning] = useState("");
  const [isLinked, setIsLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const { profile: me, apiError } = await fetchMaterialVendorMeResult();
      setProfile(me);
      setIsLinked(Boolean(me?.is_linked));
      setLoadWarning(apiError?.message ?? buildProfileWarning(me));
    } catch (err) {
      setProfile(null);
      setIsLinked(false);
      setLoadWarning(
        err instanceof ApiRequestError
          ? err.message
          : buildProfileWarning(null)
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const greetingName = profile?.name?.trim().split(/\s+/)[0] || "Supplier";

  return {
    profile,
    greetingName,
    loadWarning,
    isLinked,
    isLoading,
    refreshProfile,
  };
}

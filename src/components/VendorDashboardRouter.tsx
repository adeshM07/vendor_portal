"use client";

import { getVendorSession } from "@/lib/auth";
import {
  MATERIAL_VENDOR_PHONE_RANGE,
  RENTAL_VENDOR_PHONE_RANGE,
} from "@/lib/material-vendor-auth";
import { getVendorTypeFromPhone } from "@/lib/vendor-type";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { MaterialVendorDashboard } from "@/components/materials/MaterialVendorDashboard";
import { PortalLoadingShell } from "@/components/SessionGate";

/**
 * Routes authenticated vendors to the correct dashboard based on login phone.
 * Rental and material flows stay fully isolated — each dashboard calls only its own APIs.
 */
export function VendorDashboardRouter() {
  const session = getVendorSession();
  const mobile = session?.mobile ?? "";
  const vendorType = getVendorTypeFromPhone(mobile);

  if (!vendorType) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Unsupported vendor number</h1>
          <p className="mt-2 text-sm text-gray-600">
            This portal supports rental vendors ({RENTAL_VENDOR_PHONE_RANGE}) and material
            suppliers ({MATERIAL_VENDOR_PHONE_RANGE}). Sign in with a registered vendor phone.
          </p>
        </div>
      </div>
    );
  }

  if (vendorType === "rental") {
    return <DashboardContent />;
  }

  return <MaterialVendorDashboard />;
}

export function VendorDashboardRouterFallback() {
  return <PortalLoadingShell />;
}

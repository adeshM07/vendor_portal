import { Suspense } from "react";
import { MaterialVendorDashboard } from "@/components/materials/MaterialVendorDashboard";
import { PortalLoadingShell, SessionGate } from "@/components/SessionGate";

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <Suspense fallback={<PortalLoadingShell />}>
        <SessionGate>
          <MaterialVendorDashboard />
        </SessionGate>
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { PortalLoadingShell, SessionGate } from "@/components/SessionGate";
import "@/lib/simulated-route-runner";

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <Suspense fallback={<PortalLoadingShell />}>
        <SessionGate>
          <DashboardContent />
        </SessionGate>
      </Suspense>
    </div>
  );
}

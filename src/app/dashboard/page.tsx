import { Suspense } from "react";
import {
  VendorDashboardRouter,
  VendorDashboardRouterFallback,
} from "@/components/VendorDashboardRouter";
import { SessionGate } from "@/components/SessionGate";
import "@/lib/simulated-route-runner";

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <Suspense fallback={<VendorDashboardRouterFallback />}>
        <SessionGate>
          <VendorDashboardRouter />
        </SessionGate>
      </Suspense>
    </div>
  );
}

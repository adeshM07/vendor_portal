import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center bg-gray-50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}

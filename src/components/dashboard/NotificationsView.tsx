import { Bell } from "lucide-react";

export function NotificationsView() {
  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <Bell className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-semibold text-gray-900">No notifications yet</p>
        <p className="mt-1 max-w-xs text-xs text-gray-500">
          Booking updates and alerts will appear here when available.
        </p>
      </div>
    </div>
  );
}

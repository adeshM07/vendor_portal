"use client";

import { CalendarDays, Home, IndianRupee, Bell, Building2 } from "lucide-react";

export type DashboardView = "home" | "calendar" | "earnings" | "notifications";

interface DashboardSidebarProps {
  active: DashboardView;
  onChange: (view: DashboardView) => void;
}

const items: { id: DashboardView; label: string; icon: typeof Home }[] = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "home", label: "Home", icon: Home },
  { id: "earnings", label: "Earning", icon: IndianRupee },
  { id: "notifications", label: "Notification", icon: Bell },
];

export function DashboardSidebar({ active, onChange }: DashboardSidebarProps) {
  return (
    <aside className="sticky top-0 flex h-dvh min-h-dvh w-56 shrink-0 flex-col self-start border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600">
          <Building2 className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">Link2Build</p>
          <p className="text-[10px] text-gray-500">Vendor Portal</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "bg-amber-50 text-amber-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${isActive ? "text-amber-600" : ""}`}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span className={`text-sm font-medium ${isActive ? "text-amber-700" : ""}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/** @deprecated Use DashboardSidebar */
export const DashboardBottomNav = DashboardSidebar;

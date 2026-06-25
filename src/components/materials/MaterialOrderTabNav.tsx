import type { MaterialOrderTab } from "@/lib/material-vendor";

interface MaterialOrderTabNavProps {
  activeTab: MaterialOrderTab;
  onTabChange: (tab: MaterialOrderTab) => void;
  counts: { available: number; active: number; completed: number };
}

const tabs: { id: MaterialOrderTab; label: string }[] = [
  { id: "available", label: "New" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

export function MaterialOrderTabNav({
  activeTab,
  onTabChange,
  counts,
}: MaterialOrderTabNavProps) {
  return (
    <div className="w-full">
      <div className="flex gap-2 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

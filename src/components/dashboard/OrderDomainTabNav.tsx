import { Boxes, Truck } from "lucide-react";
import type { OrderDomain } from "@/lib/portal-items";

interface OrderDomainTabNavProps {
  activeDomain: OrderDomain;
  onDomainChange: (domain: OrderDomain) => void;
  rentalTotal: number;
  materialTotal: number;
}

const domains: {
  id: OrderDomain;
  label: string;
  icon: typeof Truck;
}[] = [
  { id: "rental", label: "Rental", icon: Truck },
  { id: "material", label: "Material", icon: Boxes },
];

export function OrderDomainTabNav({
  activeDomain,
  onDomainChange,
  rentalTotal,
  materialTotal,
}: OrderDomainTabNavProps) {
  return (
    <div className="w-full">
      <div className="flex gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5">
        {domains.map((domain) => {
          const isActive = activeDomain === domain.id;
          const Icon = domain.icon;
          const count = domain.id === "rental" ? rentalTotal : materialTotal;
          return (
            <button
              key={domain.id}
              type="button"
              onClick={() => onDomainChange(domain.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${isActive ? "text-amber-600" : ""}`}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {domain.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  isActive ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"
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

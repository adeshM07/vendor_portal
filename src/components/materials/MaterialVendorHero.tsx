"use client";

import { useRouter } from "next/navigation";
import { Boxes, LogOut, User } from "lucide-react";
import { clearVendorSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import type { MaterialVendorProfile } from "@/lib/material-vendor";

interface MaterialVendorHeroProps {
  mobile: string;
  profile: MaterialVendorProfile | null;
  greetingName: string;
  orderTotal: number;
  activeCount: number;
  isLoading?: boolean;
}

export function MaterialVendorHero({
  mobile,
  profile,
  greetingName,
  orderTotal,
  activeCount,
  isLoading,
}: MaterialVendorHeroProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearVendorSession();
    router.push("/");
  };

  const displayName = profile?.name ?? greetingName;

  return (
    <div className="relative z-20 shrink-0 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 px-4 pb-5 pt-4 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-6 left-1/4 h-32 w-32 rounded-full bg-orange-600/20 blur-2xl" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/20">
              <Boxes className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90">Material Supplier</p>
              <p className="truncate text-base font-semibold">{displayName}</p>
              <p className="text-xs text-white/75">+91 {mobile}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-full border border-white/30 bg-white/10 p-2 text-white/90 transition hover:bg-white/20"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/80">
              Active orders
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {isLoading ? "—" : activeCount}
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/80">
              Listed value
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {isLoading ? "—" : formatCurrency(orderTotal)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

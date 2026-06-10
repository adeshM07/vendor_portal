"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";
import { clearVendorSession } from "@/lib/auth";
import {
  EARNING_PERIOD_OPTIONS,
  earningPeriodLabel,
  type EarningPeriod,
} from "@/lib/earnings";
import { formatCurrency } from "@/lib/format";
import type { VendorProfile } from "@/lib/vendor";

interface DashboardHeroProps {
  mobile: string;
  profile: VendorProfile | null;
  greetingName: string;
  currentEarning: number;
  earningPeriod: EarningPeriod;
  onEarningPeriodChange: (period: EarningPeriod) => void;
  isLoading?: boolean;
}

export function DashboardHero({
  mobile,
  profile,
  greetingName,
  currentEarning,
  earningPeriod,
  onEarningPeriodChange,
  isLoading,
}: DashboardHeroProps) {
  const router = useRouter();
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    clearVendorSession();
    router.push("/");
  };

  useEffect(() => {
    if (!periodOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(event.target as Node)) {
        setPeriodOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [periodOpen]);

  const displayName = profile?.name ?? profile?.contact_name ?? greetingName;

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
              <User className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90">Good Morning!</p>
              <p className="truncate text-base font-semibold">{displayName}</p>
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

        <div className="overflow-visible rounded-2xl bg-white/15 px-4 py-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                Current Earning
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                {isLoading ? "—" : formatCurrency(currentEarning)}
              </p>
            </div>

            <div ref={periodRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPeriodOpen((open) => !open)}
                className="flex min-w-[6.5rem] items-center justify-between gap-2 rounded-lg border border-white/25 bg-white/20 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-haspopup="listbox"
                aria-expanded={periodOpen}
              >
                <span>{earningPeriodLabel(earningPeriod)}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${periodOpen ? "rotate-180" : ""}`}
                />
              </button>

              {periodOpen && (
                <ul
                  role="listbox"
                  className="absolute right-0 top-[calc(100%+0.375rem)] z-50 min-w-full overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
                >
                  {EARNING_PERIOD_OPTIONS.map((option) => {
                    const selected = option.value === earningPeriod;
                    return (
                      <li key={option.value} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onClick={() => {
                            onEarningPeriodChange(option.value);
                            setPeriodOpen(false);
                          }}
                          className={`flex w-full items-center px-3 py-2 text-left text-xs font-medium transition focus:outline-none ${
                            selected
                              ? "bg-amber-50 text-amber-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-white/75">+91 {profile?.phone ?? mobile}</p>
          {profile && !profile.is_linked && (
            <p className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/90">
              Accept your first booking to link your vendor profile
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Building2, LogOut, User } from "lucide-react";
import { clearVendorSession } from "@/lib/auth";

interface DashboardHeaderProps {
  mobile: string;
  vendorName?: string | null;
}

export function DashboardHeader({ mobile, vendorName }: DashboardHeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearVendorSession();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-blue-400">
            <Building2 className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              Link2Build
            </h1>
            <p className="text-[11px] text-zinc-500">Vendor Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 sm:flex">
            <User className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.5} />
            <div className="text-left">
              {vendorName && (
                <p className="max-w-[140px] truncate text-xs font-medium text-zinc-300">
                  {vendorName}
                </p>
              )}
              <p className="text-[11px] text-zinc-500">+91 {mobile}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-200 focus:ring-2 focus:ring-zinc-700/50 focus:outline-none"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

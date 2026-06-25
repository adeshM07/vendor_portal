"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

function subscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function PortalLoadingShell() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
    </div>
  );
}

interface SessionGateProps {
  children: React.ReactNode;
}

export function SessionGate({ children }: SessionGateProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/");
      return;
    }
    setAuthed(true);
  }, [router]);

  if (!isClient || !authed) {
    return <PortalLoadingShell />;
  }

  return <>{children}</>;
}

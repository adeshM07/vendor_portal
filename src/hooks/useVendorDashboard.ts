"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardView } from "@/components/dashboard/DashboardBottomNav";
import { getVendorSession, markSessionExpired } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import {
  acceptBooking,
  rejectBooking,
  type BookingTab,
  type VendorBookingListItem,
  type VendorExtension,
  type VendorProfile,
} from "@/lib/vendor";
import {
  type EarningPeriod,
  sumEarningsInPeriod,
} from "@/lib/earnings";
import { fetchVendorDashboardSnapshot } from "@/lib/vendor-dashboard";

const POLL_MS = 15_000;
const VISIBILITY_DEBOUNCE_MS = 400;

interface DashboardState {
  profile: VendorProfile | null;
  bookings: VendorBookingListItem[];
  counts: { available: number; active: number; completed: number };
  pendingExtensions: VendorExtension[];
  completedBookings: VendorBookingListItem[];
  loadError: string;
  isBootstrapping: boolean;
}

type DashboardAction =
  | { type: "BOOTSTRAP_START" }
  | {
      type: "SNAPSHOT";
      payload: Omit<DashboardState, "loadError" | "isBootstrapping">;
    }
  | { type: "ERROR"; message: string }
  | { type: "REMOVE_AVAILABLE"; bookingId: string }
  | { type: "CLEAR_ERROR" };

const initialState: DashboardState = {
  profile: null,
  bookings: [],
  counts: { available: 0, active: 0, completed: 0 },
  pendingExtensions: [],
  completedBookings: [],
  loadError: "",
  isBootstrapping: true,
};

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "BOOTSTRAP_START":
      return { ...state, isBootstrapping: true, loadError: "" };
    case "SNAPSHOT":
      return {
        ...state,
        ...action.payload,
        loadError: "",
        isBootstrapping: false,
      };
    case "ERROR":
      return {
        ...state,
        loadError: action.message,
        isBootstrapping: false,
      };
    case "REMOVE_AVAILABLE":
      return {
        ...state,
        bookings: state.bookings.filter((b) => b.id !== action.bookingId),
        counts: {
          ...state.counts,
          available: Math.max(0, state.counts.available - 1),
        },
      };
    case "CLEAR_ERROR":
      return { ...state, loadError: "" };
    default:
      return state;
  }
}

export function useVendorDashboard() {
  const router = useRouter();
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const [navView, setNavView] = useState<DashboardView>("home");
  const [activeTab, setActiveTab] = useState<BookingTab>("available");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [earningPeriod, setEarningPeriod] = useState<EarningPeriod>("monthly");

  const activeTabRef = useRef(activeTab);
  const initializedRef = useRef(false);
  const requestGenRef = useRef(0);
  const inflightSyncRef = useRef<Promise<void> | null>(null);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  activeTabRef.current = activeTab;

  const syncDashboard = useCallback(
    async (options?: { tab?: BookingTab; force?: boolean }) => {
      const tab = options?.tab ?? activeTabRef.current;
      const isRevalidate = initializedRef.current;

      if (inflightSyncRef.current && !options?.force) {
        return inflightSyncRef.current;
      }

      if (!isRevalidate) {
        dispatch({ type: "BOOTSTRAP_START" });
      }

      const generation = ++requestGenRef.current;

      const task = (async () => {
        try {
          const snapshot = await fetchVendorDashboardSnapshot(tab);
          if (generation !== requestGenRef.current) return;

          dispatch({ type: "SNAPSHOT", payload: snapshot });
          initializedRef.current = true;
        } catch (err) {
          if (generation !== requestGenRef.current) return;

          if (err instanceof ApiRequestError && err.status === 401) {
            markSessionExpired(err.message);
            router.replace("/");
            return;
          }

          if (!initializedRef.current) {
            dispatch({
              type: "ERROR",
              message:
                err instanceof ApiRequestError
                  ? err.message
                  : "Failed to load dashboard.",
            });
          }
        } finally {
          if (generation === requestGenRef.current) {
            inflightSyncRef.current = null;
          }
        }
      })();

      inflightSyncRef.current = task;
      return task;
    },
    [router]
  );

  const refreshAll = useCallback(async () => {
    await syncDashboard({ force: true });
  }, [syncDashboard]);

  const handleTabChange = useCallback(
    (tab: BookingTab) => {
      setActiveTab(tab);
      void syncDashboard({ tab, force: true });
    },
    [syncDashboard]
  );

  const handleQuickAccept = useCallback(
    async (bookingId: string) => {
      setActionBookingId(bookingId);
      dispatch({ type: "CLEAR_ERROR" });
      dispatch({ type: "REMOVE_AVAILABLE", bookingId });
      try {
        await acceptBooking(bookingId);
        await syncDashboard({ force: true });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          markSessionExpired(err.message);
          router.replace("/");
          return;
        }
        dispatch({
          type: "ERROR",
          message:
            err instanceof ApiRequestError
              ? err.message
              : "Failed to accept booking.",
        });
        await syncDashboard({ force: true });
      } finally {
        setActionBookingId(null);
      }
    },
    [router, syncDashboard]
  );

  const handleQuickReject = useCallback(
    async (bookingId: string) => {
      setActionBookingId(bookingId);
      dispatch({ type: "CLEAR_ERROR" });
      try {
        await rejectBooking(bookingId);
        await syncDashboard({ force: true });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          markSessionExpired(err.message);
          router.replace("/");
          return;
        }
        dispatch({
          type: "ERROR",
          message:
            err instanceof ApiRequestError
              ? err.message
              : "Failed to reject booking.",
        });
      } finally {
        setActionBookingId(null);
      }
    },
    [router, syncDashboard]
  );

  useEffect(() => {
    const session = getVendorSession();
    if (!session) {
      router.replace("/");
      return;
    }
    void syncDashboard();
  }, [router, syncDashboard]);

  useEffect(() => {
    if (!initializedRef.current) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      if (inflightSyncRef.current) return;
      void syncDashboard();
    };

    const intervalId = window.setInterval(poll, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
      }
      visibilityTimerRef.current = setTimeout(() => {
        if (inflightSyncRef.current) return;
        void syncDashboard();
      }, VISIBILITY_DEBOUNCE_MS);
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
      }
    };
  }, [syncDashboard]);

  const upcomingBookings = useMemo(
    () => (activeTab === "available" ? state.bookings.slice(0, 5) : []),
    [activeTab, state.bookings]
  );

  const currentEarning = useMemo(
    () => sumEarningsInPeriod(state.completedBookings, earningPeriod),
    [state.completedBookings, earningPeriod]
  );

  const greetingName =
    state.profile?.contact_name?.split(" ")[0] ??
    state.profile?.name?.split(" ")[0] ??
    "Vendor";

  const session = getVendorSession();

  return {
    session,
    navView,
    setNavView,
    activeTab,
    handleTabChange,
    selectedBookingId,
    setSelectedBookingId,
    actionBookingId,
    upcomingBookings,
    greetingName,
    refreshAll,
    handleQuickAccept,
    handleQuickReject,
    profile: state.profile,
    bookings: state.bookings,
    counts: state.counts,
    pendingExtensions: state.pendingExtensions,
    completedBookings: state.completedBookings,
    currentEarning,
    earningPeriod,
    setEarningPeriod,
    loadError: state.loadError,
    isLoadingBookings: state.isBootstrapping && state.bookings.length === 0,
    isLoadingExtensions: state.isBootstrapping && state.pendingExtensions.length === 0,
    isLoadingProfile: state.isBootstrapping && !state.profile,
  };
}

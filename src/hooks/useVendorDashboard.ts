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
  acceptMaterialOrder,
  getMaterialActionUserMessage,
  isMaterialOrderAlreadyTakenError,
  rejectMaterialOrder,
} from "@/lib/material-vendor";
import {
  type EarningPeriod,
  sumEarningsInPeriod,
} from "@/lib/earnings";
import { fetchVendorPortalSnapshot } from "@/lib/vendor-portal-snapshot";
import { writeMaterialOrderListCaches } from "@/lib/material-order-list-cache";
import { portalItemKey, type OrderDomain, type PortalListItem } from "@/lib/portal-items";

const POLL_MS = 10_000;
const VISIBILITY_DEBOUNCE_MS = 400;

interface DashboardState {
  profile: VendorProfile | null;
  bookings: VendorBookingListItem[];
  rentalPortalItems: PortalListItem[];
  materialPortalItems: PortalListItem[];
  rentalCounts: { available: number; active: number; completed: number };
  materialCounts: { available: number; active: number; completed: number };
  pendingExtensions: VendorExtension[];
  completedBookings: VendorBookingListItem[];
  loadError: string;
  materialLoadWarning: string;
  isBootstrapping: boolean;
}

type DashboardAction =
  | { type: "BOOTSTRAP_START" }
  | {
      type: "SNAPSHOT";
      payload: Omit<DashboardState, "loadError" | "isBootstrapping">;
    }
  | { type: "ERROR"; message: string }
  | { type: "REMOVE_AVAILABLE"; itemKey: string }
  | { type: "CLEAR_ERROR" };

const initialState: DashboardState = {
  profile: null,
  bookings: [],
  rentalPortalItems: [],
  materialPortalItems: [],
  rentalCounts: { available: 0, active: 0, completed: 0 },
  materialCounts: { available: 0, active: 0, completed: 0 },
  pendingExtensions: [],
  completedBookings: [],
  loadError: "",
  materialLoadWarning: "",
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
    case "REMOVE_AVAILABLE": {
      const isMaterial = action.itemKey.startsWith("material:");
      if (isMaterial) {
        return {
          ...state,
          materialPortalItems: state.materialPortalItems.filter(
            (item) => portalItemKey(item) !== action.itemKey
          ),
          materialCounts: {
            ...state.materialCounts,
            available: Math.max(0, state.materialCounts.available - 1),
          },
        };
      }
      return {
        ...state,
        rentalPortalItems: state.rentalPortalItems.filter(
          (item) => portalItemKey(item) !== action.itemKey
        ),
        bookings: state.bookings.filter((b) => action.itemKey !== `rental:${b.id}`),
        rentalCounts: {
          ...state.rentalCounts,
          available: Math.max(0, state.rentalCounts.available - 1),
        },
      };
    }
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
  const [orderDomain, setOrderDomain] = useState<OrderDomain>("rental");
  const [activeTab, setActiveTab] = useState<BookingTab>("available");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [actionItemKey, setActionItemKey] = useState<string | null>(null);
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
          const snapshot = await fetchVendorPortalSnapshot(tab);
          if (generation !== requestGenRef.current) return;

          writeMaterialOrderListCaches(snapshot.materialOrders);

          dispatch({
            type: "SNAPSHOT",
            payload: {
              profile: snapshot.profile,
              bookings: snapshot.bookings,
              rentalPortalItems: snapshot.rentalPortalItems,
              materialPortalItems: snapshot.materialPortalItems,
              rentalCounts: snapshot.rentalCounts,
              materialCounts: snapshot.materialCounts,
              pendingExtensions: snapshot.pendingExtensions,
              completedBookings: snapshot.completedBookings,
              materialLoadWarning: snapshot.materialLoadWarning,
            },
          });
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

  const handleDomainChange = useCallback(
    (domain: OrderDomain) => {
      setOrderDomain(domain);
    },
    []
  );

  const handleTabChange = useCallback(
    (tab: BookingTab) => {
      setActiveTab(tab);
      void syncDashboard({ tab, force: true });
    },
    [syncDashboard]
  );

  const handleQuickAccept = useCallback(
    async (item: PortalListItem) => {
      const key = portalItemKey(item);
      setActionItemKey(key);
      dispatch({ type: "CLEAR_ERROR" });
      dispatch({ type: "REMOVE_AVAILABLE", itemKey: key });
      try {
        if (item.kind === "material") {
          await acceptMaterialOrder(item.id);
        } else {
          await acceptBooking(item.id);
        }
        await syncDashboard({ force: true });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          markSessionExpired(err.message);
          router.replace("/");
          return;
        }
        if (
          item.kind === "material" &&
          err instanceof ApiRequestError &&
          isMaterialOrderAlreadyTakenError(err)
        ) {
          await syncDashboard({ force: true });
          return;
        }
        dispatch({
          type: "ERROR",
          message:
            err instanceof ApiRequestError
              ? item.kind === "material"
                ? getMaterialActionUserMessage(err)
                : err.message
              : "Failed to accept booking.",
        });
        await syncDashboard({ force: true });
      } finally {
        setActionItemKey(null);
      }
    },
    [router, syncDashboard]
  );

  const handleQuickReject = useCallback(
    async (item: PortalListItem) => {
      const key = portalItemKey(item);
      setActionItemKey(key);
      dispatch({ type: "CLEAR_ERROR" });
      if (item.kind === "material") {
        dispatch({ type: "REMOVE_AVAILABLE", itemKey: key });
      }
      try {
        if (item.kind === "material") {
          await rejectMaterialOrder(item.id);
        } else {
          await rejectBooking(item.id);
        }
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
              ? item.kind === "material"
                ? getMaterialActionUserMessage(err)
                : err.message
              : "Failed to reject booking.",
        });
        await syncDashboard({ force: true });
      } finally {
        setActionItemKey(null);
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

  const portalItems = useMemo(
    () => (orderDomain === "rental" ? state.rentalPortalItems : state.materialPortalItems),
    [orderDomain, state.rentalPortalItems, state.materialPortalItems]
  );

  const counts = useMemo(
    () => (orderDomain === "rental" ? state.rentalCounts : state.materialCounts),
    [orderDomain, state.rentalCounts, state.materialCounts]
  );

  const rentalTotal = useMemo(
    () =>
      state.rentalCounts.available +
      state.rentalCounts.active +
      state.rentalCounts.completed,
    [state.rentalCounts]
  );

  const materialTotal = useMemo(
    () =>
      state.materialCounts.available +
      state.materialCounts.active +
      state.materialCounts.completed,
    [state.materialCounts]
  );

  const upcomingItems = useMemo(
    () => (activeTab === "available" ? portalItems.slice(0, 5) : []),
    [activeTab, portalItems]
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
    orderDomain,
    handleDomainChange,
    activeTab,
    handleTabChange,
    selectedBookingId,
    setSelectedBookingId,
    actionItemKey,
    upcomingItems,
    portalItems,
    rentalTotal,
    materialTotal,
    greetingName,
    refreshAll,
    handleQuickAccept,
    handleQuickReject,
    profile: state.profile,
    bookings: state.bookings,
    counts,
    pendingExtensions: state.pendingExtensions,
    completedBookings: state.completedBookings,
    currentEarning,
    earningPeriod,
    setEarningPeriod,
    loadError: state.loadError,
    materialLoadWarning: state.materialLoadWarning,
    isLoadingBookings:
      state.isBootstrapping &&
      state.rentalPortalItems.length === 0 &&
      state.materialPortalItems.length === 0,
    isLoadingExtensions: state.isBootstrapping && state.pendingExtensions.length === 0,
    isLoadingProfile: state.isBootstrapping && !state.profile,
  };
}

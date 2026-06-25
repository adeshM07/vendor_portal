"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardHero } from "./DashboardHero";
import { StatsRow } from "./StatsRow";
import { BookingTabNav } from "./BookingTabNav";
import { VendorOrdersTable } from "./VendorOrdersTable";
import { DashboardSidebar } from "./DashboardBottomNav";
import { UpcomingBookingStrip } from "./UpcomingBookingStrip";
import { CalendarView } from "./CalendarView";
import { EarningsView } from "./EarningsView";
import { NotificationsView } from "./NotificationsView";
import { useVendorDashboard } from "@/hooks/useVendorDashboard";
import type { PortalListItem } from "@/lib/portal-items";

export function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    session,
    navView,
    setNavView,
    activeTab,
    handleTabChange,
    actionItemKey,
    upcomingItems,
    portalItems,
    greetingName,
    refreshAll,
    handleQuickAccept,
    handleQuickReject,
    profile,
    bookings,
    counts,
    currentEarning,
    earningPeriod,
    setEarningPeriod,
    loadError,
    materialLoadWarning,
    isLoadingBookings,
    isLoadingProfile,
  } = useVendorDashboard();

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "available" || tab === "active" || tab === "completed") {
      handleTabChange(tab);
    }
  }, [searchParams, handleTabChange]);

  const handleStatusTabChange = useCallback(
    (tab: typeof activeTab) => {
      handleTabChange(tab);
      router.replace(`/dashboard?tab=${tab}`);
    },
    [handleTabChange, router]
  );

  const handleViewItemDetails = useCallback(
    (item: PortalListItem) => {
      router.push(`/dashboard/materials/${item.id}?from=${activeTab}`);
    },
    [router, activeTab]
  );

  return (
    <div className="flex min-h-dvh bg-gray-50">
      <DashboardSidebar active={navView} onChange={setNavView} />

      <div className="flex min-w-0 flex-1 flex-col bg-gray-50">
        {navView === "home" && (
          <DashboardHero
            mobile={session?.mobile ?? ""}
            profile={profile}
            greetingName={greetingName}
            currentEarning={currentEarning}
            earningPeriod={earningPeriod}
            onEarningPeriodChange={setEarningPeriod}
            isLoading={isLoadingProfile || isLoadingBookings}
          />
        )}

        <main
          ref={mainRef}
          className="flex-1 overflow-x-hidden bg-gray-50 pt-4"
        >
          <div className="mx-auto min-w-0 w-full max-w-4xl space-y-5 px-4 pb-8 sm:space-y-6">
            {navView === "home" && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Material Orders</h2>
                  <p className="text-xs text-gray-500">
                    Supplier portal for cement, bricks, and other building materials
                  </p>
                </div>

                <StatsRow
                  available={counts.available}
                  active={counts.active}
                  completed={counts.completed}
                  bookings={bookings}
                  domain="material"
                  items={portalItems}
                  isLoading={isLoadingBookings && portalItems.length === 0}
                />

                {activeTab === "available" && (
                  <UpcomingBookingStrip
                    domain="material"
                    items={upcomingItems}
                    onViewDetails={handleViewItemDetails}
                  />
                )}

                <BookingTabNav
                  activeTab={activeTab}
                  onTabChange={handleStatusTabChange}
                  counts={counts}
                />

                {loadError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {loadError}
                  </p>
                )}

                {materialLoadWarning && !loadError && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {materialLoadWarning}
                  </p>
                )}

                {activeTab !== "available" && counts.available > 0 && (
                  <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    {counts.available} material order{counts.available === 1 ? "" : "s"} waiting in{" "}
                    <button
                      type="button"
                      onClick={() => handleStatusTabChange("available")}
                      className="font-semibold underline underline-offset-2"
                    >
                      Upcoming
                    </button>
                    {" "}— first vendor to accept wins.
                  </p>
                )}

                <VendorOrdersTable
                  domain="material"
                  tab={activeTab}
                  items={portalItems}
                  isLoading={isLoadingBookings}
                  onViewDetails={handleViewItemDetails}
                  onAccept={activeTab === "available" ? handleQuickAccept : undefined}
                  onReject={activeTab === "available" ? handleQuickReject : undefined}
                  actionItemKey={actionItemKey}
                />
              </>
            )}

            {navView === "calendar" && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Schedule</h2>
                  <p className="text-xs text-gray-500">Material delivery schedule</p>
                </div>
                <BookingTabNav
                  activeTab={activeTab}
                  onTabChange={handleStatusTabChange}
                  counts={counts}
                />
                <CalendarView bookings={bookings} onSelect={() => undefined} />
              </>
            )}

            {navView === "earnings" && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Earnings</h2>
                  <p className="text-xs text-gray-500">Overview from your material orders</p>
                </div>
                <EarningsView counts={counts} bookings={bookings} activeTab={activeTab} />
              </>
            )}

            {navView === "notifications" && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
                </div>
                <NotificationsView />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

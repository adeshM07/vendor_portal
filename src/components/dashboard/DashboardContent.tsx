"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardHero } from "./DashboardHero";
import { StatsRow } from "./StatsRow";
import { BookingTabNav } from "./BookingTabNav";
import { OrderDomainTabNav } from "./OrderDomainTabNav";
import { VendorOrdersTable } from "./VendorOrdersTable";
import { DashboardSidebar } from "./DashboardBottomNav";
import { UpcomingBookingStrip } from "./UpcomingBookingStrip";
import { CalendarView } from "./CalendarView";
import { EarningsView } from "./EarningsView";
import { NotificationsView } from "./NotificationsView";
import { ExtensionRequestsSection } from "./ExtensionRequestsSection";
import { useVendorDashboard } from "@/hooks/useVendorDashboard";
import type { PortalListItem } from "@/lib/portal-items";

const BookingDetailDrawer = dynamic(
  () =>
    import("./BookingDetailDrawer").then((mod) => ({
      default: mod.BookingDetailDrawer,
    })),
  { ssr: false }
);

export function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
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
    profile,
    bookings,
    counts,
    pendingExtensions,
    currentEarning,
    earningPeriod,
    setEarningPeriod,
    loadError,
    materialLoadWarning,
    isLoadingBookings,
    isLoadingExtensions,
    isLoadingProfile,
  } = useVendorDashboard();

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const domain = searchParams.get("domain");
    if (domain === "rental" || domain === "material") {
      handleDomainChange(domain);
    }
    const tab = searchParams.get("tab");
    if (tab === "available" || tab === "active" || tab === "completed") {
      handleTabChange(tab);
    }
  }, [searchParams, handleTabChange, handleDomainChange]);

  const handleDomainSwitch = useCallback(
    (domain: typeof orderDomain) => {
      handleDomainChange(domain);
      router.replace(`/dashboard?domain=${domain}&tab=${activeTab}`);
    },
    [handleDomainChange, router, activeTab]
  );

  const handleStatusTabChange = useCallback(
    (tab: typeof activeTab) => {
      handleTabChange(tab);
      router.replace(`/dashboard?domain=${orderDomain}&tab=${tab}`);
    },
    [handleTabChange, router, orderDomain]
  );

  const handleViewItemDetails = useCallback(
    (item: PortalListItem) => {
      if (item.kind === "material") {
        router.push(`/dashboard/materials/${item.id}?from=${activeTab}`);
        return;
      }
      router.push(`/dashboard/bookings/${item.id}?from=${activeTab}`);
    },
    [router, activeTab]
  );

  const handleViewBookingDetails = useCallback(
    (bookingId: string) => {
      router.push(`/dashboard/bookings/${bookingId}?from=${activeTab}`);
    },
    [router, activeTab]
  );

  const handleCloseBookingDetail = useCallback(() => {
    setSelectedBookingId(null);
    requestAnimationFrame(() => {
      const main = mainRef.current;
      if (!main) return;
      main.scrollLeft = 0;
    });
  }, [setSelectedBookingId]);

  return (
    <>
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
                  <OrderDomainTabNav
                    activeDomain={orderDomain}
                    onDomainChange={handleDomainSwitch}
                    rentalTotal={rentalTotal}
                    materialTotal={materialTotal}
                  />

                  <StatsRow
                    available={counts.available}
                    active={counts.active}
                    completed={counts.completed}
                    bookings={bookings}
                    domain={orderDomain}
                    items={portalItems}
                    isLoading={isLoadingBookings && portalItems.length === 0}
                  />

                  {orderDomain === "rental" && (
                    <ExtensionRequestsSection
                      extensions={pendingExtensions}
                      isLoading={isLoadingExtensions}
                      onUpdated={refreshAll}
                      onViewBooking={handleViewBookingDetails}
                    />
                  )}

                  {activeTab === "available" && (
                    <UpcomingBookingStrip
                      domain={orderDomain}
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

                  {orderDomain === "material" && materialLoadWarning && !loadError && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {materialLoadWarning}
                    </p>
                  )}

                  {orderDomain === "material" &&
                    activeTab !== "available" &&
                    counts.available > 0 && (
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
                    domain={orderDomain}
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
                    <p className="text-xs text-gray-500">
                      Bookings from the{" "}
                      {activeTab === "available"
                        ? "Upcoming"
                        : activeTab === "active"
                          ? "Active"
                          : "Completed"}{" "}
                      tab
                    </p>
                  </div>
                  <BookingTabNav
                    activeTab={activeTab}
                    onTabChange={handleStatusTabChange}
                    counts={counts}
                  />
                  <CalendarView
                    bookings={bookings}
                    onSelect={(b) => setSelectedBookingId(b.id)}
                  />
                </>
              )}

              {navView === "earnings" && (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Earnings</h2>
                    <p className="text-xs text-gray-500">Overview from your booking data</p>
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

      {selectedBookingId && (
        <BookingDetailDrawer
          bookingId={selectedBookingId}
          knownExtensions={pendingExtensions}
          onClose={handleCloseBookingDetail}
          onUpdated={refreshAll}
        />
      )}
    </>
  );
}

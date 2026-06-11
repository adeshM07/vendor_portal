"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardHero } from "./DashboardHero";
import { StatsRow } from "./StatsRow";
import { BookingTabNav } from "./BookingTabNav";
import { BookingsTable } from "./BookingsTable";
import { DashboardSidebar } from "./DashboardBottomNav";
import { UpcomingBookingStrip } from "./UpcomingBookingStrip";
import { CalendarView } from "./CalendarView";
import { EarningsView } from "./EarningsView";
import { NotificationsView } from "./NotificationsView";
import { ExtensionRequestsSection } from "./ExtensionRequestsSection";
import { useVendorDashboard } from "@/hooks/useVendorDashboard";

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
    profile,
    bookings,
    counts,
    pendingExtensions,
    currentEarning,
    earningPeriod,
    setEarningPeriod,
    loadError,
    isLoadingBookings,
    isLoadingExtensions,
    isLoadingProfile,
  } = useVendorDashboard();

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "available" || tab === "active" || tab === "completed") {
      handleTabChange(tab);
    }
  }, [searchParams, handleTabChange]);

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

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-dvh min-h-dvh overflow-hidden bg-gray-50">
        <DashboardSidebar active={navView} onChange={setNavView} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50">
          {navView === "home" && (
            <DashboardHero
              mobile={session.mobile}
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
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-gray-50 pt-4 [scrollbar-gutter:stable]"
          >
            <div className="mx-auto min-w-0 w-full max-w-4xl space-y-5 px-4 pb-8 sm:space-y-6">
              {navView === "home" && (
                <>
                  <StatsRow
                    available={counts.available}
                    active={counts.active}
                    completed={counts.completed}
                    bookings={bookings}
                    isLoading={isLoadingBookings && bookings.length === 0}
                  />

                  <ExtensionRequestsSection
                    extensions={pendingExtensions}
                    isLoading={isLoadingExtensions}
                    onUpdated={refreshAll}
                    onViewBooking={(id) => setSelectedBookingId(id)}
                  />

                  {activeTab === "available" && (
                    <UpcomingBookingStrip
                      bookings={upcomingBookings}
                      onViewDetails={handleViewBookingDetails}
                    />
                  )}

                  <BookingTabNav
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    counts={counts}
                  />

                  {loadError && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {loadError}
                    </p>
                  )}

                  <BookingsTable
                    tab={activeTab}
                    bookings={bookings}
                    isLoading={isLoadingBookings}
                    onSelect={(b) => setSelectedBookingId(b.id)}
                    onViewDetails={handleViewBookingDetails}
                    onAccept={activeTab === "available" ? handleQuickAccept : undefined}
                    onReject={activeTab === "available" ? handleQuickReject : undefined}
                    actionBookingId={actionBookingId}
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
                    onTabChange={handleTabChange}
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

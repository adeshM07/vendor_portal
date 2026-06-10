"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatDate,
  formatDateTime,
  formatDurationDays,
} from "@/lib/format";
import type { VendorBookingListItem } from "@/lib/vendor";

interface CalendarViewProps {
  bookings: VendorBookingListItem[];
  onSelect: (booking: VendorBookingListItem) => void;
}

type JobColor = "green" | "orange" | "red";

function getJobColor(status: string): JobColor {
  if (status === "ended") return "red";
  if (status === "started") return "green";
  return "orange";
}

const jobColorStyles: Record<
  JobColor,
  { bar: string; dot: string; text: string; label: string }
> = {
  green: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    label: "Start Task",
  },
  orange: {
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    text: "text-orange-600",
    label: "Active",
  },
  red: {
    bar: "bg-red-500",
    dot: "bg-red-500",
    text: "text-red-600",
    label: "End Task",
  },
};

function bookingDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function CalendarView({ bookings, onSelect }: CalendarViewProps) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, VendorBookingListItem[]>();
    bookings.forEach((b) => {
      const key = bookingDayKey(new Date(b.scheduled_start));
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    });
    return map;
  }, [bookings]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));

  const dayBookings = bookings.filter((b) => {
    const d = new Date(b.scheduled_start);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay;
  });

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="rounded-lg p-1 text-gray-500 hover:bg-gray-50">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-sm font-semibold text-gray-900">{monthLabel}</h3>
          <button type="button" onClick={nextMonth} className="rounded-lg p-1 text-gray-500 hover:bg-gray-50">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-gray-400">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = `${year}-${month}-${day}`;
            const dayBookingsOnGrid = bookingsByDay.get(key) ?? [];
            const hasBooking = dayBookingsOnGrid.length > 0;
            const isSelected = day === selectedDay;
            const isToday =
              day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative flex h-9 items-center justify-center rounded-lg text-sm transition ${
                  isSelected
                    ? "bg-amber-500 font-semibold text-white"
                    : isToday
                      ? "bg-amber-50 font-medium text-amber-700"
                      : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {day}
                {hasBooking && !isSelected && (
                  <div className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                    {dayBookingsOnGrid.slice(0, 3).map((booking) => (
                      <span
                        key={booking.id}
                        className={`h-0.5 w-2.5 rounded-full ${jobColorStyles[getJobColor(booking.status)].dot}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-gray-900">
          {formatDate(new Date(year, month, selectedDay).toISOString())}
        </h4>
        {dayBookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            No bookings scheduled for this day
          </p>
        ) : (
          <div className="space-y-3">
            {dayBookings.map((booking) => {
              const color = getJobColor(booking.status);
              const styles = jobColorStyles[color];

              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onSelect(booking)}
                  className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-amber-200"
                >
                  <div className="flex w-3 shrink-0 flex-col items-center pt-1">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.bar}`} />
                    <div className={`mt-1 w-0.5 flex-1 rounded-full ${styles.bar}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400">
                      {formatDateTime(booking.scheduled_start)}
                    </p>
                    <p className={`mt-0.5 text-xs font-semibold ${styles.text}`}>
                      {styles.label}
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {booking.sku_name ?? "Equipment"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                      {booking.site_address ?? "Site address pending"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDurationDays(booking.scheduled_start, booking.scheduled_end)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

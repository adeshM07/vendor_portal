"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  approveExtension,
  isExtensionAwaitingVendorAction,
  rejectExtension,
  type VendorExtension,
} from "@/lib/vendor";
import { ApiRequestError } from "@/lib/api";

interface ExtensionRequestsSectionProps {
  extensions: VendorExtension[];
  isLoading: boolean;
  onUpdated: () => void;
  onViewBooking?: (bookingId: string) => void;
}

export function ExtensionRequestsSection({
  extensions,
  isLoading,
  onUpdated,
  onViewBooking,
}: ExtensionRequestsSectionProps) {
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="h-24 animate-pulse rounded-2xl border border-gray-100 bg-white" />
      </div>
    );
  }

  if (extensions.length === 0) return null;

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setActionKey(key);
    setError("");
    try {
      await fn();
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Extension action failed. Please try again."
      );
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div>
        <h2 className="text-base font-bold text-gray-900">Extension Requests</h2>
        <p className="text-xs text-gray-500">
          Accept or reject once the customer completes extension payment
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {extensions.map((ext) => {
        const canAct = isExtensionAwaitingVendorAction(ext);
        const rejectKey = `reject-${ext.id}`;
        const approveKey = `approve-${ext.id}`;
        return (
          <article
            key={ext.id}
            className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Clock className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">
                  +{ext.extension_hours}h extension
                </p>
                <p className="font-mono text-[11px] text-gray-500">
                  {ext.booking_number}
                </p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {formatCurrency(ext.extension_amount)}
                </p>
                {canAct ? (
                  <p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Payment confirmed
                    {ext.payment_method ? ` · ${ext.payment_method.toUpperCase()}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Payment pending
                  </p>
                )}
                {ext.response_deadline && (
                  <p className="mt-1 text-xs text-orange-700">
                    Respond by {formatDateTime(ext.response_deadline)}
                  </p>
                )}
              </div>
            </div>

            {canAct ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={actionKey !== null}
                  onClick={() =>
                    runAction(rejectKey, async () => {
                      await rejectExtension(ext.id);
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {actionKey === rejectKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Reject Extension
                </button>
                <button
                  type="button"
                  disabled={actionKey !== null}
                  onClick={() =>
                    runAction(approveKey, async () => {
                      await approveExtension(
                        ext.id,
                        ext.payment_method === "cod" ? "cod" : "juspay"
                      );
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionKey === approveKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Accept Extension
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-amber-700">
                Waiting for customer to complete extension payment
              </p>
            )}

            {onViewBooking && (
              <button
                type="button"
                onClick={() => onViewBooking(ext.booking_id)}
                className="mt-2 w-full text-center text-xs font-medium text-amber-700 hover:underline"
              >
                View booking details
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

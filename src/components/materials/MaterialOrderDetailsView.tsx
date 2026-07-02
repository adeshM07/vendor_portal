"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CreditCard,
  MapPin,
  Package,
  ScrollText,
  Truck,
  User,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PortalLoadingShell } from "@/components/SessionGate";
import { ApiRequestError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  buildMaterialTimeline,
  displayValue,
  formatLineItemSummary,
  formatOrderCreatedDate,
  formatOrderDateTime,
  formatQuantity,
  getCustomerEmail,
  getCustomerName,
  getCustomerPhone,
  getDeliveryAddress,
  getDeliveryMode,
  getDeliverySiteLabel,
  isCancelledOrder,
} from "@/lib/material-order-details";
import { formatStockQuantity } from "@/lib/material-inventory";
import {
  acceptMaterialOrder,
  advanceMaterialOrderStatus,
  confirmMaterialOrderDelivery,
  fetchVendorMaterialOrderDetail,
  getMaterialActionUserMessage,
  getMaterialAdvanceActionLabel,
  inferNextMaterialStatus,
  isMaterialOrderAlreadyTakenError,
  markMaterialOrderQcReady,
  normalizeMaterialOrderDetail,
  rejectMaterialOrder,
  type MaterialOrderDetail,
} from "@/lib/material-vendor";
import { validateOrderItemsStock } from "@/lib/material-inventory";
import { readMaterialOrderListCache } from "@/lib/material-order-list-cache";
import { useMaterialOrderStock } from "@/hooks/useMaterialOrderStock";
import { LiveTrackingMap } from "@/components/dashboard/LiveTrackingMap";
import { useMaterialOrderLocationTracking } from "@/hooks/useMaterialOrderLocationTracking";
import { MaterialItemThumb } from "./MaterialItemThumb";
import { MaterialOrderStatusPill } from "./MaterialOrderStatusPill";

interface MaterialOrderDetailsViewProps {
  orderId: string;
  returnHref?: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 sm:max-w-[60%] sm:text-right">
        {value}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} icon={icon} />
      <div className="px-5 pb-5">{children}</div>
    </Card>
  );
}

function moneyLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const num = Number(value);
  return Number.isNaN(num) ? value : formatCurrency(num);
}

export function MaterialOrderDetailsView({
  orderId,
  returnHref = "/dashboard?view=orders&tab=available",
}: MaterialOrderDetailsViewProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<MaterialOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [deliveryOtp, setDeliveryOtp] = useState("");

  const canShareLocation = Boolean(detail?.available_actions.can_update_location);
  const {
    items: stockAwareItems,
    isLoading: stockLoading,
    loadError: stockLoadError,
    hasInsufficientStock,
  } = useMaterialOrderStock(detail?.items ?? [], Boolean(detail));
  const {
    isSharing: isSharingLocation,
    lastCoords: locationCoords,
    error: locationError,
  } = useMaterialOrderLocationTracking({
    orderId,
    enabled: canShareLocation,
  });

  const loadDetail = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError("");

    const cached = readMaterialOrderListCache(orderId);
    if (cached) {
      setDetail(
        normalizeMaterialOrderDetail({
          order_id: cached.id,
          order_number: cached.order_number,
          status: cached.status,
          status_label: cached.status_label,
          customer_name: cached.customer_name,
          customer_phone: cached.customer_phone,
          customer_email: cached.customer_email,
          delivery_address: cached.delivery_address,
          estimated_delivery_date: cached.scheduled_date,
          items: cached.items ?? [],
          created_at: cached.created_at,
        })
      );
    }

    try {
      const data = await fetchVendorMaterialOrderDetail(orderId);
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to load material order details."
      );
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleAccept = async () => {
    setActionError("");
    setIsActing(true);
    try {
      if (detail?.items?.length) {
        const stockCheck = await validateOrderItemsStock(detail.items);
        if (!stockCheck.valid) {
          setActionError(
            stockCheck.message ?? "Insufficient stock to accept this order."
          );
          return;
        }
      }

      await acceptMaterialOrder(orderId);
      router.push("/dashboard?view=orders&tab=active");
    } catch (err) {
      if (err instanceof ApiRequestError && isMaterialOrderAlreadyTakenError(err)) {
        setActionError(getMaterialActionUserMessage(err));
        router.push(returnHref);
        return;
      }
      setActionError(
        err instanceof ApiRequestError
          ? getMaterialActionUserMessage(err)
          : "Failed to accept order."
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    setActionError("");
    setIsActing(true);
    try {
      await rejectMaterialOrder(orderId);
      router.push(returnHref);
    } catch (err) {
      setActionError(
        err instanceof ApiRequestError
          ? getMaterialActionUserMessage(err)
          : "Failed to decline order."
      );
      await loadDetail(false);
    } finally {
      setIsActing(false);
    }
  };

  const handleMarkQcReady = async () => {
    setActionError("");
    setIsActing(true);
    try {
      await markMaterialOrderQcReady(orderId);
      await loadDetail(false);
    } catch (err) {
      setActionError(
        err instanceof ApiRequestError ? err.message : "Failed to update order status."
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleAdvanceStatus = async () => {
    const nextStatus = inferNextMaterialStatus(detail?.status ?? "");
    if (!nextStatus) {
      setActionError("No further status update is available for this order.");
      return;
    }
    setActionError("");
    setIsActing(true);
    try {
      await advanceMaterialOrderStatus(orderId, nextStatus);
      await loadDetail(false);
    } catch (err) {
      setActionError(
        err instanceof ApiRequestError ? err.message : "Failed to update order status."
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleConfirmDelivery = async () => {
    setActionError("");
    setIsActing(true);
    try {
      await confirmMaterialOrderDelivery(orderId, deliveryOtp.trim());
      setDeliveryOtp("");
      await loadDetail(false);
    } catch (err) {
      setActionError(
        err instanceof ApiRequestError ? err.message : "Failed to confirm delivery."
      );
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return <PortalLoadingShell />;
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          href={returnHref}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to materials
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-700">
            {error || "Material order not found."}
          </p>
        </div>
      </div>
    );
  }

  const timeline = buildMaterialTimeline(detail);
  const deliverySiteLabel = getDeliverySiteLabel(detail);
  const showAcceptDecline =
    detail.available_actions.can_accept || detail.available_actions.can_reject;
  const showFulfillmentActions =
    detail.available_actions.can_mark_qc ||
    detail.available_actions.can_advance_status ||
    detail.available_actions.can_confirm_delivery ||
    detail.available_actions.can_update_location;

  const advanceButtonLabel = getMaterialAdvanceActionLabel(detail.status);

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-5 px-4 pb-10 pt-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={returnHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to materials
        </Link>
        <MaterialOrderStatusPill status={detail.status} />
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Material Order Details</h1>
        <p className="mt-1 font-mono text-xs text-gray-400">{detail.order_number}</p>
        <p className="mt-2 text-sm font-medium text-amber-700">
          {displayValue(detail.status_label)}
        </p>
        {detail.items_count_label && (
          <p className="mt-1 text-xs text-gray-500">{detail.items_count_label}</p>
        )}
      </div>

      {showAcceptDecline && (
        <Card>
          <CardHeader title="Vendor Actions" icon={<Truck className="h-4 w-4" strokeWidth={1.5} />} />
          <div className="space-y-3 px-5 pb-5">
            <p className="text-xs text-gray-500">
              This order is in the competitive pool. Accept to claim it — it will move to your
              Active tab and disappear for other vendors. Decline to pass; other suppliers can
              still accept.
            </p>
            {stockLoadError && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {stockLoadError}
              </p>
            )}
            {hasInsufficientStock && !stockLoading && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                One or more materials do not have enough stock to fulfill this order. Review the
                line items below before accepting.
              </p>
            )}
            {actionError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {actionError}
              </p>
            )}
            <div className="flex gap-2">
              {detail.available_actions.can_reject && (
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => void handleReject()}
                  className="flex flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                >
                  Decline
                </button>
              )}
              {detail.available_actions.can_accept && (
                <button
                  type="button"
                  disabled={isActing || stockLoading || hasInsufficientStock}
                  onClick={() => void handleAccept()}
                  className="flex flex-1 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  Accept
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {showFulfillmentActions && (
        <Card>
          <CardHeader title="Vendor Actions" icon={<Truck className="h-4 w-4" strokeWidth={1.5} />} />
          <div className="space-y-3 px-5 pb-5">
            {actionError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {actionError}
              </p>
            )}
            {detail.available_actions.can_mark_qc && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => void handleMarkQcReady()}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
              >
                Mark QC Ready for Dispatch
              </button>
            )}
            {detail.available_actions.can_advance_status && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => void handleAdvanceStatus()}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
              >
                {advanceButtonLabel}
              </button>
            )}
            {detail.available_actions.can_update_location && (
              <div className="space-y-2">
                {locationCoords ? (
                  <LiveTrackingMap
                    equipmentLat={locationCoords.lat}
                    equipmentLng={locationCoords.lng}
                    address={getDeliveryAddress(detail)}
                    bookingStatus="out_for_delivery"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50/50 text-sm text-cyan-800 sm:h-56">
                    {isSharingLocation
                      ? "Waiting for GPS signal…"
                      : "Starting location sharing…"}
                  </div>
                )}
                {locationError && (
                  <p className="text-xs text-red-600">{locationError}</p>
                )}
              </div>
            )}
            {detail.available_actions.can_confirm_delivery && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Ask the customer for their delivery OTP and enter it below to complete delivery.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={deliveryOtp}
                  onChange={(e) => setDeliveryOtp(e.target.value)}
                  placeholder="Delivery OTP"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                />
                <button
                  type="button"
                  disabled={isActing || deliveryOtp.trim().length < 4}
                  onClick={() => void handleConfirmDelivery()}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  Deliver Order
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      <SectionCard
        title="Order Summary"
        icon={<ScrollText className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow label="Order Number" value={displayValue(detail.order_number)} />
        <DetailRow label="Status" value={displayValue(detail.status_label)} />
        <DetailRow label="Order Created" value={formatOrderCreatedDate(detail.created_at)} />
        {detail.estimated_delivery_date && (
          <DetailRow
            label="Estimated Delivery"
            value={displayValue(detail.estimated_delivery_date)}
          />
        )}
        {detail.po_number && (
          <DetailRow label="PO Number" value={displayValue(detail.po_number)} />
        )}
      </SectionCard>

      <SectionCard title="Customer Information" icon={<User className="h-4 w-4" strokeWidth={1.5} />}>
        <DetailRow label="Customer Name" value={getCustomerName(detail)} />
        <DetailRow label="Customer Contact" value={getCustomerPhone(detail)} />
        <DetailRow label="Customer Email" value={getCustomerEmail(detail)} />
      </SectionCard>

      <SectionCard
        title="Delivery Information"
        icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow label="Deliver To" value={deliverySiteLabel} />
        <DetailRow label="Delivery Address" value={getDeliveryAddress(detail)} />
        <DetailRow label="Delivery Mode" value={getDeliveryMode(detail)} />
        {detail.delivery_otp && (
          <DetailRow label="Delivery OTP" value={displayValue(detail.delivery_otp)} />
        )}
      </SectionCard>

      <SectionCard
        title="Material Items"
        icon={<Package className="h-4 w-4" strokeWidth={1.5} />}
      >
        {stockAwareItems.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">No line items returned for this order.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {stockAwareItems.map((item) => (
              <div key={item.id || formatLineItemSummary(item)} className="flex gap-3 py-3">
                <MaterialItemThumb
                  imageUrl={item.product_image_url}
                  alt={item.product_name}
                  size="detail"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatLineItemSummary(item)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{formatQuantity(item)}</p>
                  {stockLoading ? (
                    <p className="mt-1 text-xs text-gray-400">Checking stock…</p>
                  ) : item.available_stock != null ? (
                    <p
                      className={`mt-1 text-xs font-medium ${
                        item.stock_insufficient ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      Available:{" "}
                      {formatStockQuantity(item.available_stock, item.stock_unit ?? item.unit)}
                      {item.stock_insufficient && item.stock_validation_message
                        ? ` — ${item.stock_validation_message}`
                        : ""}
                    </p>
                  ) : item.stock_validation_message ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      {item.stock_validation_message}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {moneyLabel(
                      typeof item.line_total === "number"
                        ? item.line_total.toFixed(2)
                        : String(item.line_total)
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Bill Summary"
        icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />}
      >
        <DetailRow label="Subtotal" value={moneyLabel(detail.bill_summary.subtotal)} />
        <DetailRow label="Tax" value={moneyLabel(detail.bill_summary.tax_total)} />
        <DetailRow label="Shipping" value={moneyLabel(detail.bill_summary.shipping_total)} />
        {detail.bill_summary.coupon_discount &&
          Number(detail.bill_summary.coupon_discount) > 0 && (
            <DetailRow
              label="Coupon Discount"
              value={`-${moneyLabel(detail.bill_summary.coupon_discount)}`}
            />
          )}
        <DetailRow
          label="Grand Total"
          value={moneyLabel(detail.bill_summary.grand_total)}
        />
        <DetailRow
          label="Payment Method"
          value={displayValue(detail.payment.method.toUpperCase())}
        />
        <DetailRow
          label="Collect Amount (COD)"
          value={moneyLabel(detail.payment.collect_amount)}
        />
        <DetailRow label="Paid" value={detail.payment.paid ? "Yes" : "No"} />
      </SectionCard>

      <SectionCard
        title="Order Timeline"
        icon={<Boxes className="h-4 w-4" strokeWidth={1.5} />}
      >
        <div className="space-y-4">
          {timeline.map((event, index) => (
            <div key={`${event.step}-${index}`} className="flex gap-3">
              <div
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  event.is_current
                    ? "bg-amber-500 ring-4 ring-amber-100"
                    : event.reached_at
                      ? "bg-emerald-500"
                      : "bg-gray-200"
                }`}
              />
              <div>
                <p
                  className={`text-sm font-medium ${
                    event.is_current ? "text-amber-700" : "text-gray-900"
                  }`}
                >
                  {event.label}
                </p>
                <p className="text-xs text-gray-500">
                  {event.reached_at ? formatOrderDateTime(event.reached_at) : "Pending"}
                </p>
              </div>
            </div>
          ))}
          {isCancelledOrder(detail.status) && (
            <p className="text-xs font-medium text-red-600">This order was cancelled.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

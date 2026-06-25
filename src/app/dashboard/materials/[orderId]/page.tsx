import { MaterialOrderDetailsPage } from "@/components/materials/MaterialOrderDetailsPage";

interface MaterialOrderRouteProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function MaterialOrderRoute({
  params,
  searchParams,
}: MaterialOrderRouteProps) {
  const { orderId } = await params;
  const { from } = await searchParams;

  const returnHref =
    from && ["available", "active", "completed"].includes(from)
      ? `/dashboard?tab=${from}`
      : "/dashboard?tab=available";

  return (
    <div className="min-h-dvh bg-gray-50">
      <MaterialOrderDetailsPage orderId={orderId} returnHref={returnHref} />
    </div>
  );
}

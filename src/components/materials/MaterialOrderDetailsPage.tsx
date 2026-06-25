"use client";

import { MaterialOrderDetailsView } from "./MaterialOrderDetailsView";
import { SessionGate } from "@/components/SessionGate";

interface MaterialOrderDetailsPageProps {
  orderId: string;
  returnHref: string;
}

export function MaterialOrderDetailsPage({
  orderId,
  returnHref,
}: MaterialOrderDetailsPageProps) {
  return (
    <SessionGate>
      <MaterialOrderDetailsView orderId={orderId} returnHref={returnHref} />
    </SessionGate>
  );
}

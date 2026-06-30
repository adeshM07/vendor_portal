"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { resolveSiteImageUrl } from "@/lib/vendor";

type EquipmentItemThumbSize = "list" | "detail";

const sizeStyles: Record<
  EquipmentItemThumbSize,
  { box: string; icon: string }
> = {
  list: {
    box: "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600",
    icon: "h-8 w-8",
  },
  detail: {
    box: "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600",
    icon: "h-6 w-6",
  },
};

interface EquipmentItemThumbProps {
  imageUrl?: string | null;
  alt?: string;
  size?: EquipmentItemThumbSize;
}

export function EquipmentItemThumb({
  imageUrl,
  alt = "Equipment",
  size = "list",
}: EquipmentItemThumbProps) {
  const [failed, setFailed] = useState(false);
  const { box, icon } = sizeStyles[size];
  const resolved = imageUrl ? resolveSiteImageUrl(imageUrl) : null;
  const url = resolved?.trim() || null;

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) {
    return (
      <div className={box}>
        <Truck className={icon} strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl bg-amber-50 ${
        size === "list" ? "h-16 w-16" : "h-14 w-14"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

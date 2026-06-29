"use client";

import { useState } from "react";
import { Boxes, Package } from "lucide-react";

type MaterialItemThumbSize = "list" | "detail";

const sizeStyles: Record<
  MaterialItemThumbSize,
  { box: string; icon: string; Icon: typeof Boxes }
> = {
  list: {
    box: "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600",
    icon: "h-8 w-8",
    Icon: Boxes,
  },
  detail: {
    box: "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500",
    icon: "h-6 w-6",
    Icon: Package,
  },
};

interface MaterialItemThumbProps {
  imageUrl?: string | null;
  alt?: string;
  size?: MaterialItemThumbSize;
}

export function MaterialItemThumb({
  imageUrl,
  alt = "Material",
  size = "list",
}: MaterialItemThumbProps) {
  const [failed, setFailed] = useState(false);
  const { box, icon, Icon } = sizeStyles[size];
  const url = imageUrl?.trim();

  if (!url || failed) {
    return (
      <div className={box}>
        <Icon className={icon} strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-slate-100 ${size === "list" ? "h-16 w-16" : "h-14 w-14"}`}>
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

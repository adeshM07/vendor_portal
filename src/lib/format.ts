export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatShortDateRange(start: string, end: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
    return `${fmt.format(new Date(start))} - ${fmt.format(new Date(end))}`;
  } catch {
    return `${start} - ${end}`;
  }
}

export function formatDurationDays(start: string, end: string): string {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    return `${days} Day${days > 1 ? "s" : ""}`;
  } catch {
    return "—";
  }
}

export function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

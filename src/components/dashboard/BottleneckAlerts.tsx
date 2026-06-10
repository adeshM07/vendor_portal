import { AlertTriangle, MapPin, Clock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import type { BottleneckAlert } from "@/lib/mock-data";

interface BottleneckAlertsProps {
  alerts: BottleneckAlert[];
}

export function BottleneckAlerts({ alerts }: BottleneckAlertsProps) {
  return (
    <Card>
      <CardHeader
        title="Logistical Bottlenecks"
        description="Machinery stuck or facing breakdowns"
        icon={
          <AlertTriangle
            className="h-4 w-4 text-red-400"
            strokeWidth={1.5}
          />
        }
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-red-400" />
            {alerts.length} Critical
          </span>
        }
      />

      <div className="divide-y divide-zinc-800/60">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex gap-4 px-5 py-4 transition-colors duration-150 hover:bg-red-500/[0.03]"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-400">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {alert.equipmentName}
                </h3>
                <span className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                  {alert.equipmentId}
                </span>
              </div>

              <p className="mt-1 text-sm text-red-300/90">{alert.issue}</p>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" strokeWidth={1.5} />
                  {alert.siteLocation}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" strokeWidth={1.5} />
                  {alert.timestamp}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

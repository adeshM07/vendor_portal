import { BarChart3 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import type { DeploymentProgress } from "@/lib/mock-data";

interface WorkProgressSectionProps {
  deployments: DeploymentProgress[];
}

function getProgressColor(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 50) return "bg-blue-500";
  return "bg-amber-500";
}

export function WorkProgressSection({ deployments }: WorkProgressSectionProps) {
  const averageProgress = Math.round(
    deployments.reduce((sum, d) => sum + d.completedPercent, 0) /
      deployments.length
  );

  return (
    <Card className="h-full">
      <CardHeader
        title="Work Completion Progress"
        description="Active deployment status across sites"
        icon={<BarChart3 className="h-4 w-4" strokeWidth={1.5} />}
        action={
          <div className="text-right">
            <div className="text-lg font-semibold text-zinc-100">
              {averageProgress}%
            </div>
            <div className="text-[11px] text-zinc-500">Avg. completion</div>
          </div>
        }
      />

      <div className="space-y-5 p-5">
        {deployments.map((deployment) => (
          <div key={deployment.id}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-200">
                  {deployment.projectName}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {deployment.equipmentCount} units deployed
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm text-zinc-400">
                {deployment.completedPercent}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(deployment.completedPercent)}`}
                style={{ width: `${deployment.completedPercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

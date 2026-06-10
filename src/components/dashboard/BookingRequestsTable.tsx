import { ClipboardList } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatStatusLabel } from "@/lib/format";
import type { BookingRequest } from "@/lib/mock-data";

interface BookingRequestsTableProps {
  requests: BookingRequest[];
}

export function BookingRequestsTable({ requests }: BookingRequestsTableProps) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Active Booking Requests"
        description={`${requests.length} incoming rental requests`}
        icon={<ClipboardList className="h-4 w-4" strokeWidth={1.5} />}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800/80 text-xs tracking-wide text-zinc-500 uppercase">
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">Required Date</th>
              <th className="px-5 py-3 font-medium">Equipment</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {requests.map((request) => (
              <tr
                key={request.id}
                className="transition-colors duration-150 hover:bg-zinc-800/20"
              >
                <td className="px-5 py-3.5">
                  <div className="font-medium text-zinc-200">
                    {request.projectName}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-600">
                    {request.id}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-zinc-400">
                  {request.requiredDate}
                </td>
                <td className="px-5 py-3.5 text-zinc-300">
                  {request.equipmentType}
                </td>
                <td className="px-5 py-3.5 text-zinc-300">
                  {formatStatusLabel(request.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

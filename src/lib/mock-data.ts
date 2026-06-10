export type BookingStatus = "pending" | "confirmed" | "in-review";

export interface BookingRequest {
  id: string;
  projectName: string;
  requiredDate: string;
  equipmentType: string;
  status: BookingStatus;
}

export interface DeploymentProgress {
  id: string;
  projectName: string;
  equipmentCount: number;
  completedPercent: number;
}

export interface BottleneckAlert {
  id: string;
  equipmentId: string;
  equipmentName: string;
  issue: string;
  siteLocation: string;
  timestamp: string;
}

export const bookingRequests: BookingRequest[] = [
  {
    id: "BR-1042",
    projectName: "Skyline Tower Phase 2",
    requiredDate: "Jun 12, 2026",
    equipmentType: "Tower Crane TC-200",
    status: "pending",
  },
  {
    id: "BR-1041",
    projectName: "Metro Line Extension",
    requiredDate: "Jun 10, 2026",
    equipmentType: "Concrete Mixer CM-08",
    status: "in-review",
  },
  {
    id: "BR-1039",
    projectName: "Harbor Bridge Retrofit",
    requiredDate: "Jun 14, 2026",
    equipmentType: "Mobile Crane MC-15",
    status: "confirmed",
  },
  {
    id: "BR-1037",
    projectName: "Greenfield Industrial Park",
    requiredDate: "Jun 18, 2026",
    equipmentType: "Excavator EX-12",
    status: "pending",
  },
  {
    id: "BR-1035",
    projectName: "Riverside Residences",
    requiredDate: "Jun 09, 2026",
    equipmentType: "Scaffolding Kit SC-40",
    status: "in-review",
  },
];

export const deploymentProgress: DeploymentProgress[] = [
  {
    id: "DP-01",
    projectName: "Site Alpha — Foundation Works",
    equipmentCount: 6,
    completedPercent: 80,
  },
  {
    id: "DP-02",
    projectName: "Site Beta — Structural Steel",
    equipmentCount: 4,
    completedPercent: 55,
  },
  {
    id: "DP-03",
    projectName: "Site Gamma — Earthworks",
    equipmentCount: 8,
    completedPercent: 92,
  },
  {
    id: "DP-04",
    projectName: "Site Delta — Finishing Phase",
    equipmentCount: 3,
    completedPercent: 34,
  },
];

export const bottleneckAlerts: BottleneckAlert[] = [
  {
    id: "AL-01",
    equipmentId: "EX-04",
    equipmentName: "Excavator EX-04",
    issue: "Stuck due to mechanical fault",
    siteLocation: "Site Alpha",
    timestamp: "Jun 8, 2026 · 09:42 AM",
  },
  {
    id: "AL-02",
    equipmentId: "CM-03",
    equipmentName: "Concrete Mixer CM-03",
    issue: "Hydraulic leak — operations halted",
    siteLocation: "Site Beta",
    timestamp: "Jun 8, 2026 · 08:15 AM",
  },
  {
    id: "AL-03",
    equipmentId: "TC-07",
    equipmentName: "Tower Crane TC-07",
    issue: "Awaiting spare parts delivery",
    siteLocation: "Harbor Bridge Site",
    timestamp: "Jun 7, 2026 · 04:30 PM",
  },
];

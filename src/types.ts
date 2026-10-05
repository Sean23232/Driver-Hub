export type Theme = "dark" | "light";
export type PresetKind = "customers" | "jobSites" | "pickups" | "deliveries" | "trucks" | "trailers" | "drivers";
export type Material = "Concrete" | "C&D" | "Dirt" | "Metals" | "Rock" | "Other";

export interface Preset {
  id: string;
  name: string;
  email?: string;
  address?: string;
  lat?: number;
  lng?: number;
  pin?: string;
  truckId?: string;
  trailerId?: string;
}

export interface SheetLoad {
  id: string;
  material: Material;
  otherMaterial: string;
  tons: string;
  ticket: string;
  scanId?: string;
  image?: string;
}

export interface DailySheet {
  id: string;
  driverId: string;
  status: "draft" | "queued" | "submitted" | "reviewed";
  customerId: string;
  invoice: string;
  date: string;
  jobNumber: string;
  poNumber: string;
  truck: string;
  trailer: string;
  vehicleType: "Tandem Dump Truck" | "Semi & Dump Trailer";
  startTime: string;
  endTime: string;
  jobSite: string;
  pickup: string;
  delivery: string;
  loads: SheetLoad[];
  notes: string;
  signature: string;
  signedName: string;
  signedAt: string;
  customerEmail: string;
  sendCopy: boolean;
  submittedAt?: string;
}

export interface Defect {
  item: string;
  description: string;
  photo?: string;
}

export interface Inspection {
  id: string;
  driverId: string;
  status: "draft" | "queued" | "submitted" | "reviewed" | "resolved";
  date: string;
  time: string;
  truck: string;
  trailer: string;
  odometer: string;
  reviewed: string[];
  defects: Defect[];
  remarks: string;
  condition: "satisfactory" | "correction";
  signature: string;
  signedAt: string;
  submittedAt?: string;
  mechanicName?: string;
  mechanicSignature?: string;
  resolution?: "corrected" | "not-required";
  resolvedAt?: string;
}

export interface Scan {
  id: string;
  driverId: string;
  status: "queued" | "sent" | "reviewed";
  type: "Haul Ticket" | "DOT Inspection" | "Fuel Receipt" | "Scale Ticket" | "Other";
  note: string;
  loadId: string;
  pages: string[];
  createdAt: string;
}

export interface Activity {
  id: string;
  kind: "sheet" | "inspection" | "scan" | "system";
  title: string;
  detail: string;
  time: string;
}

export interface HubData {
  customers: Preset[];
  jobSites: Preset[];
  pickups: Preset[];
  deliveries: Preset[];
  trucks: Preset[];
  trailers: Preset[];
  drivers: Preset[];
  sheets: DailySheet[];
  inspections: Inspection[];
  scans: Scan[];
  draftSheets: Record<string, DailySheet>;
  draftInspections: Record<string, Inspection>;
  activity: Activity[];
  activeDriverId: string | null;
  theme: Theme;
  simulateOffline: boolean;
  lastSync: string;
  guideSeen: boolean;
}
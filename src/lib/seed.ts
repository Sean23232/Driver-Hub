import type { Activity, DailySheet, HubData, Inspection, Preset, Scan } from "../types";
import { dayOffset, localDate, newSheet, uid } from "./helpers";

export const initialCustomers: Preset[] = [
  { id: "dh-griffin", name: "DH Griffin Wrecking", email: "dispatch@dhgriffin.example" },
  { id: "peachtree", name: "Peachtree Site Works", email: "operations@peachtree.example" },
  { id: "atlas", name: "Atlas Demolition", email: "billing@atlasdemo.example" },
  { id: "georgia-grading", name: "Georgia Grading Co.", email: "office@georgiagrading.example" },
];

export const initialDrivers: Preset[] = [
  { id: "marlin", name: "Marlin Samples", pin: "1111", truckId: "SE1501", trailerId: "SE1901" },
  { id: "shane", name: "Shane", pin: "2222", truckId: "SE1502", trailerId: "SE1902" },
  { id: "demo", name: "Demo Driver", pin: "3333", truckId: "SE1503", trailerId: "SE1903" },
];

export const initialJobSites: Preset[] = [
  { id: "cobb-galleria", name: "Cobb Galleria", address: "2 Galleria Pkwy SE, Atlanta, GA", lat: 33.8812, lng: -84.4645 },
  { id: "midtown-redevelopment", name: "Midtown Redevelopment", address: "10th St NE, Atlanta, GA", lat: 33.7811, lng: -84.3840 },
  { id: "westside-works", name: "Westside Works", address: "Howell Mill Rd NW, Atlanta, GA", lat: 33.7973, lng: -84.4154 },
];

export const initialPickups: Preset[] = [
  { id: "pickup-cobb", name: "Cobb Galleria", address: "2 Galleria Pkwy SE, Atlanta, GA", lat: 33.8812, lng: -84.4645 },
  { id: "pickup-midtown", name: "Midtown Redevelopment", address: "10th St NE, Atlanta, GA", lat: 33.7811, lng: -84.3840 },
  { id: "pickup-yard", name: "Samples Yard", address: "658 Little Circle, Tallapoosa, GA 30176", lat: 33.7445, lng: -85.2882 },
];

export const initialDeliveries: Preset[] = [
  { id: "willow-oak", name: "Willow Oak Landfill", address: "West Atlanta area, GA (demo location)", lat: 33.7497, lng: -84.8950 },
  { id: "east-point", name: "East Point Transfer Station", address: "East Point, GA (demo location)", lat: 33.6750, lng: -84.4440 },
  { id: "rockmart", name: "Rockmart Recycling", address: "Rockmart, GA (demo location)", lat: 34.0026, lng: -85.0400 },
];

const makeSheet = (overrides: Partial<DailySheet>): DailySheet => ({
  id: uid(), driverId: "marlin", status: "submitted", customerId: "dh-griffin", invoice: "BSE26431",
  date: dayOffset(-1), jobNumber: "CG-204", poNumber: "PO-7204", truck: "SE1501", trailer: "SE1901",
  vehicleType: "Semi & Dump Trailer", startTime: "06:30", endTime: "15:10", jobSite: "Cobb Galleria",
  pickup: "Cobb Galleria", delivery: "Willow Oak Landfill", loads: [
    { id: uid(), material: "C&D", otherMaterial: "", tons: "10.91", ticket: "958348" },
    { id: uid(), material: "C&D", otherMaterial: "", tons: "11.24", ticket: "958351" },
    { id: uid(), material: "Concrete", otherMaterial: "", tons: "10.25", ticket: "958362" },
  ], notes: "Loads delivered to scale house. Site conditions clear.", signature: "", signedName: "J. Carter",
  signedAt: `${dayOffset(-1)}T15:12:00`, customerEmail: "dispatch@dhgriffin.example", sendCopy: true,
  submittedAt: `${dayOffset(-1)}T15:14:00`, ...overrides,
});

const makeInspection = (overrides: Partial<Inspection>): Inspection => ({
  id: uid(), driverId: "marlin", status: "submitted", date: dayOffset(-1), time: "05:30",
  truck: "SE1501", trailer: "SE1901", odometer: "489504", reviewed: [], defects: [], remarks: "",
  condition: "satisfactory", signature: "", signedAt: `${dayOffset(-1)}T05:34:00`,
  submittedAt: `${dayOffset(-1)}T05:34:00`, ...overrides,
});

function demoDocument(title: string, ticket: string, detail: string, weight: string) {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 570;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#f5f2e9";
  ctx.fillRect(0, 0, 420, 570);
  ctx.strokeStyle = "#c4c0b6";
  ctx.lineWidth = 2;
  ctx.strokeRect(19, 18, 382, 530);
  ctx.fillStyle = "#28313a";
  ctx.font = "bold 23px monospace";
  ctx.textAlign = "center";
  ctx.fillText(title, 210, 66);
  ctx.font = "12px monospace";
  ctx.fillText("SAMPLES ENTERPRISE LLC  -  DEMO RECORD", 210, 91);
  ctx.strokeStyle = "#999b99";
  ctx.beginPath(); ctx.moveTo(37, 112); ctx.lineTo(383, 112); ctx.stroke();
  ctx.textAlign = "left";
  const rows = [
    ["TICKET NO.", ticket], ["DATE", "OCT 05, 2026"], ["TRUCK", "SE1501"],
    ["TRAILER", "SE1901"], ["CUSTOMER", "DH GRIFFIN WRECKING"], ["DETAIL", detail], ["NET WEIGHT", weight],
  ];
  rows.forEach(([label, value], index) => {
    const y = 145 + index * 47;
    ctx.fillStyle = "#7f8588";
    ctx.font = "10px monospace";
    ctx.fillText(label, 39, y);
    ctx.fillStyle = "#26303a";
    ctx.font = "bold 16px monospace";
    ctx.fillText(value, 39, y + 19);
    ctx.strokeStyle = "#dad9d3";
    ctx.beginPath(); ctx.moveTo(39, y + 27); ctx.lineTo(381, y + 27); ctx.stroke();
  });
  ctx.fillStyle = "rgba(175, 98, 16, .16)";
  ctx.font = "bold 49px sans-serif";
  ctx.translate(81, 500); ctx.rotate(-.28); ctx.fillText("DEMO COPY", 0, 0);
  return canvas.toDataURL("image/jpeg", .65);
}

export function createSeedData(): HubData {
  const sheets: DailySheet[] = [
    makeSheet({ id: "seed-sheet-today-1", driverId: "shane", customerId: "peachtree", invoice: "BSE26435", date: localDate(), truck: "SE1502", trailer: "SE1902", jobSite: "Midtown Redevelopment", pickup: "Midtown Redevelopment", delivery: "East Point Transfer Station", startTime: "06:15", endTime: "13:40", loads: [
      { id: uid(), material: "Dirt", otherMaterial: "", tons: "12.45", ticket: "973104" },
      { id: uid(), material: "Dirt", otherMaterial: "", tons: "11.98", ticket: "973117" },
      { id: uid(), material: "Rock", otherMaterial: "", tons: "9.72", ticket: "973139" },
    ], signedName: "A. Miller", customerEmail: "operations@peachtree.example", submittedAt: new Date(Date.now() - 38 * 60000).toISOString() }),
    makeSheet({ id: "seed-sheet-today-2", driverId: "demo", customerId: "atlas", invoice: "BSE26434", date: localDate(), truck: "SE1503", trailer: "SE1903", jobSite: "Westside Works", pickup: "Westside Works", delivery: "Rockmart Recycling", startTime: "07:00", endTime: "12:20", loads: [
      { id: uid(), material: "Concrete", otherMaterial: "", tons: "10.82", ticket: "960281" },
      { id: uid(), material: "Metals", otherMaterial: "", tons: "8.60", ticket: "960299" },
    ], signedName: "R. Ellis", customerEmail: "billing@atlasdemo.example", submittedAt: new Date(Date.now() - 95 * 60000).toISOString() }),
    makeSheet({ id: "seed-paper-sample", date: "2026-10-05", invoice: "BSE26431", startTime: "06:30", endTime: "15:10", submittedAt: "2026-10-05T15:12:00", signedAt: "2026-10-05T15:10:00" }),
    makeSheet({ id: "seed-sheet-yesterday", driverId: "shane", customerId: "georgia-grading", invoice: "BSE26433", date: dayOffset(-1), truck: "SE1502", trailer: "SE1902", loads: [
      { id: uid(), material: "Dirt", otherMaterial: "", tons: "12.10", ticket: "961200" },
      { id: uid(), material: "Dirt", otherMaterial: "", tons: "11.80", ticket: "961201" },
    ], customerEmail: "office@georgiagrading.example" }),
    makeSheet({ id: "seed-sheet-older", customerId: "atlas", invoice: "BSE26432", date: dayOffset(-3), customerEmail: "billing@atlasdemo.example" }),
    makeSheet({ id: "seed-sheet-week", customerId: "peachtree", invoice: "BSE26430", date: dayOffset(-5), customerEmail: "operations@peachtree.example" }),
  ];

  const inspections: Inspection[] = [
    makeInspection({ id: "seed-inspection-today", driverId: "shane", date: localDate(), time: "05:42", truck: "SE1502", trailer: "SE1902", odometer: "322418", signedAt: `${localDate()}T05:45:00`, submittedAt: new Date(Date.now() - 190 * 60000).toISOString() }),
    makeInspection({ id: "seed-inspection-defect", driverId: "shane", date: dayOffset(-1), time: "05:37", truck: "SE1502", trailer: "SE1902", odometer: "322201", defects: [{ item: "Tires", description: "Left rear tire sidewall bulge" }], remarks: "Left rear tire sidewall bulge. Please inspect before next dispatch.", condition: "correction" }),
    makeInspection({ id: "seed-inspection-paper", date: "2026-10-05", time: "05:30", odometer: "489504", signedAt: "2026-10-05T05:30:00", submittedAt: "2026-10-05T05:30:00" }),
    makeInspection({ id: "seed-inspection-recent", date: dayOffset(-2), odometer: "489390" }),
  ];

  const scans: Scan[] = [
    { id: "seed-scan-1", driverId: "shane", status: "sent", type: "Haul Ticket", note: "Scale ticket 973104", loadId: "", pages: [demoDocument("HAUL TICKET", "973104", "DIRT", "12.45 TONS")], createdAt: new Date(Date.now() - 50 * 60000).toISOString() },
    { id: "seed-scan-2", driverId: "demo", status: "sent", type: "Fuel Receipt", note: "Fuel stop near Marietta", loadId: "", pages: [demoDocument("FUEL RECEIPT", "FR-2047", "DIESEL", "79.35 GAL")], createdAt: new Date(Date.now() - 135 * 60000).toISOString() },
    { id: "seed-scan-3", driverId: "marlin", status: "sent", type: "Scale Ticket", note: "Willow Oak scale house", loadId: "", pages: [demoDocument("SCALE TICKET", "958348", "C&D", "10.91 TONS")], createdAt: `${dayOffset(-1)}T14:10:00` },
  ];

  const activity: Activity[] = [
    { id: uid(), kind: "sheet", title: "Daily sheet received", detail: "Shane · Peachtree Site Works · 34.15 tons", time: new Date(Date.now() - 38 * 60000).toISOString() },
    { id: uid(), kind: "scan", title: "Haul ticket received", detail: "Shane · Ticket 973104", time: new Date(Date.now() - 50 * 60000).toISOString() },
    { id: uid(), kind: "sheet", title: "Daily sheet received", detail: "Demo Driver · Atlas Demolition · 19.42 tons", time: new Date(Date.now() - 95 * 60000).toISOString() },
    { id: uid(), kind: "inspection", title: "Inspection completed", detail: "Shane · SE1502 · All clear", time: new Date(Date.now() - 190 * 60000).toISOString() },
    { id: uid(), kind: "inspection", title: "Defect needs attention", detail: "Shane · SE1502 · Left rear tire sidewall bulge", time: `${dayOffset(-1)}T05:37:00` },
  ];

  return {
    customers: initialCustomers, jobSites: initialJobSites, pickups: initialPickups,
    deliveries: initialDeliveries, trucks: ["SE1501", "SE1502", "SE1503"].map((name) => ({ id: name, name })),
    trailers: ["SE1901", "SE1902", "SE1903"].map((name) => ({ id: name, name })),
    drivers: initialDrivers, sheets, inspections, scans,
    draftSheets: { marlin: newSheet(initialDrivers[0], "BSE26436", initialCustomers, true) },
    draftInspections: {}, activity, activeDriverId: "marlin", theme: "dark", simulateOffline: false,
    lastSync: new Date().toISOString(), guideSeen: false,
  };
}
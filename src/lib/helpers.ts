import type { DailySheet, Inspection, Preset, SheetLoad } from "../types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  if (!date) return "--";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", options ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatClock(value: string) {
  if (!value) return "--";
  const [hour, minute] = value.split(":").map(Number);
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function duration(start: string, end: string) {
  if (!start) return "--";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = (end || timeNow()).split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes = end ? minutes + 1440 : 0;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function totalTons(loads: SheetLoad[]) {
  return loads.reduce((sum, load) => sum + (Number.parseFloat(load.tons) || 0), 0);
}

export function formatTons(tons: number) {
  return tons.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function displayName(id: string, presets: Preset[]) {
  return presets.find((item) => item.id === id)?.name || id || "--";
}

export function newLoad(): SheetLoad {
  return { id: uid(), material: "C&D", otherMaterial: "", tons: "", ticket: "" };
}

export function newSheet(driver: Preset, invoice: string, customers: Preset[], sample = false): DailySheet {
  return {
    id: uid(), driverId: driver.id, status: "draft", customerId: customers[0]?.id || "",
    invoice, date: localDate(), jobNumber: "", poNumber: "", truck: driver.truckId || "SE1501",
    trailer: driver.trailerId || "SE1901", vehicleType: "Semi & Dump Trailer", startTime: "",
    endTime: "", jobSite: "Cobb Galleria", pickup: "Cobb Galleria", delivery: "Willow Oak Landfill",
    loads: [sample ? { ...newLoad(), tons: "10.91", ticket: "958348" } : newLoad()], notes: "", signature: "",
    signedName: "", signedAt: "", customerEmail: customers[0]?.email || "", sendCopy: true,
  };
}

export function newInspection(driver: Preset): Inspection {
  return {
    id: uid(), driverId: driver.id, status: "draft", date: localDate(), time: timeNow(),
    truck: driver.truckId || "SE1501", trailer: driver.trailerId || "SE1901", odometer: "", reviewed: [],
    defects: [], remarks: "", condition: "satisfactory", signature: "", signedAt: "",
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
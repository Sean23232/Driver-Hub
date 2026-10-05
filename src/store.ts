import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Activity, DailySheet, HubData, Inspection, Preset, PresetKind, Scan } from "./types";
import { displayName, localDate, newInspection, newSheet, totalTons, uid } from "./lib/helpers";
import { createSeedData } from "./lib/seed";

const STORAGE_KEY = "driver-hub-samples-v1";
const initialData = createSeedData();
const persistedKeys = Object.keys(initialData) as (keyof HubData)[];

interface HubActions {
  login: (driverId: string, pin: string) => boolean;
  logout: () => void;
  setTheme: (theme: HubData["theme"]) => void;
  setOffline: (offline: boolean) => void;
  setGuideSeen: (seen: boolean) => void;
  ensureSheetDraft: (driverId: string) => void;
  updateSheetDraft: (driverId: string, patch: Partial<DailySheet>) => void;
  startNewSheet: (driverId: string) => void;
  submitSheet: (driverId: string) => DailySheet | undefined;
  ensureInspectionDraft: (driverId: string) => void;
  updateInspectionDraft: (driverId: string, patch: Partial<Inspection>) => void;
  resetInspectionDraft: (driverId: string) => void;
  submitInspection: (driverId: string) => Inspection | undefined;
  addScan: (scan: Scan) => void;
  markReviewed: (kind: "sheet" | "inspection" | "scan", id: string) => void;
  resolveInspection: (id: string, mechanicName: string, mechanicSignature: string, resolution: "corrected" | "not-required") => void;
  savePreset: (kind: PresetKind, preset: Preset, originalId?: string) => void;
  deletePreset: (kind: PresetKind, id: string) => void;
  addActivity: (activity: Omit<Activity, "id" | "time">) => void;
  resetDemo: () => void;
}

export type HubStore = HubData & HubActions;

function nextInvoice(sheets: DailySheet[]) {
  const max = Math.max(26430, ...sheets.map((sheet) => Number(sheet.invoice.replace(/\D/g, "")) || 0));
  return `BSE${max + 1}`;
}

const activity = (kind: Activity["kind"], title: string, detail: string): Activity => ({
  id: uid(), kind, title, detail, time: new Date().toISOString(),
});

export const useHubStore = create<HubStore>()(
  persist(
    (set, get) => ({
      ...initialData,
      login: (driverId, pin) => {
        const driver = get().drivers.find((item) => item.id === driverId && item.pin === pin);
        if (!driver) return false;
        set({ activeDriverId: driverId });
        get().ensureSheetDraft(driverId);
        return true;
      },
      logout: () => set({ activeDriverId: null }),
      setTheme: (theme) => set({ theme }),
      setGuideSeen: (guideSeen) => set({ guideSeen }),
      setOffline: (simulateOffline) => {
        if (simulateOffline) {
          set({ simulateOffline: true });
          return;
        }
        const state = get();
        const queuedSheets = state.sheets.filter((item) => item.status === "queued");
        const queuedInspections = state.inspections.filter((item) => item.status === "queued");
        const queuedScans = state.scans.filter((item) => item.status === "queued");
        const syncedActivities: Activity[] = [
          ...queuedSheets.map((item) => activity("sheet", "Daily sheet received", `${displayName(item.driverId, state.drivers)} · ${displayName(item.customerId, state.customers)} · ${totalTons(item.loads).toFixed(2)} tons`)),
          ...queuedInspections.map((item) => activity("inspection", item.defects.length ? "Defect needs attention" : "Inspection completed", `${displayName(item.driverId, state.drivers)} · ${item.truck} · ${item.defects.length ? `${item.defects.length} defect(s)` : "All clear"}`)),
          ...queuedScans.map((item) => activity("scan", `${item.type} received`, `${displayName(item.driverId, state.drivers)} · ${item.pages.length} page(s)`)),
        ];
        set({
          simulateOffline: false, lastSync: new Date().toISOString(),
          sheets: state.sheets.map((item) => item.status === "queued" ? { ...item, status: "submitted" as const } : item),
          inspections: state.inspections.map((item) => item.status === "queued" ? { ...item, status: "submitted" as const } : item),
          scans: state.scans.map((item) => item.status === "queued" ? { ...item, status: "sent" as const } : item),
          draftSheets: Object.fromEntries(Object.entries(state.draftSheets).map(([key, value]) => [key, value.status === "queued" ? { ...value, status: "submitted" as const } : value])),
          draftInspections: Object.fromEntries(Object.entries(state.draftInspections).map(([key, value]) => [key, value.status === "queued" ? { ...value, status: "submitted" as const } : value])),
          activity: [...syncedActivities, ...state.activity].slice(0, 100),
        });
      },
      ensureSheetDraft: (driverId) => {
        const state = get();
        if (state.draftSheets[driverId]) return;
        const driver = state.drivers.find((item) => item.id === driverId);
        if (!driver) return;
        set({ draftSheets: { ...state.draftSheets, [driverId]: newSheet(driver, nextInvoice([...state.sheets, ...Object.values(state.draftSheets)]), state.customers) } });
      },
      updateSheetDraft: (driverId, patch) => set((state) => {
        const draft = state.draftSheets[driverId];
        if (!draft || draft.status !== "draft") return state;
        return { draftSheets: { ...state.draftSheets, [driverId]: { ...draft, ...patch } } };
      }),
      startNewSheet: (driverId) => set((state) => {
        const driver = state.drivers.find((item) => item.id === driverId);
        if (!driver) return state;
        return { draftSheets: { ...state.draftSheets, [driverId]: newSheet(driver, nextInvoice([...state.sheets, ...Object.values(state.draftSheets)]), state.customers) } };
      }),
      submitSheet: (driverId) => {
        const state = get();
        const draft = state.draftSheets[driverId];
        if (!draft || draft.status !== "draft") return undefined;
        const submitted: DailySheet = { ...draft, status: state.simulateOffline ? "queued" : "submitted", submittedAt: new Date().toISOString() };
        set({
          sheets: [submitted, ...state.sheets], draftSheets: { ...state.draftSheets, [driverId]: submitted },
          lastSync: state.simulateOffline ? state.lastSync : new Date().toISOString(),
          activity: state.simulateOffline ? state.activity : [activity("sheet", "Daily sheet received", `${displayName(driverId, state.drivers)} · ${displayName(draft.customerId, state.customers)} · ${totalTons(draft.loads).toFixed(2)} tons`), ...state.activity].slice(0, 100),
        });
        return submitted;
      },
      ensureInspectionDraft: (driverId) => {
        const state = get();
        if (state.draftInspections[driverId]?.date === localDate()) return;
        const driver = state.drivers.find((item) => item.id === driverId);
        if (driver) set({ draftInspections: { ...state.draftInspections, [driverId]: newInspection(driver) } });
      },
      updateInspectionDraft: (driverId, patch) => set((state) => {
        const draft = state.draftInspections[driverId];
        if (!draft || draft.status !== "draft") return state;
        return { draftInspections: { ...state.draftInspections, [driverId]: { ...draft, ...patch } } };
      }),
      resetInspectionDraft: (driverId) => set((state) => {
        const driver = state.drivers.find((item) => item.id === driverId);
        if (!driver) return state;
        return { draftInspections: { ...state.draftInspections, [driverId]: newInspection(driver) } };
      }),
      submitInspection: (driverId) => {
        const state = get();
        const draft = state.draftInspections[driverId];
        if (!draft || draft.status !== "draft") return undefined;
        const submitted: Inspection = { ...draft, status: state.simulateOffline ? "queued" : "submitted", signedAt: draft.signedAt || new Date().toISOString(), submittedAt: new Date().toISOString() };
        set({
          inspections: [submitted, ...state.inspections], draftInspections: { ...state.draftInspections, [driverId]: submitted },
          lastSync: state.simulateOffline ? state.lastSync : new Date().toISOString(),
          activity: state.simulateOffline ? state.activity : [activity("inspection", draft.defects.length ? "Defect needs attention" : "Inspection completed", `${displayName(driverId, state.drivers)} · ${draft.truck} · ${draft.defects.length ? `${draft.defects.length} defect(s)` : "All clear"}`), ...state.activity].slice(0, 100),
        });
        return submitted;
      },
      addScan: (scan) => set((state) => {
        const queued = state.simulateOffline;
        const saved: Scan = { ...scan, status: queued ? "queued" : "sent" };
        const draft = state.draftSheets[scan.driverId];
        const updatedDraft = draft && scan.loadId && draft.status === "draft" ? {
          ...state.draftSheets,
          [scan.driverId]: { ...draft, loads: draft.loads.map((load) => load.id === scan.loadId ? { ...load, scanId: scan.id, image: scan.pages[0] } : load) },
        } : state.draftSheets;
        return {
          scans: [saved, ...state.scans], draftSheets: updatedDraft,
          lastSync: queued ? state.lastSync : new Date().toISOString(),
          activity: queued ? state.activity : [activity("scan", `${scan.type} received`, `${displayName(scan.driverId, state.drivers)} · ${scan.pages.length} page(s)`), ...state.activity].slice(0, 100),
        };
      }),
      markReviewed: (kind, id) => set((state) => ({
        sheets: kind === "sheet" ? state.sheets.map((item) => item.id === id ? { ...item, status: "reviewed" as const } : item) : state.sheets,
        inspections: kind === "inspection" ? state.inspections.map((item) => item.id === id && item.status !== "resolved" ? { ...item, status: "reviewed" as const } : item) : state.inspections,
        scans: kind === "scan" ? state.scans.map((item) => item.id === id ? { ...item, status: "reviewed" as const } : item) : state.scans,
      })),
      resolveInspection: (id, mechanicName, mechanicSignature, resolution) => set((state) => {
        const inspection = state.inspections.find((item) => item.id === id);
        if (!inspection) return state;
        const resolved = (item: Inspection): Inspection => ({ ...item, mechanicName, mechanicSignature, resolution, resolvedAt: new Date().toISOString(), status: "resolved" });
        return {
          inspections: state.inspections.map((item) => item.id === id ? resolved(item) : item),
          draftInspections: Object.fromEntries(Object.entries(state.draftInspections).map(([driverId, item]) => [driverId, item.id === id ? resolved(item) : item])),
          activity: [activity("inspection", "Defect resolved", `${inspection.truck} · ${mechanicName} · ${resolution === "corrected" ? "Corrected" : "Safe to operate"}`), ...state.activity].slice(0, 100),
        };
      }),
      savePreset: (kind, preset, originalId) => set((state) => {
        const changes: Partial<HubStore> = { [kind]: originalId ? state[kind].map((item) => item.id === originalId ? preset : item) : [...state[kind], preset] } as Partial<HubStore>;
        if (kind === "customers" && originalId) {
          changes.draftSheets = Object.fromEntries(Object.entries(state.draftSheets).map(([driverId, sheet]) => [driverId, sheet.customerId === originalId && sheet.status === "draft" ? { ...sheet, customerEmail: preset.email || sheet.customerEmail } : sheet]));
        }
        if ((kind === "trucks" || kind === "trailers") && originalId && preset.name !== state[kind].find((item) => item.id === originalId)?.name) {
          const previousName = state[kind].find((item) => item.id === originalId)?.name;
          changes.drivers = state.drivers.map((driver) => kind === "trucks" && driver.truckId === originalId ? { ...driver, truckId: preset.name } : kind === "trailers" && driver.trailerId === originalId ? { ...driver, trailerId: preset.name } : driver);
          changes.draftSheets = Object.fromEntries(Object.entries(state.draftSheets).map(([driverId, sheet]) => [driverId, kind === "trucks" && sheet.truck === previousName ? { ...sheet, truck: preset.name } : kind === "trailers" && sheet.trailer === previousName ? { ...sheet, trailer: preset.name } : sheet]));
          changes.draftInspections = Object.fromEntries(Object.entries(state.draftInspections).map(([driverId, report]) => [driverId, kind === "trucks" && report.truck === previousName ? { ...report, truck: preset.name } : kind === "trailers" && report.trailer === previousName ? { ...report, trailer: preset.name } : report]));
        }
        return changes;
      }),
      deletePreset: (kind, id) => set((state) => {
        const removed = state[kind].find((item) => item.id === id);
        const changes: Partial<HubStore> = { [kind]: state[kind].filter((item) => item.id !== id) } as Partial<HubStore>;
        if (kind === "customers" && removed) {
          changes.sheets = state.sheets.map((sheet) => sheet.customerId === id ? { ...sheet, customerId: removed.name } : sheet);
          changes.draftSheets = Object.fromEntries(Object.entries(state.draftSheets).map(([driverId, sheet]) => [driverId, sheet.customerId === id ? { ...sheet, customerId: removed.name } : sheet]));
        }
        if (kind === "drivers" && removed) {
          changes.sheets = state.sheets.map((sheet) => sheet.driverId === id ? { ...sheet, driverId: removed.name } : sheet);
          changes.inspections = state.inspections.map((item) => item.driverId === id ? { ...item, driverId: removed.name } : item);
          changes.scans = state.scans.map((item) => item.driverId === id ? { ...item, driverId: removed.name } : item);
        }
        if (kind === "trucks" || kind === "trailers") {
          const replacement = state[kind].find((item) => item.id !== id)?.id || "";
          changes.drivers = state.drivers.map((driver) => kind === "trucks" && driver.truckId === id ? { ...driver, truckId: replacement } : kind === "trailers" && driver.trailerId === id ? { ...driver, trailerId: replacement } : driver);
          changes.draftSheets = Object.fromEntries(Object.entries(state.draftSheets).map(([driverId, sheet]) => [driverId, sheet.status === "draft" && kind === "trucks" && sheet.truck === removed?.name ? { ...sheet, truck: replacement } : sheet.status === "draft" && kind === "trailers" && sheet.trailer === removed?.name ? { ...sheet, trailer: replacement } : sheet]));
          changes.draftInspections = Object.fromEntries(Object.entries(state.draftInspections).map(([driverId, report]) => [driverId, report.status === "draft" && kind === "trucks" && report.truck === removed?.name ? { ...report, truck: replacement } : report.status === "draft" && kind === "trailers" && report.trailer === removed?.name ? { ...report, trailer: replacement } : report]));
        }
        return changes;
      }),
      addActivity: (entry) => set((state) => ({ activity: [activity(entry.kind, entry.title, entry.detail), ...state.activity].slice(0, 100) })),
      resetDemo: () => set({ ...createSeedData() }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => Object.fromEntries(persistedKeys.map((key) => [key, state[key]])),
    },
  ),
);

// Zustand persists one snapshot; a second tab reloads that snapshot on storage or channel notifications.
export function setupCrossTabSync() {
  let applyingExternal = false;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("driver-hub-live") : null;
  const applySnapshot = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { state?: Partial<HubData> };
      if (!parsed.state) return;
      applyingExternal = true;
      useHubStore.setState(parsed.state);
      applyingExternal = false;
    } catch {
      applyingExternal = false;
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) applySnapshot(event.newValue);
  };
  const unsubscribe = useHubStore.subscribe(() => {
    if (!applyingExternal) queueMicrotask(() => channel?.postMessage("updated"));
  });
  if (channel) channel.onmessage = () => applySnapshot(localStorage.getItem(STORAGE_KEY));
  window.addEventListener("storage", onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}
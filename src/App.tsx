import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Toaster, toast } from "sonner";
import { BookOpen, Check, ChevronDown, CloudOff, CloudUpload, ExternalLink, LogOut, Menu, Moon, RotateCcw, Sun, Truck, Wifi } from "lucide-react";
import { Brand, Avatar, Button, Modal } from "./components/ui";
import { formatDate, localDate, timeAgo } from "./lib/helpers";
import { setupCrossTabSync, useHubStore } from "./store";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Sheet from "./pages/Sheet";
import InspectionPage from "./pages/Inspection";
import MapPage from "./pages/MapPage";
import Scanner from "./pages/Scanner";
import Office from "./pages/Office";

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="header-clock"><span>{formatDate(localDate(now), { weekday: "short", month: "short", day: "numeric" })}</span><strong className="mono">{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</strong></div>;
}

function DemoGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const setGuideSeen = useHubStore((state) => state.setGuideSeen);
  return <Modal open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setGuideSeen(true); }} title="Your 3-minute demo" description="Take Driver Hub for a quick spin, then watch the office update live.">
    <div className="guide-list">
      {["Do the inspection.", "Fill the daily sheet.", "Open the Office view in another tab and watch it arrive live."].map((item, index) => <div className="guide-step" key={item}><span>{index + 1}</span><strong>{item}</strong></div>)}
    </div>
    <p className="guide-note">Find Office view in your avatar menu. Everything is stored locally in this browser; email delivery and the offline switch are simulated for this concept.</p>
    <Button variant="primary" className="w-full" onClick={() => { setGuideSeen(true); onOpenChange(false); }}>Let's drive <Check size={18} /></Button>
  </Modal>;
}

function DriverHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useHubStore();
  const driver = state.drivers.find((item) => item.id === state.activeDriverId);
  const queued = state.sheets.filter((item) => item.status === "queued").length + state.inspections.filter((item) => item.status === "queued").length + state.scans.filter((item) => item.status === "queued").length;
  const [guideOpen, setGuideOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const offline = state.simulateOffline;

  const toggleOffline = () => {
    if (offline) {
      setSyncing(true);
      window.setTimeout(() => {
        state.setOffline(false);
        setSyncing(false);
        toast.success(queued ? `${queued} queued item${queued === 1 ? "" : "s"} sent to Office` : "Back online. Everything is up to date.");
      }, 750);
    } else {
      state.setOffline(true);
      toast.info("Offline demo is on. New submissions will wait to send.");
    }
  };

  return <>
    <header className="driver-header"><div className="driver-header-inner">
      <button className="brand-button" onClick={() => navigate("/")} aria-label="Driver Hub home"><Brand compact /></button>
      <div className="header-right">
        <LiveClock />
        <span className="header-divider" />
        <div className="truck-chip"><Truck size={17} /><span className="mono">{driver?.truckId || "--"}</span><span className="chip-slash">/</span><span className="mono">{driver?.trailerId || "--"}</span></div>
        <div className={`sync-indicator ${offline ? "offline" : ""} ${syncing ? "is-syncing" : ""}`} title={offline ? `${queued} waiting to send` : `Last synced ${timeAgo(state.lastSync)}`}>
          {offline ? <CloudOff size={16} /> : syncing ? <CloudUpload size={16} /> : <Wifi size={16} />}
          <span>{syncing ? "Syncing..." : offline ? queued ? `${queued} waiting to send` : "Offline mode" : "Synced"}</span>
        </div>
        <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="account-trigger" aria-label="Open account menu"><Avatar name={driver?.name || "Driver"} /><span className="account-name">{driver?.name || "Driver"}</span><ChevronDown size={15} /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="menu-content">
            <div className="menu-label">DRIVER SESSION</div>
            <DropdownMenu.Item className="menu-item" onSelect={() => setGuideOpen(true)}><BookOpen size={18} /> Demo guide</DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={() => { window.open("/office", "_blank", "noopener,noreferrer"); }}><ExternalLink size={18} /> Open Office view <span className="menu-shortcut">↗</span></DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={() => { state.setTheme(state.theme === "dark" ? "light" : "dark"); toast.info(state.theme === "dark" ? "Sunlight mode on" : "Night mode on"); }}>{state.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />} {state.theme === "dark" ? "Sunlight mode" : "Night mode"}</DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={toggleOffline}>{offline ? <Wifi size={18} /> : <CloudOff size={18} />} {offline ? "Go online & sync" : "Simulate offline"}</DropdownMenu.Item>
            <DropdownMenu.Separator className="menu-separator" />
            <DropdownMenu.Item className="menu-item" onSelect={() => setResetOpen(true)}><RotateCcw size={18} /> Reset demo data</DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={() => { state.logout(); navigate("/login"); toast.info("Signed out"); }}><LogOut size={18} /> Sign out</DropdownMenu.Item>
          </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <div className="mobile-header-status"><span className={`mobile-sync-dot ${offline ? "is-offline" : ""}`} /><span className="mono">{driver?.truckId || "--"}</span></div>
      <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="mobile-menu-trigger" aria-label="Open menu"><Menu size={22} /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="menu-content">
        <div className="menu-label">{driver?.name} · {driver?.truckId}</div>
        <DropdownMenu.Item className="menu-item" onSelect={() => setGuideOpen(true)}><BookOpen size={18} /> Demo guide</DropdownMenu.Item>
        <DropdownMenu.Item className="menu-item" onSelect={() => window.open("/office", "_blank", "noopener,noreferrer")}><ExternalLink size={18} /> Open Office view</DropdownMenu.Item>
        <DropdownMenu.Item className="menu-item" onSelect={() => state.setTheme(state.theme === "dark" ? "light" : "dark")}>{state.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />} Toggle light / dark</DropdownMenu.Item>
        <DropdownMenu.Item className="menu-item" onSelect={toggleOffline}>{offline ? <Wifi size={18} /> : <CloudOff size={18} />} {offline ? "Go online & sync" : "Simulate offline"}</DropdownMenu.Item>
        <DropdownMenu.Item className="menu-item" onSelect={() => setResetOpen(true)}><RotateCcw size={18} /> Reset demo data</DropdownMenu.Item>
        <DropdownMenu.Item className="menu-item" onSelect={() => { state.logout(); navigate("/login"); }}><LogOut size={18} /> Sign out</DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
    </div></header>
    {location.pathname === "/" && offline && <div className="offline-banner"><CloudOff size={17} /> Working offline. {queued ? `${queued} item${queued === 1 ? "" : "s"} will send when you reconnect.` : "Submissions will be queued until you reconnect."}</div>}
    <DemoGuide open={guideOpen} onOpenChange={setGuideOpen} />
    <Modal open={resetOpen} onOpenChange={setResetOpen} title="Reset the demo?" description="This replaces all sheets, inspections, scans, and office presets with the original sample data."><div className="modal-actions"><Button onClick={() => setResetOpen(false)}>Keep my data</Button><Button variant="danger" onClick={() => { state.resetDemo(); setResetOpen(false); navigate("/"); toast.success("Demo data restored"); }}>Reset everything</Button></div></Modal>
  </>;
}

function DriverLayout({ children }: { children: ReactNode }) {
  const activeDriverId = useHubStore((state) => state.activeDriverId);
  const location = useLocation();
  if (!activeDriverId) return <Navigate to="/login" replace />;
  return <div className="app-shell driver-shell"><DriverHeader /><AnimatePresence mode="wait"><motion.main key={location.pathname} className={`driver-main ${location.pathname === "/" ? "home-main" : ""} ${location.pathname === "/map" ? "map-main" : ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }}>
    {children}
  </motion.main></AnimatePresence><footer className="app-footer">Concept by Web Designs Lab.<span>Built for the road. Ready for the office.</span></footer></div>;
}

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<DriverLayout><Home /></DriverLayout>} />
    <Route path="/sheet" element={<DriverLayout><Sheet /></DriverLayout>} />
    <Route path="/inspection" element={<DriverLayout><InspectionPage /></DriverLayout>} />
    <Route path="/map" element={<DriverLayout><MapPage /></DriverLayout>} />
    <Route path="/scanner" element={<DriverLayout><Scanner /></DriverLayout>} />
    <Route path="/office" element={<Office />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

export default function App() {
  const theme = useHubStore((state) => state.theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => setupCrossTabSync(), []);
  useEffect(() => {
    const wentOffline = () => { useHubStore.getState().setOffline(true); toast.warning("Connection lost. New work will be queued."); };
    const wentOnline = () => { useHubStore.getState().setOffline(false); toast.success("Connection restored. Queued work synced."); };
    window.addEventListener("offline", wentOffline);
    window.addEventListener("online", wentOnline);
    return () => { window.removeEventListener("offline", wentOffline); window.removeEventListener("online", wentOnline); };
  }, []);
  return <BrowserRouter><AppRoutes /><Toaster richColors theme={theme} position="bottom-right" closeButton toastOptions={{ duration: 3500 }} /></BrowserRouter>;
}
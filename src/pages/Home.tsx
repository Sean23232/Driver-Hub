import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Camera, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, MapPinned, Navigation, ShieldAlert, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Modal } from "../components/ui";
import { duration, formatClock, formatTons, localDate, timeAgo, totalTons } from "../lib/helpers";
import { useHubStore } from "../store";

function tileUrl(lat: number, lng: number, z: number, dx: number, dy: number) {
  const x = Math.floor((lng + 180) / 360 * 2 ** z) + dx;
  const rad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * 2 ** z) + dy;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

function HomeTile({ number, icon: Icon, title, description, status, tone, detail, onClick, accent, map = false }: {
  number: string; icon: LucideIcon; title: string; description: string; status: string; tone: "amber" | "green" | "red" | "cyan" | "neutral"; detail: string; onClick: () => void; accent: "amber" | "cyan" | "green" | "red"; map?: boolean;
}) {
  return <motion.button type="button" className={`home-tile tile-${accent} ${map ? "map-tile" : ""}`} onClick={onClick} whileHover={{ y: -3, scale: 1.007 }} whileTap={{ scale: .985 }} transition={{ type: "spring", stiffness: 280, damping: 22 }}>
    {map && <div className="mini-map" aria-hidden="true"><div className="mini-map-grid">{[[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => <img key={`${dx}-${dy}`} src={tileUrl(33.8812, -84.4645, 14, dx, dy)} alt="" />)}</div><div className="mini-map-overlay" /><div className="mini-map-cross"><Navigation size={17} fill="currentColor" /></div><span className="mini-map-credit">Imagery © Esri</span></div>}
    <div className="tile-top"><div className="tile-icon"><Icon size={26} strokeWidth={1.9} /></div><span className="tile-number mono">{number} / 04</span></div>
    <div className="tile-body"><div className="tile-meta"><Badge tone={tone}>{status}</Badge></div><h2>{title}</h2><p>{description}</p></div>
    <div className="tile-bottom"><span>{detail}</span><span className="tile-arrow"><ArrowRight size={18} /></span></div>
  </motion.button>;
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useHubStore();
  const [guideOpen, setGuideOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!state.guideSeen) {
      const afterLogin = (location.state as { showGuide?: boolean } | null)?.showGuide;
      const timer = window.setTimeout(() => setGuideOpen(true), afterLogin ? 1100 : 2400);
      return () => window.clearTimeout(timer);
    }
  }, [location.state, state.guideSeen]);
  const driver = state.drivers.find((item) => item.id === state.activeDriverId);
  const name = driver?.name.split(" ")[0] || "Driver";
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = localDate();
  const submittedToday = state.sheets.filter((item) => item.driverId === state.activeDriverId && item.date === today);
  const draft = state.activeDriverId ? state.draftSheets[state.activeDriverId] : undefined;
  const liveLoads = [...submittedToday.flatMap((item) => item.loads), ...(draft?.status === "draft" ? draft.loads.filter((item) => item.tons || item.ticket) : [])];
  const inspection = state.inspections.find((item) => item.driverId === state.activeDriverId && item.date === today);
  const driverScansToday = state.scans.filter((item) => item.driverId === state.activeDriverId && item.createdAt.slice(0, 10) === today);
  const scansToday = driverScansToday.length;
  const queuedScans = driverScansToday.filter((item) => item.status === "queued").length;
  const sheetStatus = submittedToday.some((item) => item.status === "queued") ? "Queued to send" : submittedToday.length ? "Submitted" : draft?.loads.some((item) => item.tons || item.ticket) ? "In progress" : "Not started";
  const shiftStart = draft?.startTime || submittedToday[0]?.startTime || "";
  const tileDetail = liveLoads.length ? `${liveLoads.length} load${liveLoads.length === 1 ? "" : "s"} · ${formatTons(totalTons(liveLoads))} tons today` : "Ready when you are";
  return <div className="home-content">
    <div className="home-intro"><div className="home-welcome"><div className="eyebrow">YOUR WORKSPACE / TODAY</div><h1>{greeting}, <span>{name}.</span></h1><p>Everything you need for the road ahead.</p></div>
      <button type="button" className={`inspection-banner ${inspection ? inspection.status === "queued" ? "" : inspection.defects.length && inspection.status !== "resolved" ? "banner-red" : "banner-green" : ""}`} onClick={() => navigate("/inspection")}><span className="banner-symbol">{inspection ? inspection.status === "queued" ? <ClipboardCheck size={26} /> : inspection.defects.length && inspection.status !== "resolved" ? <ShieldAlert size={26} /> : <CheckCircle2 size={26} /> : <ClipboardCheck size={26} />}</span><span className="banner-copy"><strong>{inspection ? inspection.status === "queued" ? "Inspection waiting to send" : inspection.status === "resolved" ? "Inspection defect resolved" : inspection.defects.length ? "Defect flagged on inspection" : "Pre-trip inspection complete" : "Complete your pre-trip inspection"}</strong><small>{inspection ? inspection.status === "queued" ? "Saved safely offline. Sync when back online" : inspection.status === "resolved" ? "Office signed off. View report" : inspection.defects.length ? "Office has been alerted. View report" : `Completed at ${formatClock(inspection.time)} · View report` : "A clear start makes for a better day"}</small></span><ArrowRight size={20} className="banner-arrow" /></button>
    </div>
    <div className="home-grid">
      <HomeTile number="01" icon={ClipboardList} title="Daily Work Sheet" description="Log loads, tickets, hours and sign-off." status={sheetStatus} tone={sheetStatus === "Submitted" ? "green" : "amber"} detail={tileDetail} onClick={() => navigate("/sheet")} accent="amber" />
      <HomeTile number="02" icon={ClipboardCheck} title="DOT Inspection" description="Your pre-trip vehicle check, simplified." status={inspection ? inspection.status === "queued" ? "Queued to send" : inspection.status === "resolved" ? "Resolved by office" : inspection.defects.length ? "Defect flagged" : `Completed ${formatClock(inspection.time)}` : "Due today"} tone={inspection ? inspection.status === "queued" ? "amber" : inspection.defects.length && inspection.status !== "resolved" ? "red" : "green" : "amber"} detail={inspection ? inspection.status === "queued" ? "Waiting for connection" : inspection.status === "resolved" ? "Office sign-off complete" : inspection.defects.length ? `${inspection.defects.length} item${inspection.defects.length === 1 ? "" : "s"} need attention` : "Vehicle checked and ready" : "About 3 minutes to complete"} onClick={() => navigate("/inspection")} accent={inspection?.defects.length && inspection.status !== "resolved" && inspection.status !== "queued" ? "red" : "cyan"} />
      <HomeTile number="03" icon={MapPinned} title="Satellite Map" description="Job sites, drop-offs and live directions." status="Live map" tone="cyan" detail="Explore saved locations" onClick={() => navigate("/map")} accent="cyan" map />
      <HomeTile number="04" icon={Camera} title="Document Scanner" description="Capture tickets and receipts in seconds." status={queuedScans ? `${queuedScans} waiting to send` : scansToday ? `${scansToday} sent today` : "Ready to scan"} tone={queuedScans ? "amber" : scansToday ? "green" : "neutral"} detail={queuedScans ? "Saved offline, ready to sync" : scansToday ? `${scansToday} document${scansToday === 1 ? "" : "s"} to office` : "Camera or photo upload"} onClick={() => navigate("/scanner")} accent="amber" />
    </div>
    <div className="today-strip"><div className="today-label"><span className="today-pulse" /> <strong>Today</strong></div><div className="today-metric"><Clock3 size={17} /><span>Shift</span><strong className="mono">{shiftStart ? duration(shiftStart, "") : "Not started"}</strong></div><div className="today-metric"><Truck size={17} /><span>Loads</span><strong className="mono">{liveLoads.length}</strong></div><div className="today-metric"><span className="tons-symbol">t</span><span>Tons</span><strong className="mono">{formatTons(totalTons(liveLoads))}</strong></div><div className="today-metric sync-today"><CheckCircle2 size={17} /><span>Last sync</span><strong>{state.simulateOffline ? "Waiting" : timeAgo(state.lastSync)}</strong></div></div>
    <Modal open={guideOpen} onOpenChange={(open) => { setGuideOpen(open); if (!open) state.setGuideSeen(true); }} title="Your 3-minute demo" description="The driver-to-office handoff is the best part."><div className="guide-list">{["Do the inspection.", "Fill the daily sheet.", "Open the Office view in another tab and watch it arrive live."].map((text, index) => <div className="guide-step" key={text}><span>{index + 1}</span><strong>{text}</strong></div>)}</div><p className="guide-note">Find Office view in your avatar menu. Your changes stay in this browser; email delivery and offline mode are simulated.</p><button className="ui-button ui-button-primary w-full" onClick={() => { state.setGuideSeen(true); setGuideOpen(false); }}>Start exploring <ArrowRight size={18} /></button></Modal>
  </div>;
}
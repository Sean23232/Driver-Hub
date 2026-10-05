import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Activity as ActivityIcon, AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Camera, Check, CheckCircle2, ClipboardCheck, ClipboardList, Download, ExternalLink, FileCheck2, FileText, Filter, Inbox, LayoutDashboard, Mail, MapPin, Moon, Pencil, Plus, Search, Settings2, ShieldAlert, Sun, Trash2, Truck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DailySheet, Inspection, Preset, PresetKind, Scan } from "../types";
import { Avatar, Badge, Brand, Button, Drawer, EmptyState, Field, Input, Modal, PdfPreview, SectionHeading, Select } from "../components/ui";
import { SignaturePad } from "../components/SignaturePad";
import { csvEscape, dayOffset, displayName, downloadBlob, formatDate, formatTons, localDate, timeAgo, totalTons, uid } from "../lib/helpers";
import { inspectionPdf, scanPdf, sheetPdf } from "../lib/pdf";
import { useHubStore } from "../store";

type Section = "overview" | "inbox" | "inspections" | "presets" | "billing";
type RecordKind = "sheet" | "inspection" | "scan";
type SelectedRecord = { kind: RecordKind; id: string } | null;

const nav: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "inspections", label: "Inspections", icon: ClipboardCheck },
  { id: "presets", label: "Presets", icon: Settings2 },
  { id: "billing", label: "Billing Helper", icon: BarChart3 },
];

const presetCategories: { kind: PresetKind; label: string; singular: string; icon: LucideIcon }[] = [
  { kind: "customers", label: "Customers", singular: "Customer", icon: Users },
  { kind: "jobSites", label: "Job Sites", singular: "Job Site", icon: MapPin },
  { kind: "deliveries", label: "Delivery Locations", singular: "Delivery Location", icon: MapPin },
  { kind: "pickups", label: "Pickup Locations", singular: "Pickup Location", icon: MapPin },
  { kind: "trucks", label: "Trucks", singular: "Truck", icon: Truck },
  { kind: "trailers", label: "Trailers", singular: "Trailer", icon: Truck },
  { kind: "drivers", label: "Drivers", singular: "Driver", icon: Users },
];

function Metric({ label, value, detail, icon: Icon, tone = "amber" }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: "amber" | "cyan" | "green" | "red" }) {
  return <div className={`office-metric metric-${tone}`}><div className="metric-top"><span>{label}</span><Icon size={19} /></div><strong className="heading-font">{value}</strong><small>{detail}</small></div>;
}

function Overview({ onOpen, onSection }: { onOpen: (record: SelectedRecord) => void; onSection: (section: Section) => void }) {
  const state = useHubStore();
  const today = localDate();
  const visibleSheets = state.sheets.filter((item) => item.status !== "queued");
  const todaySheets = visibleSheets.filter((item) => item.date === today);
  const todayInspections = state.inspections.filter((item) => item.status !== "queued" && item.date === today);
  const todayScans = state.scans.filter((item) => item.status !== "queued" && item.createdAt.slice(0, 10) === today);
  const defects = state.inspections.filter((item) => item.status !== "queued" && item.defects.length && item.status !== "resolved");
  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = dayOffset(index - 6);
    return { date, label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }), tons: Number(visibleSheets.filter((item) => item.date === date).reduce((sum, item) => sum + totalTons(item.loads), 0).toFixed(1)) };
  });
  const activity = state.activity.filter((item) => {
    if (item.kind === "system") return true;
    if (item.kind === "sheet") return !state.sheets.some((sheet) => sheet.status === "queued" && item.detail.includes(sheet.invoice));
    return true;
  }).slice(0, 7);
  return <><SectionHeading eyebrow="OFFICE / LIVE OVERVIEW" title="Operations at a glance." description={`Here's what's moving on ${formatDate(today, { weekday: "long", month: "long", day: "numeric" })}.`} action={<Badge tone="green"><span className="live-dot" /> LIVE UPDATES</Badge>} />
    <div className="metrics-grid"><Metric label="Sheets today" value={String(todaySheets.length).padStart(2, "0")} detail="submitted to office" icon={ClipboardList} /><Metric label="Loads" value={String(todaySheets.reduce((sum, item) => sum + item.loads.length, 0)).padStart(2, "0")} detail="completed today" icon={Truck} tone="cyan" /><Metric label="Total tons" value={formatTons(todaySheets.reduce((sum, item) => sum + totalTons(item.loads), 0))} detail="hauled today" icon={BarChart3} tone="amber" /><Metric label="Inspections" value={String(todayInspections.length).padStart(2, "0")} detail="completed today" icon={ClipboardCheck} tone="green" /><Metric label="Open defects" value={String(defects.length).padStart(2, "0")} detail={defects.length ? "needs review" : "fleet is clear"} icon={ShieldAlert} tone={defects.length ? "red" : "green"} /><Metric label="Scans received" value={String(todayScans.length).padStart(2, "0")} detail="documents today" icon={Camera} tone="cyan" /></div>
    <div className="overview-lower"><div className="office-panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">PRODUCTIVITY</span><h2>Tons hauled</h2></div><span>LAST 7 DAYS</span></div><p className="sr-only">Tons by day: {chartData.map((item) => `${formatDate(item.date)}: ${item.tons} tons`).join("; ")}</p><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 6, bottom: 0, left: -23 }}><defs><linearGradient id="tonsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5a524" stopOpacity={.34} /><stop offset="100%" stopColor="#f5a524" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(143,161,189,.12)" strokeDasharray="4 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8395aa", fontSize: 10 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#8395aa", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#132138", border: "1px solid rgba(161,183,215,.25)", borderRadius: 11, fontSize: 12, color: "#f3f6fc" }} formatter={(value) => [`${value} tons`, "Hauled"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatDate(payload[0].payload.date) : ""} /><Area type="monotone" dataKey="tons" stroke="#f5a524" strokeWidth={2.5} fill="url(#tonsGradient)" activeDot={{ r: 6, fill: "#f5a524", stroke: "#1d2737", strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div></div>
      <div className="office-panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">AS IT HAPPENS</span><h2>Live activity</h2></div><ActivityIcon size={20} className="text-cyan" /></div><div className="activity-list"><AnimatePresence initial={false}>{activity.map((item) => <motion.div key={item.id} layout initial={{ opacity: 0, y: -13, backgroundColor: "rgba(245,165,36,.16)" }} animate={{ opacity: 1, y: 0, backgroundColor: "transparent" }} exit={{ opacity: 0 }} transition={{ duration: .45 }} className="activity-row"><span className={`activity-symbol activity-${item.kind}`}>{item.kind === "sheet" ? <ClipboardList size={17} /> : item.kind === "inspection" ? <ClipboardCheck size={17} /> : <Camera size={17} />}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><time>{timeAgo(item.time)}</time></motion.div>)}</AnimatePresence></div><button className="panel-link" onClick={() => onSection("inbox")}>View all incoming work <ArrowRight size={17} /></button></div></div>
    {defects.length ? <div className="priority-panel"><div className="priority-icon"><AlertTriangle size={24} /></div><div><span className="eyebrow">PRIORITY / NEEDS ATTENTION</span><h3>{defects.length} open vehicle defect{defects.length === 1 ? "" : "s"}</h3><p>{defects[0].truck} · {displayName(defects[0].driverId, state.drivers)} · {defects[0].defects[0]?.description}</p></div><Button variant="danger" onClick={() => onOpen({ kind: "inspection", id: defects[0].id })}>Review defect <ArrowRight size={17} /></Button></div> : <div className="all-clear-panel"><CheckCircle2 size={21} /><span>No open defects. Your fleet is clear.</span></div>}
  </>;
}

function InboxView({ onOpen, initialTab }: { onOpen: (record: SelectedRecord) => void; initialTab: RecordKind }) {
  const state = useHubStore();
  const [tab, setTab] = useState<RecordKind>(initialTab);
  const [search, setSearch] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const records: (DailySheet | Inspection | Scan)[] = tab === "sheet" ? state.sheets.filter((item) => item.status !== "queued") : tab === "inspection" ? state.inspections.filter((item) => item.status !== "queued") : state.scans.filter((item) => item.status !== "queued");
  const filtered = records.filter((record) => {
    const driver = displayName(record.driverId, state.drivers).toLowerCase();
    const customer = "customerId" in record ? displayName(record.customerId, state.customers) : "";
    const info = "invoice" in record ? `${record.invoice} ${record.truck} ${record.loads.map((load) => load.ticket).join(" ")}` : "odometer" in record ? `${record.truck} ${record.defects.map((defect) => defect.description).join(" ")}` : `${record.type} ${record.note}`;
    const date = "createdAt" in record ? record.createdAt.slice(0, 10) : record.date;
    return (!search || `${driver} ${customer} ${info}`.toLowerCase().includes(search.toLowerCase())) && (!driverFilter || record.driverId === driverFilter) && (!customerFilter || ("customerId" in record && record.customerId === customerFilter)) && (!dateFilter || date === dateFilter) && (!statusFilter || record.status === statusFilter);
  }).sort((a, b) => ("createdAt" in b ? b.createdAt : b.submittedAt || b.date).localeCompare("createdAt" in a ? a.createdAt : a.submittedAt || a.date));
  const statusLabel = (record: DailySheet | Inspection | Scan) => record.status === "submitted" || record.status === "sent" ? "New" : record.status === "resolved" ? "Resolved" : "Reviewed";

  return <><SectionHeading eyebrow="OFFICE / INBOX" title="Incoming work." description="Every report, ticket and scan in one searchable place." action={<Badge tone="cyan">{records.length} {tab === "sheet" ? "sheets" : tab === "inspection" ? "reports" : "scans"}</Badge>} />
    <div className="inbox-panel office-panel"><div className="inbox-tabs">{(["sheet", "inspection", "scan"] as const).map((kind) => <button key={kind} className={tab === kind ? "active" : ""} onClick={() => { setTab(kind); setStatusFilter(""); setCustomerFilter(""); }}>{kind === "sheet" ? "Daily Sheets" : kind === "inspection" ? "Inspections" : "Scans"}<span>{kind === "sheet" ? state.sheets.filter((item) => item.status !== "queued").length : kind === "inspection" ? state.inspections.filter((item) => item.status !== "queued").length : state.scans.filter((item) => item.status !== "queued").length}</span></button>)}</div>
      <div className="inbox-filters"><div className="inbox-search"><Search size={18} /><input aria-label="Search inbox" placeholder="Search driver, customer, invoice or ticket..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter driver" value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}><option value="">All drivers</option>{state.drivers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>{tab === "sheet" && <Select aria-label="Filter customer" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="">All customers</option>{state.customers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>}<Input aria-label="Filter date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /><Select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{(tab === "scan" ? ["sent", "reviewed"] : tab === "inspection" ? ["submitted", "reviewed", "resolved"] : ["submitted", "reviewed"]).map((item) => <option value={item} key={item}>{item === "submitted" || item === "sent" ? "New" : item === "resolved" ? "Resolved" : "Reviewed"}</option>)}</Select></div>
      <div className="table-caption"><Filter size={14} /> {filtered.length} result{filtered.length === 1 ? "" : "s"}{dateFilter || search || driverFilter || statusFilter || customerFilter ? <button onClick={() => { setSearch(""); setDriverFilter(""); setCustomerFilter(""); setDateFilter(""); setStatusFilter(""); }}>Clear filters</button> : null}</div>
      {filtered.length ? <div className="inbox-table"><div className="inbox-table-head"><span>{tab === "sheet" ? "INVOICE / CUSTOMER" : tab === "inspection" ? "VEHICLE / CONDITION" : "DOCUMENT"}</span><span>DRIVER</span><span>{tab === "sheet" ? "LOADS / TONS" : tab === "inspection" ? "ODOMETER" : "PAGES"}</span><span>DATE</span><span>STATUS</span><span /></div>{filtered.map((record) => <button className="inbox-row" key={record.id} onClick={() => onOpen({ kind: tab, id: record.id })}><span className="inbox-primary"><span className={`inbox-icon ${"defects" in record && record.defects.length ? "alert" : ""}`}>{tab === "sheet" ? <FileText size={20} /> : tab === "inspection" ? <ClipboardCheck size={20} /> : <Camera size={20} />}</span><span><strong>{"invoice" in record ? record.invoice : "odometer" in record ? record.truck : record.type}</strong><small>{"customerId" in record ? `${displayName(record.customerId, state.customers)} · ${record.truck}` : "odometer" in record ? record.defects.length ? `${record.defects.length} defect(s) reported` : "All clear" : record.note || "Document scan"}</small></span></span><span className="inbox-driver"><Avatar name={displayName(record.driverId, state.drivers)} />{displayName(record.driverId, state.drivers)}</span><span className="inbox-number mono">{"loads" in record ? `${record.loads.length} / ${formatTons(totalTons(record.loads))} t` : "odometer" in record ? `${Number(record.odometer).toLocaleString()} mi` : `${record.pages.length} page${record.pages.length === 1 ? "" : "s"}`}</span><span className="inbox-date">{formatDate("createdAt" in record ? record.createdAt.slice(0, 10) : record.date)}</span><span><Badge tone={"defects" in record && record.defects.length && record.status !== "resolved" ? "red" : record.status === "reviewed" || record.status === "resolved" ? "green" : "cyan"}>{"defects" in record && record.defects.length && record.status !== "resolved" ? "Defect" : statusLabel(record)}</Badge></span><ArrowRight size={17} className="inbox-arrow" /></button>)}</div> : <EmptyState icon={Inbox} title="No matching records" description="Try clearing filters or choose another inbox tab." action={<Button onClick={() => { setSearch(""); setDriverFilter(""); setCustomerFilter(""); setDateFilter(""); setStatusFilter(""); }}>Clear filters</Button>} />}
    </div>
  </>;
}

function InspectionsView({ onOpen }: { onOpen: (record: SelectedRecord) => void }) {
  const state = useHubStore();
  const reports = state.inspections.filter((item) => item.status !== "queued").sort((a, b) => (b.submittedAt || b.date).localeCompare(a.submittedAt || a.date));
  const open = reports.filter((item) => item.defects.length && item.status !== "resolved");
  return <><SectionHeading eyebrow="OFFICE / FLEET SAFETY" title="Vehicle inspections." description="Defects first. Every report a tap away." action={<Badge tone={open.length ? "red" : "green"}>{open.length} OPEN DEFECT{open.length === 1 ? "" : "S"}</Badge>} />
    {open.length ? <div className="defect-priority-list">{open.map((report) => <button key={report.id} className="office-defect-row" onClick={() => onOpen({ kind: "inspection", id: report.id })}><span className="priority-icon"><AlertTriangle size={22} /></span><span><strong>{report.truck} · {report.defects[0]?.item.replace(/^(Truck|Trailer): /, "")}</strong><small>{report.defects[0]?.description} · {displayName(report.driverId, state.drivers)} · {formatDate(report.date)}</small></span><Badge tone="red">ACTION NEEDED</Badge><ArrowRight size={18} /></button>)}</div> : <div className="all-clear-panel"><CheckCircle2 size={22} /> All reported defects have been resolved.</div>}
    <div className="office-panel"><div className="panel-heading"><div><span className="eyebrow">REPORT ARCHIVE</span><h2>All inspections</h2></div><span>{reports.length} REPORTS</span></div><div className="inspection-office-list">{reports.map((item) => <button key={item.id} onClick={() => onOpen({ kind: "inspection", id: item.id })}><span className={`office-inspection-mark ${item.defects.length && item.status !== "resolved" ? "red" : ""}`}>{item.defects.length && item.status !== "resolved" ? <AlertTriangle size={19} /> : <Check size={19} />}</span><span><strong>{item.truck} <small> / {item.trailer}</small></strong><small>{displayName(item.driverId, state.drivers)} · {formatDate(item.date)} at {item.time}</small></span><Badge tone={item.status === "resolved" ? "green" : item.defects.length ? "red" : "green"}>{item.status === "resolved" ? "Resolved" : item.defects.length ? "Defect flagged" : "Satisfactory"}</Badge><ArrowRight size={18} /></button>)}</div></div>
  </>;
}

function RecordDetail({ selected, onClose }: { selected: SelectedRecord; onClose: () => void }) {
  const state = useHubStore();
  const sheet = selected?.kind === "sheet" ? state.sheets.find((item) => item.id === selected.id) : undefined;
  const inspection = selected?.kind === "inspection" ? state.inspections.find((item) => item.id === selected.id) : undefined;
  const scan = selected?.kind === "scan" ? state.scans.find((item) => item.id === selected.id) : undefined;
  const [mechanic, setMechanic] = useState("");
  const [mechanicSignature, setMechanicSignature] = useState("");
  const [disposition, setDisposition] = useState<"corrected" | "not-required">("corrected");
  useEffect(() => { setMechanic(inspection?.mechanicName || ""); setMechanicSignature(inspection?.mechanicSignature || ""); setDisposition(inspection?.resolution || "corrected"); }, [selected?.id, inspection?.mechanicName, inspection?.mechanicSignature, inspection?.resolution]);
  const record = sheet || inspection || scan;
  const markReviewed = () => {
    if (!selected) return;
    state.markReviewed(selected.kind, selected.id);
    toast.success("Marked as reviewed");
  };
  const resolve = () => {
    if (!inspection || !mechanic.trim()) { toast.error("Enter the mechanic's name before signing off."); return; }
    if (!mechanicSignature) { toast.error("Add the mechanic's signature or use the typed option."); return; }
    state.resolveInspection(inspection.id, mechanic.trim(), mechanicSignature, disposition);
    toast.success("Defect resolved. Vehicle status updated.");
  };
  const resend = () => {
    if (!sheet?.customerEmail) { toast.error("This sheet has no customer email. Add one to the customer preset first."); return; }
    state.addActivity({ kind: "sheet", title: "Customer copy resent (demo)", detail: `${sheet.invoice} · ${sheet.customerEmail}` });
    toast.success(`Signed copy simulated to ${sheet.customerEmail}`);
  };
  return <Drawer open={!!record} onOpenChange={(open) => { if (!open) onClose(); }} title={sheet ? "Daily sheet detail" : inspection ? "Inspection detail" : "Document detail"}>{record && <div className="record-detail">
    <div className="record-detail-head"><div><div className="eyebrow">{sheet ? "DAILY WORK SHEET" : inspection ? "DVIR REPORT" : "DOCUMENT SCAN"}</div><h2>{sheet ? sheet.invoice : inspection ? inspection.truck : scan?.type}</h2><p>{displayName(record.driverId, state.drivers)} · {formatDate(scan ? scan.createdAt.slice(0, 10) : sheet ? sheet.date : inspection!.date)}</p></div><Badge tone={inspection?.defects.length && inspection.status !== "resolved" ? "red" : record.status === "reviewed" || record.status === "resolved" ? "green" : "cyan"}>{inspection?.defects.length && inspection.status !== "resolved" ? "Defect flagged" : record.status === "sent" || record.status === "submitted" ? "New" : record.status === "resolved" ? "Resolved" : "Reviewed"}</Badge></div>
    {sheet && <><div className="detail-facts"><div><span>CUSTOMER</span><strong>{displayName(sheet.customerId, state.customers)}</strong></div><div><span>TRUCK / TRAILER</span><strong className="mono">{sheet.truck} / {sheet.trailer}</strong></div><div><span>LOADS</span><strong>{sheet.loads.length}</strong></div><div><span>TOTAL TONS</span><strong>{formatTons(totalTons(sheet.loads))}</strong></div></div><div className="detail-loads"><strong>HAUL TICKETS</strong>{sheet.loads.map((load, index) => <div key={load.id}><span>Load {index + 1} · {load.material === "Other" ? load.otherMaterial : load.material}</span><span className="mono">#{load.ticket} · {load.tons} t</span></div>)}</div>{sheet.notes && <p className="detail-note"><strong>Driver notes:</strong> {sheet.notes}</p>}<PdfPreview key={sheet.id} createPdf={() => sheetPdf(sheet, state)} filename={`${sheet.invoice}-daily-sheet.pdf`} minHeight={495} /><div className="detail-actions">{sheet.status !== "reviewed" && <Button variant="success" icon={Check} onClick={markReviewed}>Mark Reviewed</Button>}<Button icon={Mail} onClick={resend}>Resend to customer</Button></div><p className="drawer-disclaimer">Email sending is simulated in this local concept. No message leaves your browser.</p></>}
    {inspection && <><div className="detail-facts"><div><span>DRIVER</span><strong>{displayName(inspection.driverId, state.drivers)}</strong></div><div><span>ODOMETER</span><strong className="mono">{Number(inspection.odometer).toLocaleString()} mi</strong></div><div><span>TRAILER</span><strong className="mono">{inspection.trailer}</strong></div><div><span>CONDITION</span><strong className={inspection.defects.length ? "text-red" : "text-green"}>{inspection.defects.length ? "Defects reported" : "Satisfactory"}</strong></div></div>{inspection.defects.map((defect) => <div className="drawer-defect" key={defect.item}><AlertTriangle size={19} /><div><strong>{defect.item}</strong><p>{defect.description}</p>{defect.photo && <img className="detail-defect-photo" src={defect.photo} alt={`Evidence of ${defect.item}`} />}</div></div>)}{inspection.remarks && <p className="detail-note"><strong>Driver remarks:</strong> {inspection.remarks}</p>}
      {inspection.defects.length > 0 && inspection.status !== "resolved" && <div className="mechanic-panel"><div className="eyebrow">MECHANIC / OFFICE SIGN-OFF</div><h3>Resolve this defect</h3><Field label="Mechanic's printed name" required><Input value={mechanic} placeholder="e.g. T. Williams" onChange={(event) => setMechanic(event.target.value)} /></Field><span className="field-label">Disposition</span><div className="resolution-options"><button className={disposition === "corrected" ? "selected" : ""} onClick={() => setDisposition("corrected")}><CheckCircle2 size={19} /> Above defects corrected</button><button className={disposition === "not-required" ? "selected" : ""} onClick={() => setDisposition("not-required")}><ShieldAlert size={19} /> Above defects need not be corrected for safe operation</button></div><SignaturePad label="Mechanic's signature" value={mechanicSignature} onChange={setMechanicSignature} /><button className="typed-signature-link" onClick={() => { if (!mechanic.trim()) { toast.error("Enter the mechanic's name first."); return; } const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 150; const context = canvas.getContext("2d"); if (context) { context.fillStyle = "#162947"; context.font = "italic 50px Georgia"; context.fillText(mechanic, 16, 94); setMechanicSignature(canvas.toDataURL("image/png")); toast.success("Typed signature applied"); } }}>Use typed mechanic signature</button><Button variant="success" className="w-full" icon={CheckCircle2} onClick={resolve}>Sign off & resolve</Button></div>}
      {inspection.status === "resolved" && <div className="resolved-note"><CheckCircle2 size={21} /><span>Resolved by {inspection.mechanicName} · {inspection.resolution === "corrected" ? "Defects corrected" : "Safe to operate without correction"}</span></div>}
      <PdfPreview key={`${inspection.id}-${inspection.status}`} createPdf={() => inspectionPdf(inspection, state)} filename={`${inspection.truck}-DVIR-${inspection.date}.pdf`} minHeight={495} />{inspection.status === "submitted" && !inspection.defects.length && <Button variant="success" icon={Check} onClick={markReviewed}>Mark Reviewed</Button>}
    </>}
    {scan && <><div className="detail-facts"><div><span>TYPE</span><strong>{scan.type}</strong></div><div><span>PAGES</span><strong>{scan.pages.length}</strong></div><div><span>LINKED LOAD</span><strong>{scan.loadId ? `Load ${state.draftSheets[scan.driverId]?.loads.findIndex((item) => item.id === scan.loadId) + 1 || "--"}` : "None"}</strong></div><div><span>RECEIVED</span><strong>{new Date(scan.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</strong></div></div>{scan.note && <p className="detail-note">{scan.note}</p>}{scan.pages.length > 0 && <div className="detail-scan-thumbs">{scan.pages.map((page, index) => <img key={index} src={page} alt={`Scanned page ${index + 1}`} />)}</div>}<PdfPreview key={scan.id} createPdf={() => scanPdf(scan, state)} filename={`${scan.type.toLowerCase().replace(/\s/g, "-")}-${scan.id.slice(-6)}.pdf`} minHeight={495} />{scan.status !== "reviewed" && <Button variant="success" icon={Check} onClick={markReviewed}>Mark Reviewed</Button>}</>}
  </div>}</Drawer>;
}

function PresetsView() {
  const state = useHubStore();
  const [kind, setKind] = useState<PresetKind>("customers");
  const [editing, setEditing] = useState<Preset | null>(null);
  const [form, setForm] = useState<Preset>({ id: "", name: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<Preset | null>(null);
  const [error, setError] = useState("");
  const category = presetCategories.find((item) => item.kind === kind)!;
  const items = state[kind];
  const openForm = (item?: Preset) => { setEditing(item || null); setForm(item ? { ...item } : { id: "", name: "", email: "", address: "", lat: undefined, lng: undefined, pin: "", truckId: state.trucks[0]?.id, trailerId: state.trailers[0]?.id }); setError(""); setModalOpen(true); };
  const save = () => {
    const name = kind === "trucks" || kind === "trailers" ? form.name.trim().toUpperCase().replace(/\s+/g, "") : form.name.trim();
    if (!name) { setError("Enter a name or number."); return; }
    if (items.some((item) => item.id !== editing?.id && item.name.toLowerCase() === name.toLowerCase())) { setError("That name already exists in this list."); return; }
    if (kind === "customers" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || "")) { setError("Enter a valid customer email address."); return; }
    if (kind === "drivers" && !/^\d{4}$/.test(form.pin || "")) { setError("Driver PIN must be exactly 4 digits."); return; }
    if (kind === "drivers" && state.drivers.some((item) => item.id !== editing?.id && item.pin === form.pin)) { setError("That PIN belongs to another driver."); return; }
    if (["jobSites", "pickups", "deliveries"].includes(kind) && ((form.lat == null) !== (form.lng == null) || (form.lat != null && (form.lat < -90 || form.lat > 90 || form.lng! < -180 || form.lng! > 180)))) { setError("Enter both valid latitude and longitude, or leave both blank."); return; }
    const id = kind === "trucks" || kind === "trailers" ? name.toUpperCase().replace(/\s/g, "") : editing?.id || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${uid().slice(0, 4)}`;
    state.savePreset(kind, { ...form, id, name }, editing?.id);
    setModalOpen(false);
    toast.success(`${category.singular} ${editing ? "updated" : "added"}. Driver choices are live.`);
  };
  const remove = () => {
    if (!deleting) return;
    if (kind === "drivers" && deleting.id === state.activeDriverId) { toast.error("Sign out this driver before removing their account."); setDeleting(null); return; }
    state.deletePreset(kind, deleting.id);
    toast.success(`${deleting.name} removed from ${category.label.toLowerCase()}`);
    setDeleting(null);
  };
  return <><SectionHeading eyebrow="OFFICE / PLUG & PLAY" title="Driver presets." description="Edit it here. Drivers see the change instantly in their forms." action={<Button variant="primary" icon={Plus} onClick={() => openForm()}>Add {category.singular}</Button>} />
    <div className="presets-layout"><aside className="preset-nav office-panel"><div className="eyebrow">MANAGE LISTS</div>{presetCategories.map((item) => { const Icon = item.icon; return <button key={item.kind} className={kind === item.kind ? "active" : ""} onClick={() => setKind(item.kind)}><Icon size={18} /><span>{item.label}</span><small>{state[item.kind].length}</small></button>; })}</aside>
      <div className="preset-main office-panel"><div className="panel-heading"><div><span className="eyebrow">OFFICE-MANAGED DATA</span><h2>{category.label}</h2><p>Changes update every driver's selections in real time.</p></div><Badge tone="cyan">{items.length} SAVED</Badge></div>{items.length ? <div className="preset-list">{items.map((item) => <div className="preset-row" key={item.id}><span className="preset-row-icon"><category.icon size={19} /></span><div className="preset-row-main"><strong className={kind === "trucks" || kind === "trailers" ? "mono" : ""}>{item.name}</strong><small>{kind === "customers" ? item.email : kind === "drivers" ? `PIN •••• · ${item.truckId || "No truck"} / ${item.trailerId || "No trailer"}` : item.address || (kind === "trucks" || kind === "trailers" ? "Fleet equipment" : "No address added")}</small></div><Button icon={Pencil} variant="ghost" size="icon" aria-label={`Edit ${item.name}`} onClick={() => openForm(item)} /><Button icon={Trash2} variant="ghost" size="icon" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)} /></div>)}</div> : <EmptyState icon={Settings2} title={`No ${category.label.toLowerCase()} yet`} description="Add one to make it available to drivers immediately." action={<Button variant="primary" icon={Plus} onClick={() => openForm()}>Add {category.singular}</Button>} />}</div></div>
    <Modal open={modalOpen} onOpenChange={setModalOpen} title={`${editing ? "Edit" : "Add"} ${category.singular.toLowerCase()}`} description="Saved changes appear in the driver app immediately."><div className="preset-form"><Field label={kind === "trucks" ? "Truck number" : kind === "trailers" ? "Trailer number" : "Name"} required><Input value={form.name} placeholder={kind === "trucks" ? "SE1504" : kind === "trailers" ? "SE1904" : `Enter ${category.singular.toLowerCase()} name`} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      {kind === "customers" && <Field label="Customer email" required><Input type="email" value={form.email || ""} placeholder="dispatch@company.example" onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>}
      {["jobSites", "pickups", "deliveries"].includes(kind) && <><Field label="Address"><Input value={form.address || ""} placeholder="Street address, city, state" onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field><div className="preset-coordinates"><Field label="Latitude (optional)"><Input type="number" step="any" value={form.lat ?? ""} placeholder="33.8812" onChange={(event) => setForm({ ...form, lat: event.target.value ? Number(event.target.value) : undefined })} /></Field><Field label="Longitude (optional)"><Input type="number" step="any" value={form.lng ?? ""} placeholder="-84.4645" onChange={(event) => setForm({ ...form, lng: event.target.value ? Number(event.target.value) : undefined })} /></Field></div><p className="form-hint">Coordinates put this stop on the Satellite Map. Optional for sheet presets.</p></>}
      {kind === "drivers" && <><Field label="4-digit PIN" required><Input type="text" inputMode="numeric" maxLength={4} value={form.pin || ""} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, "") })} /></Field><div className="preset-coordinates"><Field label="Default truck"><Select value={form.truckId || ""} onChange={(event) => setForm({ ...form, truckId: event.target.value })}><option value="">Choose truck</option>{state.trucks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Default trailer"><Select value={form.trailerId || ""} onChange={(event) => setForm({ ...form, trailerId: event.target.value })}><option value="">Choose trailer</option>{state.trailers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field></div></>}
      {error && <p className="inline-error" role="alert">{error}</p>}<div className="modal-actions"><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" icon={Check} onClick={save}>Save {category.singular}</Button></div></div></Modal>
    <Modal open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }} title={`Remove ${deleting?.name || "item"}?`} description="Existing reports remain intact. This removes the preset from future driver selections."><div className="modal-actions"><Button onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" icon={Trash2} onClick={remove}>Remove preset</Button></div></Modal>
  </>;
}

function BillingView({ onOpen }: { onOpen: (record: SelectedRecord) => void }) {
  const state = useHubStore();
  const [start, setStart] = useState(dayOffset(-7));
  const [end, setEnd] = useState(localDate());
  const [customerId, setCustomerId] = useState("");
  const sheets = state.sheets.filter((sheet) => sheet.status !== "queued" && sheet.date >= start && sheet.date <= end && (!customerId || sheet.customerId === customerId)).sort((a, b) => b.date.localeCompare(a.date));
  const groups = useMemo(() => {
    const map = new Map<string, DailySheet[]>();
    sheets.forEach((sheet) => map.set(sheet.customerId, [...(map.get(sheet.customerId) || []), sheet]));
    return [...map.entries()];
  }, [sheets]);
  const exportCsv = () => {
    if (!sheets.length) { toast.error("No sheets in this date range to export."); return; }
    const headings = ["Invoice #", "Date", "Customer", "Loads", "Tons", "Tickets"];
    const rows = sheets.map((sheet) => [sheet.invoice, sheet.date, displayName(sheet.customerId, state.customers), sheet.loads.length, totalTons(sheet.loads).toFixed(2), sheet.loads.map((load) => load.ticket).join("; ")]);
    const csv = [headings, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `samples-billing-${start}-to-${end}.csv`);
    toast.success(`${sheets.length} sheet${sheets.length === 1 ? "" : "s"} exported to CSV`);
  };
  return <><SectionHeading eyebrow="OFFICE / BILLING HELPER" title="Ready to invoice." description="Group completed hauls by customer, then export a clean billing CSV." action={<Button variant="primary" icon={Download} onClick={exportCsv} disabled={!sheets.length}>Export CSV</Button>} />
    <div className="billing-filters office-panel"><Field label="From"><Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></Field><Field label="To"><Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></Field><Field label="Customer"><Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">All customers</option>{state.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><div className="billing-total"><span>TOTAL IN RANGE</span><strong className="heading-font">{formatTons(sheets.reduce((sum, sheet) => sum + totalTons(sheet.loads), 0))} <small>tons</small></strong></div></div>
    {start > end ? <EmptyState icon={CalendarDays} title="Check your date range" description="The end date needs to be on or after the start date." /> : groups.length ? <div className="billing-groups">{groups.map(([id, customerSheets]) => <div className="billing-group office-panel" key={id}><div className="billing-group-head"><div><span className="eyebrow">CUSTOMER ACCOUNT</span><h2>{displayName(id, state.customers)}</h2><small>{customerSheets.length} sheet{customerSheets.length === 1 ? "" : "s"} · {customerSheets.reduce((sum, sheet) => sum + sheet.loads.length, 0)} loads</small></div><strong className="heading-font">{formatTons(customerSheets.reduce((sum, sheet) => sum + totalTons(sheet.loads), 0))} <small>tons</small></strong></div>{customerSheets.map((sheet) => <button className="billing-sheet-row" key={sheet.id} onClick={() => onOpen({ kind: "sheet", id: sheet.id })}><span className="mono">{sheet.invoice}</span><span>{formatDate(sheet.date)}</span><span>{sheet.loads.length} loads</span><strong>{formatTons(totalTons(sheet.loads))} tons</strong><ArrowRight size={17} /></button>)}</div>)}</div> : <EmptyState icon={FileCheck2} title="No sheets in this range" description="Adjust the dates or customer to find completed work." />}
  </>;
}

export default function Office() {
  const navigate = useNavigate();
  const state = useHubStore();
  const [section, setSection] = useState<Section>("overview");
  const [selected, setSelected] = useState<SelectedRecord>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const openDefects = state.inspections.filter((item) => item.status !== "queued" && item.defects.length && item.status !== "resolved").length;
  const newInbox = state.sheets.filter((item) => item.status === "submitted").length + state.inspections.filter((item) => item.status === "submitted").length + state.scans.filter((item) => item.status === "sent").length;
  const changeSection = (next: Section) => { setSection(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <div className="app-shell office-shell">{mobileNav && <button className="office-nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Close office navigation" />}<aside className={`office-sidebar ${mobileNav ? "open" : ""}`}><div className="office-sidebar-brand"><Brand compact /><span>OFFICE COMMAND</span></div><div className="sidebar-label">WORKSPACE</div><nav aria-label="Office sections" className="office-nav">{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => changeSection(item.id)} aria-current={section === item.id ? "page" : undefined}><Icon size={19} /><span>{item.label}</span>{item.id === "inbox" && newInbox > 0 && <small>{newInbox}</small>}{item.id === "inspections" && openDefects > 0 && <small className="alert-count">{openDefects}</small>}</button>; })}</nav><div className="sidebar-spacer" /><div className="sidebar-live"><span className="live-dot" /><strong>Live connection</strong><small>Driver updates land here instantly</small></div><button className="sidebar-driver" onClick={() => navigate("/")}><Avatar name="Marlin Samples" /><span><strong>Marlin Samples</strong><small>Open Driver Hub <ArrowUpRight size={12} /></small></span></button><div className="sidebar-footer">Concept by Web Designs Lab.</div></aside>
    <div className="office-main"><header className="office-header"><div className="office-header-left"><button className="office-mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle office navigation"><Settings2 size={21} /></button><span className="office-header-path">SAMPLES ENTERPRISE LLC <span>/</span> {nav.find((item) => item.id === section)?.label.toUpperCase()}</span></div><div className="office-header-actions"><span className="office-live"><span className="live-dot" /> {state.simulateOffline ? "DRIVER OFFLINE" : "LIVE SYNC"}</span><Button variant="ghost" size="icon" aria-label={state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => state.setTheme(state.theme === "dark" ? "light" : "dark")}>{state.theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</Button><Button size="compact" icon={ExternalLink} onClick={() => window.open("/", "_blank", "noopener,noreferrer")}>Open Driver view</Button></div></header>
      <main className="office-content"><AnimatePresence mode="wait"><motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .24 }}>
        {section === "overview" && <Overview onOpen={setSelected} onSection={changeSection} />}
        {section === "inbox" && <InboxView onOpen={setSelected} initialTab="sheet" />}
        {section === "inspections" && <InspectionsView onOpen={setSelected} />}
        {section === "presets" && <PresetsView />}
        {section === "billing" && <BillingView onOpen={setSelected} />}
      </motion.div></AnimatePresence><footer className="office-footer"><span>Concept by Web Designs Lab.</span><button onClick={() => setResetOpen(true)}>Reset demo data</button></footer></main>
    </div>
    <RecordDetail selected={selected} onClose={() => setSelected(null)} />
    <Modal open={resetOpen} onOpenChange={setResetOpen} title="Reset the demo?" description="Restore the original sheets, inspections, scans, and presets. Your changes will be replaced."><div className="modal-actions"><Button onClick={() => setResetOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => { state.resetDemo(); setResetOpen(false); setSection("overview"); toast.success("Demo data restored"); }}>Reset everything</Button></div></Modal>
  </div>;
}
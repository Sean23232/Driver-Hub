import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Camera, Check, CheckCircle2, ClipboardCheck, Gauge, Plus, ShieldCheck, Trash2, Truck } from "lucide-react";
import type { Defect, Inspection } from "../types";
import { BackLink, Badge, Button, Drawer, Field, Input, Modal, PdfPreview, SectionHeading, Select, SuccessMark, Textarea } from "../components/ui";
import { SignaturePad } from "../components/SignaturePad";
import { dayOffset, displayName, formatClock, formatDate, localDate } from "../lib/helpers";
import { fileToDataUrl, processImage, typedSignature } from "../lib/images";
import { inspectionPdf, TRACTOR_ITEMS, TRAILER_ITEMS } from "../lib/pdf";
import { useHubStore } from "../store";

const allItems = [...TRACTOR_ITEMS.flat().map((item) => `Truck: ${item}`), ...TRAILER_ITEMS.map((item) => `Trailer: ${item}`)];

function ProgressRing({ count, total }: { count: number; total: number }) {
  const circumference = 2 * Math.PI * 39;
  return <div className="inspection-progress" role="progressbar" aria-label="Inspection items reviewed" aria-valuenow={count} aria-valuemin={0} aria-valuemax={total}><svg viewBox="0 0 100 100" width="96" height="96"><circle cx="50" cy="50" r="39" stroke="var(--border-strong)" strokeWidth="7" fill="none" /><motion.circle cx="50" cy="50" r="39" stroke="var(--green)" strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - count / total) }} transition={{ duration: .55 }} transform="rotate(-90 50 50)" /></svg><span><strong className="heading-font">{count}<small>/{total}</small></strong><small>REVIEWED</small></span></div>;
}

export default function InspectionPage() {
  const navigate = useNavigate();
  const state = useHubStore();
  const driverId = state.activeDriverId || "marlin";
  const driver = state.drivers.find((item) => item.id === driverId);
  const draft = state.draftInspections[driverId];
  const [selectedItem, setSelectedItem] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState("");
  const [defectError, setDefectError] = useState("");
  const [allClearConfirm, setAllClearConfirm] = useState(false);
  const [odoPad, setOdoPad] = useState(false);
  const [historyId, setHistoryId] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { state.ensureInspectionDraft(driverId); }, [driverId, state.ensureInspectionDraft]);
  const lastReading = useMemo(() => Math.max(0, ...state.inspections.filter((item) => item.truck === (draft?.truck || driver?.truckId)).map((item) => Number(item.odometer) || 0)), [state.inspections, draft?.truck, driver?.truckId]);
  const history = state.inspections.filter((item) => item.driverId === driverId && item.date >= dayOffset(-6) && item.date <= localDate()).sort((a, b) => (b.submittedAt || b.date).localeCompare(a.submittedAt || a.date));
  const selectedHistory = state.inspections.find((item) => item.id === historyId);
  const patch = (changes: Partial<Inspection>) => state.updateInspectionDraft(driverId, changes);

  const openDefect = (item: string) => {
    const existing = draft?.defects.find((defect) => defect.item === item);
    setSelectedItem(item);
    setDescription(existing?.description || "");
    setPhoto(existing?.photo || "");
    setDefectError("");
  };
  const saveDefect = () => {
    if (!draft || !description.trim()) { setDefectError("Add a short description so the office knows what to fix."); return; }
    const defect: Defect = { item: selectedItem, description: description.trim(), photo: photo || undefined };
    patch({ defects: [...draft.defects.filter((item) => item.item !== selectedItem), defect], reviewed: Array.from(new Set([...(draft.reviewed || []), selectedItem])), condition: "correction" });
    setSelectedItem("");
    toast.warning(`${selectedItem.replace(/^(Truck|Trailer): /, "")} flagged. Office will see the defect when submitted.`);
  };
  const removeDefect = () => {
    if (!draft) return;
    const defects = draft.defects.filter((item) => item.item !== selectedItem);
    patch({ defects, condition: defects.length ? "correction" : "satisfactory" });
    setSelectedItem("");
    toast.success("Defect removed. Item is OK.");
  };
  const markAllClear = () => {
    if (!draft) return;
    if (draft.defects.length) { setAllClearConfirm(true); return; }
    patch({ reviewed: allItems, condition: "satisfactory" });
    toast.success("All items marked OK. Flag any exceptions below.");
  };
  const submit = () => {
    if (!draft) return;
    const issues: string[] = [];
    if (!(Number(draft.odometer) > lastReading)) issues.push(`Enter an odometer reading higher than ${lastReading.toLocaleString()} miles.`);
    if ((draft.reviewed || []).length < allItems.length) issues.push(`Review all ${allItems.length} items. Use All Clear, then flag any exceptions.`);
    if (draft.defects.length && !draft.remarks.trim()) issues.push("Add remarks describing the reported defects.");
    if (!draft.signature) issues.push("Sign the inspection report or use the typed signature option.");
    setErrors(issues);
    if (issues.length) { toast.error(issues[0]); return; }
    const submitted = state.submitInspection(driverId);
    if (submitted) { toast.success(submitted.status === "queued" ? "Inspection queued for sync" : submitted.defects.length ? "Defect alert sent to Office" : "Inspection sent to Office"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try { setPhoto(await processImage(await fileToDataUrl(file), "compress", 900)); toast.success("Defect photo added"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not open photo"); }
  };
  const renderItem = (item: string, group: "Truck" | "Trailer") => {
    const key = `${group}: ${item}`;
    const flagged = draft?.defects.some((defect) => defect.item === key);
    return <button key={key} type="button" className={`inspection-item ${flagged ? "defective" : ""}`} onClick={() => openDefect(key)} aria-label={`${item}, ${flagged ? "defect flagged" : "OK"}. Tap to ${flagged ? "edit defect" : "flag a defect"}`}><span className="inspection-item-icon">{flagged ? <AlertTriangle size={16} /> : <Check size={17} />}</span><span>{item}</span><small>{flagged ? "DEFECT" : "OK"}</small></button>;
  };

  if (!draft) return <div className="page-shell"><div className="skeleton h-12 w-1/2 mb-5" /><div className="skeleton h-96 w-full" /></div>;
  const locked = draft.status !== "draft";

  return <div className="page-shell inspection-page"><div className="page-topline"><BackLink onClick={() => navigate("/")} /><Badge tone={draft.defects.length ? "red" : "green"}>{draft.defects.length} defect{draft.defects.length === 1 ? "" : "s"}</Badge></div>
    <SectionHeading eyebrow="02 / SAFETY FIRST" title="Vehicle Inspection" description="Driver's Vehicle Inspection Report (DVIR)" action={<Badge tone={locked ? draft.status === "queued" ? "amber" : "green" : "cyan"}>{locked ? draft.status === "queued" ? "Queued for sync" : "Sent to Office" : "Pre-trip check"}</Badge>} />
    {locked ? <div className="inspection-submitted"><div className="submitted-hero surface"><SuccessMark /><div><div className="eyebrow">{draft.status === "resolved" ? "OFFICE SIGN-OFF COMPLETE" : "REPORT RECORDED"}</div><h2>{draft.status === "resolved" ? "Defect resolved." : draft.defects.length ? "Defect report sent." : "Inspection complete."}</h2><p>{draft.status === "queued" ? "Saved offline. Your report will arrive at the office when you reconnect." : draft.status === "resolved" ? `Mechanic ${draft.mechanicName} signed off: ${draft.resolution === "corrected" ? "defects corrected" : "safe operation without correction"}.` : draft.defects.length ? "The office has a priority alert for the flagged item(s)." : `${draft.truck} is recorded as satisfactory for today's pre-trip check.`}</p></div></div>{draft.status === "resolved" && <div className="resolved-note"><CheckCircle2 size={21} /> Above defects {draft.resolution === "corrected" ? "corrected" : "need not be corrected for safe operation"} · Mechanic's signature on PDF</div>}<PdfPreview key={`${draft.id}-${draft.status}`} createPdf={() => inspectionPdf(draft, state)} filename={`${draft.truck}-DVIR-${draft.date}.pdf`} minHeight={420} /><div className="wizard-actions"><Button onClick={() => navigate("/")}>Back to Home</Button><Button variant="primary" icon={Plus} onClick={() => { state.resetInspectionDraft(driverId); toast.info("New inspection started"); }}>Start a new inspection</Button></div></div> : <>
      <div className="inspection-top surface"><div className="inspection-top-copy"><div className="inspection-top-icon"><ShieldCheck size={26} /></div><div><h2>Tap only what needs attention.</h2><p>Every item starts as OK. Check everything at once, then flag any defects you find.</p><Button variant="success" icon={CheckCircle2} onClick={markAllClear}>All Clear - mark every item OK</Button></div></div><div className="inspection-top-stats"><ProgressRing count={(draft.reviewed || []).length} total={allItems.length} /><Badge tone={draft.defects.length ? "red" : "green"}>{draft.defects.length ? `${draft.defects.length} defect${draft.defects.length === 1 ? "" : "s"} flagged` : "0 defects"}</Badge></div></div>
      <div className="inspection-details surface"><div className="inspection-details-title"><Truck size={20} /><strong>Vehicle & shift details</strong></div><div className="inspection-fields"><Field label="Carrier"><Input value="Samples Enterprise LLC" readOnly /></Field><Field label="Carrier address"><Input value="658 Little Circle, Tallapoosa, GA 30176" readOnly /></Field><Field label="Date"><Input type="date" value={draft.date} onChange={(event) => patch({ date: event.target.value })} /></Field><Field label="Time"><Input type="time" value={draft.time} onChange={(event) => patch({ time: event.target.value })} /></Field><Field label="Tractor / truck no."><Select className="mono" value={draft.truck} onChange={(event) => patch({ truck: event.target.value })}>{state.trucks.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select></Field><Field label="Trailer(s) no.(s)"><Select className="mono" value={draft.trailer} onChange={(event) => patch({ trailer: event.target.value })}>{state.trailers.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select></Field><Field label="Odometer reading" required hint={`Last saved for ${draft.truck}: ${lastReading.toLocaleString("en-US")} mi. New reading must be higher.`}><div className="large-input-row"><Input className="mono big-number-input" type="text" inputMode="numeric" placeholder="489505" value={draft.odometer} onChange={(event) => patch({ odometer: event.target.value.replace(/\D/g, "") })} /><Button icon={Gauge} size="icon" aria-label="Open odometer keypad" onClick={() => setOdoPad(true)} /></div></Field><Field label="Driver"><Input value={displayName(driverId, state.drivers)} readOnly /></Field></div></div>
      <div className="inspection-checklist surface"><div className="checklist-heading"><div><div className="eyebrow">TRACTOR / TRUCK</div><h2>Pre-trip checklist</h2><p>On paper, a check means defective. Here, green means OK. Tap to flag a defect.</p></div><Badge tone="green"><Check size={14} /> Default: OK</Badge></div>
        <div className="inspection-columns">{TRACTOR_ITEMS.map((column, index) => <div className="inspection-column" key={index}>{index === 2 && <div className="safety-subheading">SAFETY EQUIPMENT</div>}{column.map((item, itemIndex) => <div key={item}>{index === 2 && itemIndex === 5 && <div className="safety-subheading other-items-heading">OTHER COMPONENTS</div>}{renderItem(item, "Truck")}</div>)}</div>)}</div>
      </div>
      <div className="inspection-checklist surface"><div className="checklist-heading"><div><div className="eyebrow">TRAILER(S) NO.(S) {draft.trailer}</div><h2>Trailer checklist</h2><p>Inspect connections, running gear and all visible equipment.</p></div></div><div className="trailer-grid">{TRAILER_ITEMS.map((item) => renderItem(item, "Trailer"))}</div></div>
      <div className="inspection-finish surface"><div className="step-heading"><div><div className="eyebrow">FINAL CHECK</div><h2>Remarks & driver sign-off</h2><p>Defects must be described before this report can be sent.</p></div></div><Field label="Remarks" required={!!draft.defects.length}><Textarea value={draft.remarks} placeholder={draft.defects.length ? "Describe the issue, location and any steps taken..." : "Optional when everything is satisfactory"} onChange={(event) => patch({ remarks: event.target.value })} /></Field>
        <div className="condition-section"><span className="field-label">Vehicle condition</span><div className="condition-choices"><button className={!draft.defects.length ? "chosen" : ""} onClick={() => draft.defects.length ? toast.info("Remove flagged defects before marking satisfactory.") : patch({ condition: "satisfactory" })}><CheckCircle2 size={21} /> Condition of the above vehicle is satisfactory</button><button className={draft.defects.length ? "chosen has-defects" : ""} onClick={() => draft.defects.length ? patch({ condition: "correction" }) : toast.info("Tap a checklist item to flag a defect first.")}><AlertTriangle size={21} /> Defects need to be corrected</button></div></div>
        <SignaturePad label="Driver signature" value={draft.signature} onChange={(signature) => patch({ signature, signedAt: signature ? new Date().toISOString() : "" })} /><button className="typed-signature-link" onClick={() => { patch({ signature: typedSignature(driver?.name || "Driver"), signedAt: new Date().toISOString() }); toast.success("Typed driver signature applied"); }}>Use my name as an electronic signature instead</button>
        <div className="office-only"><span className="eyebrow">OFFICE USE ONLY</span><p>These fields are completed by the office after a defect report is reviewed.</p><div><span>Mechanic's signature <strong>Pending office review</strong></span><span>Above defects corrected <strong>--</strong></span><span>Above defects need not be corrected for safe operation <strong>--</strong></span></div></div>
        {!!errors.length && <div className="validation-box" role="alert"><strong>Before you submit:</strong>{errors.map((issue) => <p key={issue}>• {issue}</p>)}</div>}
        <Button variant="primary" className="submit-inspection" icon={ClipboardCheck} onClick={submit}>Submit inspection to Office <ArrowRight size={18} /></Button>
      </div>
    </>}
    <div className="inspection-history"><div className="history-title"><div><div className="eyebrow">YOUR RECORDS</div><h2>Inspection history</h2></div><span>Last 7 days</span></div>{history.length ? <div className="history-list">{history.map((item) => <button key={item.id} className="history-row" onClick={() => setHistoryId(item.id)}><span className={`history-icon ${item.defects.length ? "bad" : ""}`}>{item.defects.length ? <AlertTriangle size={19} /> : <Check size={19} />}</span><span className="history-main"><strong>{formatDate(item.date)} <span className="mono">{formatClock(item.time)}</span></strong><small>{item.truck} · {Number(item.odometer).toLocaleString()} mi</small></span><Badge tone={item.defects.length ? item.status === "resolved" ? "green" : "red" : "green"}>{item.defects.length ? item.status === "resolved" ? "Resolved" : `${item.defects.length} defect` : "All clear"}</Badge><ArrowRight size={18} /></button>)}</div> : <div className="history-empty"><ShieldCheck size={26} /> No inspections in the last 7 days. Today's will appear here.</div>}</div>
    <Modal open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItem(""); }} title="Flag a defect" description={selectedItem.replace(/^(Truck|Trailer): /, "")} className="defect-sheet"><div className="defect-warning"><AlertTriangle size={19} /> The office will receive a priority alert when this report is submitted.</div><Field label="What needs attention?" required><Textarea value={description} placeholder="e.g. Left rear tire sidewall bulge" onChange={(event) => { setDescription(event.target.value); setDefectError(""); }} /></Field>{defectError && <p className="inline-error" role="alert">{defectError}</p>}<div className="defect-photo-row"><label className="ui-button ui-button-secondary" htmlFor="defect-photo"><Camera size={18} /> {photo ? "Replace photo" : "Add photo (optional)"}</label><input id="defect-photo" className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => onPhoto(event.target.files?.[0])} />{photo && <img src={photo} alt="Defect evidence" />}</div><div className="defect-actions">{draft.defects.some((item) => item.item === selectedItem) && <Button icon={Trash2} onClick={removeDefect}>Remove defect</Button>}<Button variant="danger" icon={AlertTriangle} onClick={saveDefect}>Save defect</Button></div></Modal>
    <Modal open={allClearConfirm} onOpenChange={setAllClearConfirm} title="Clear flagged defects?" description="All Clear will mark every item OK and remove the defect descriptions and remarks on this draft."><div className="modal-actions"><Button onClick={() => setAllClearConfirm(false)}>Keep defects</Button><Button variant="success" onClick={() => { patch({ reviewed: allItems, defects: [], remarks: "", condition: "satisfactory" }); setAllClearConfirm(false); toast.success("All items marked OK"); }}>Mark all clear</Button></div></Modal>
    <Modal open={odoPad} onOpenChange={setOdoPad} title="Odometer reading" description={`Must be higher than ${lastReading.toLocaleString("en-US")} miles.`}><div className="number-display mono">{draft.odometer || "0"}</div><div className="number-pad">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "Delete"].map((key) => <button key={key} onClick={() => patch({ odometer: key === "Clear" ? "" : key === "Delete" ? draft.odometer.slice(0, -1) : draft.odometer.length < 8 ? draft.odometer + key : draft.odometer })}>{key}</button>)}</div><Button variant="primary" className="w-full mt-4" onClick={() => setOdoPad(false)}>Done <Check size={17} /></Button></Modal>
    <Drawer open={!!selectedHistory} onOpenChange={(open) => { if (!open) setHistoryId(""); }} title="Inspection report">{selectedHistory && <div className="history-drawer"><div className="drawer-quick"><strong>{selectedHistory.truck}</strong><Badge tone={selectedHistory.defects.length ? "red" : "green"}>{selectedHistory.defects.length ? `${selectedHistory.defects.length} defect(s)` : "All clear"}</Badge></div><p>{formatDate(selectedHistory.date)} at {formatClock(selectedHistory.time)} · {Number(selectedHistory.odometer).toLocaleString()} miles</p>{selectedHistory.defects.map((defect) => <div className="drawer-defect" key={defect.item}><AlertTriangle size={18} /><div><strong>{defect.item}</strong><p>{defect.description}</p></div></div>)}<PdfPreview key={selectedHistory.id} createPdf={() => inspectionPdf(selectedHistory, state)} filename={`${selectedHistory.truck}-DVIR-${selectedHistory.date}.pdf`} minHeight={480} /></div>}</Drawer>
  </div>;
}
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Calculator, Camera, Check, CheckCircle2, Clock3, Copy, FileCheck2, FileText, Mail, Plus, Save, Trash2 } from "lucide-react";
import type { DailySheet, Material, SheetLoad } from "../types";
import { BackLink, Badge, Button, ChoiceGroup, Field, Input, Modal, PdfPreview, PresetPicker, SectionHeading, StepForward, SuccessMark, Textarea } from "../components/ui";
import { SignaturePad } from "../components/SignaturePad";
import { displayName, duration, formatDate, formatTons, newLoad, timeNow, totalTons, uid } from "../lib/helpers";
import { sheetPdf } from "../lib/pdf";
import { useHubStore } from "../store";

const steps = ["Trip Info", "Loads", "Notes & Signature", "Review & Send"] as const;
const materials: Material[] = ["Concrete", "C&D", "Dirt", "Metals", "Rock", "Other"];
const materialColors: Record<Material, string> = { Concrete: "#f5a524", "C&D": "#22d3ee", Dirt: "#a78565", Metals: "#8b9cf7", Rock: "#46c893", Other: "#ee8cbd" };

function NumericPad({ open, onOpenChange, value, onChange, label, decimal = true }: { open: boolean; onOpenChange: (open: boolean) => void; value: string; onChange: (value: string) => void; label: string; decimal?: boolean }) {
  return <Modal open={open} onOpenChange={onOpenChange} title={label} description="Tap the numbers or use your keyboard."><div className="number-display mono">{value || "0"}</div><div className="number-pad">{["1", "2", "3", "4", "5", "6", "7", "8", "9", decimal ? "." : "Clear", "0", "Delete"].map((digit) => <button key={digit} onClick={() => {
    if (digit === "Delete") onChange(value.slice(0, -1));
    else if (digit === "Clear") onChange("");
    else if (digit === ".") { if (!value.includes(".")) onChange((value || "0") + "."); }
    else if (value.length < 10) onChange(value === "0" ? digit : value + digit);
  }}>{digit}</button>)}</div><Button variant="primary" className="w-full mt-4" onClick={() => onOpenChange(false)}>Done <Check size={17} /></Button></Modal>;
}

function Donut({ loads }: { loads: SheetLoad[] }) {
  const breakdown = materials.map((material) => ({ material, tons: loads.filter((load) => load.material === material).reduce((sum, load) => sum + (Number(load.tons) || 0), 0) })).filter((item) => item.tons > 0);
  const total = totalTons(loads);
  let current = 0;
  const stops = breakdown.map((item) => { const start = current; current += (item.tons / (total || 1)) * 100; return `${materialColors[item.material]} ${start}% ${current}%`; }).join(", ");
  return <motion.div className="donut-wrap" key={stops} initial={{ scale: .85, opacity: .5 }} animate={{ scale: 1, opacity: 1 }}><div className="donut" style={{ background: total ? `conic-gradient(${stops})` : "var(--border-strong)" }}><div className="donut-hole"><strong className="mono">{loads.length}</strong><small>LOADS</small></div></div><div className="donut-key">{breakdown.length ? breakdown.map((item) => <span key={item.material}><i style={{ background: materialColors[item.material] }} />{item.material} <b>{formatTons(item.tons)}</b></span>) : <span>Loads appear here</span>}</div></motion.div>;
}

function typedSignature(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#1b304c";
  ctx.font = "italic 52px Georgia, serif";
  ctx.fillText(name, 18, 100, 590);
  return canvas.toDataURL("image/png");
}

export default function Sheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useHubStore();
  const driverId = state.activeDriverId || "marlin";
  const draft = state.draftSheets[driverId];
  const [step, setStep] = useState(() => (location.state as { returnStep?: number } | null)?.returnStep ?? 0);
  const [saved, setSaved] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [pad, setPad] = useState<{ loadId: string; field: "tons" | "ticket" } | null>(null);

  useEffect(() => { state.ensureSheetDraft(driverId); }, [driverId, state.ensureSheetDraft]);
  useEffect(() => { if (!draft || draft.status !== "draft") return; setSaved(false); const timer = window.setTimeout(() => setSaved(true), 500); return () => window.clearTimeout(timer); }, [draft]);
  const patch = (changes: Partial<DailySheet>) => state.updateSheetDraft(driverId, changes);
  const changeLoad = (loadId: string, changes: Partial<SheetLoad>) => {
    if (!draft) return;
    patch({ loads: draft.loads.map((item) => item.id === loadId ? { ...item, ...changes } : item) });
  };
  const validate = (target: number): number | null => {
    if (!draft) return 0;
    const issues: string[] = [];
    let firstStep: number | null = null;
    if (target >= 0) {
      if (!draft.customerId.trim()) issues.push("Select or enter a customer.");
      if (!draft.invoice.trim()) issues.push("Enter an invoice number.");
      else if (!/^[A-Z0-9-]+$/.test(draft.invoice)) issues.push("Invoice numbers can use letters, numbers and hyphens only.");
      if (state.sheets.some((item) => item.invoice === draft.invoice && item.id !== draft.id)) issues.push("This invoice number already belongs to another sheet.");
      if (!draft.date) issues.push("Select a date for this sheet.");
      if (!draft.truck.trim()) issues.push("Select a truck.");
      if (!draft.startTime) issues.push("Tap Start now or enter a start time.");
      if (!draft.jobSite.trim() || !draft.delivery.trim()) issues.push("Enter the job site and delivery location.");
      if (issues.length) firstStep = 0;
    }
    if (target >= 1) {
      const before = issues.length;
      if (!draft.loads.length) issues.push("Add at least one load.");
      draft.loads.forEach((load, index) => {
        if (!(Number(load.tons) > 0)) issues.push(`Load ${index + 1}: tons must be greater than zero.`);
        if (!load.ticket.trim()) issues.push(`Load ${index + 1}: enter a ticket number.`);
        if (load.material === "Other" && !load.otherMaterial.trim()) issues.push(`Load ${index + 1}: name the material.`);
      });
      const tickets = draft.loads.map((load) => load.ticket.trim()).filter(Boolean);
      if (new Set(tickets).size !== tickets.length) issues.push("Two loads share a ticket number. Each ticket must be unique.");
      if (issues.length > before && firstStep === null) firstStep = 1;
    }
    if (target >= 2) {
      const before = issues.length;
      if (!draft.signature) issues.push("Add a customer signature or use a typed signature.");
      if (!draft.signedName.trim()) issues.push("Enter the customer's printed name.");
      if (draft.sendCopy && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.customerEmail)) issues.push("Enter a valid customer email to send a copy.");
      if (issues.length > before && firstStep === null) firstStep = 2;
    }
    setErrors(issues);
    if (issues.length) toast.error(issues[0]);
    return firstStep;
  };
  const goTo = (target: number) => {
    if (target <= step || validate(Math.min(target - 1, 2)) === null) { setErrors([]); setStep(target); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  const submit = () => {
    const failedStep = validate(2);
    if (failedStep !== null) { setStep(failedStep); return; }
    const submitted = state.submitSheet(driverId);
    if (submitted) {
      setStep(3);
      toast.success(submitted.status === "queued" ? "Sheet queued. It will send when you're online." : "Daily sheet sent to Office");
    }
  };

  const duplicateTickets = useMemo(() => {
    const tickets = draft?.loads.map((load) => load.ticket.trim()).filter(Boolean) || [];
    return tickets.filter((ticket, index) => tickets.indexOf(ticket) !== index);
  }, [draft?.loads]);

  if (!draft) return <div className="page-shell"><div className="skeleton h-12 w-1/2 mb-5" /><div className="skeleton h-96 w-full" /></div>;
  const locked = draft.status !== "draft";
  const customerName = displayName(draft.customerId, state.customers);

  return <div className="page-shell sheet-page"><div className="page-topline"><BackLink onClick={() => navigate("/")} /><div className="save-status"><Save size={15} />{locked ? "Submitted and locked" : saved ? "All changes saved" : "Saving..."}</div></div>
    <SectionHeading eyebrow="01 / FIELD OPERATIONS" title="Daily Work Sheet" description="A full day of work, without the paperwork." action={<div className="heading-badges"><Badge tone={locked ? draft.status === "queued" ? "amber" : "green" : "cyan"}>{locked ? draft.status === "queued" ? "Queued for sync" : "Sent to Office" : "Auto-saved draft"}</Badge><span className="invoice-heading mono">{draft.invoice}</span></div>} />
    <div className="wizard-layout"><aside className="wizard-rail glass"><div className="rail-kicker">YOUR PROGRESS</div>{steps.map((label, index) => <button type="button" key={label} className={`rail-step ${step === index ? "active" : ""} ${step > index || locked ? "complete" : ""}`} onClick={() => locked ? setStep(3) : goTo(index)} aria-current={step === index ? "step" : undefined}><span className="rail-index">{step > index || locked ? <Check size={17} /> : String(index + 1).padStart(2, "0")}</span><span><strong>{label}</strong><small>{["Customer, vehicle & route", "Tickets, material & tons", "Finish the record", "Preview & submit"][index]}</small></span></button>)}<div className="rail-help"><FileCheck2 size={19} /><span>Drafts save automatically, even if you leave this page.</span></div></aside>
      <section className="wizard-content"><AnimatePresence mode="wait"><motion.div key={locked ? "submitted" : step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .24 }}>
        {locked ? <div className="submitted-view"><div className="submitted-hero surface"><SuccessMark /><div><div className="eyebrow">{draft.status === "queued" ? "SAVED FOR LATER" : "SUCCESSFULLY DELIVERED"}</div><h2>{draft.status === "queued" ? "Sheet queued for Office." : "Sheet sent to Office."}</h2><p>{draft.status === "queued" ? "This sheet is safe on your device and will sync when you reconnect." : `${draft.invoice} has arrived in the Office inbox. You're clear to start another sheet.`}</p></div></div>
          <div className="email-preview surface"><div className="email-preview-head"><Mail size={20} /><strong>{draft.sendCopy ? draft.status === "queued" ? "Customer email queued" : "Customer email sent (demo)" : "Customer copy not requested"}</strong><Badge tone={draft.sendCopy ? draft.status === "queued" ? "amber" : "green" : "neutral"}>{draft.sendCopy ? draft.status === "queued" ? "Queued" : "Simulated" : "Not sent"}</Badge></div>{draft.sendCopy && <div className="email-lines"><p><span>To</span>{draft.customerEmail}</p><p><span>Subject</span>Signed Daily Work Sheet {draft.invoice} | Samples Enterprise LLC</p><div className="email-body">Hello {customerName},<br /><br />Attached is the signed Daily Work Sheet for {formatDate(draft.date)}. Your {draft.loads.length} load{draft.loads.length === 1 ? "" : "s"} totaled {formatTons(totalTons(draft.loads))} tons.<br /><br />Thank you,<br />Samples Enterprise LLC</div></div>}</div>
          <PdfPreview key={draft.id} createPdf={() => sheetPdf(draft, state)} filename={`${draft.invoice}-daily-sheet.pdf`} minHeight={370} /><div className="wizard-actions"><Button variant="secondary" onClick={() => navigate("/")}>Back to Home</Button><Button variant="primary" icon={Plus} onClick={() => { state.startNewSheet(driverId); setStep(0); toast.success("New work sheet started"); }}>Start a new sheet</Button></div>
        </div> : <>
          {step === 0 && <div className="step-panel surface"><div className="step-heading"><div><span className="eyebrow">STEP 01 / 04</span><h2>Set up your trip</h2><p>Tap a preset or type your own. The office can update these choices anytime.</p></div><TruckIcon /></div>
            <div className="sheet-form-grid"><div className="span-2"><PresetPicker label="Customer" required value={draft.customerId} options={state.customers} onChange={(customerId) => patch({ customerId })} onSelect={(item) => patch({ customerId: item.id, customerEmail: item.email || "" })} /></div>
              <Field label="Invoice #" required><Input className="mono" value={draft.invoice} onChange={(event) => patch({ invoice: event.target.value.toUpperCase() })} /></Field>
              <Field label="Date" required><Input type="date" value={draft.date} onChange={(event) => patch({ date: event.target.value })} /></Field>
              <Field label="Job #"><Input value={draft.jobNumber} placeholder="e.g. CG-204" onChange={(event) => patch({ jobNumber: event.target.value })} /></Field>
              <Field label="PO # (optional)"><Input value={draft.poNumber} placeholder="e.g. PO-7204" onChange={(event) => patch({ poNumber: event.target.value })} /></Field>
              <PresetPicker label="Truck #" required value={draft.truck} options={state.trucks} onChange={(truck) => patch({ truck })} onSelect={(item) => patch({ truck: item.name })} />
              <PresetPicker label="Trailer #" value={draft.trailer} options={state.trailers} onChange={(trailer) => patch({ trailer })} onSelect={(item) => patch({ trailer: item.name })} />
              <div className="span-2"><span className="field-label">Vehicle type</span><ChoiceGroup value={draft.vehicleType} options={["Tandem Dump Truck", "Semi & Dump Trailer"] as const} onChange={(vehicleType) => patch({ vehicleType })} /></div>
              <Field label="Driver name"><Input value={displayName(driverId, state.drivers)} readOnly aria-readonly="true" /></Field>
              <div className="field"><span className="field-label">Shift hours</span><div className="hours-readout"><Clock3 size={19} /><strong className="heading-font">{draft.startTime ? duration(draft.startTime, draft.endTime) : "Not started"}</strong><span>auto-calculated</span></div></div>
              <Field label="Start time" required><div className="time-input-row"><Input type="time" value={draft.startTime} onChange={(event) => patch({ startTime: event.target.value })} /><Button size="compact" variant="primary" onClick={() => { patch({ startTime: timeNow() }); toast.success("Shift started"); }}>Start now</Button></div></Field>
              <Field label="End time"><div className="time-input-row"><Input type="time" value={draft.endTime} onChange={(event) => patch({ endTime: event.target.value })} /><Button size="compact" onClick={() => { patch({ endTime: timeNow() }); toast.success("End time recorded"); }}>End now</Button></div></Field>
              <div className="span-2 location-pickers"><PresetPicker label="Job site location" required value={draft.jobSite} options={state.jobSites} onChange={(jobSite) => patch({ jobSite })} onSelect={(item) => patch({ jobSite: item.name })} /><PresetPicker label="Pickup location(s)" value={draft.pickup} options={state.pickups} onChange={(pickup) => patch({ pickup })} onSelect={(item) => patch({ pickup: item.name })} /><PresetPicker label="Delivery location(s)" required value={draft.delivery} options={state.deliveries} onChange={(delivery) => patch({ delivery })} onSelect={(item) => patch({ delivery: item.name })} /></div>
            </div></div>}
          {step === 1 && <div className="step-panel surface"><div className="step-heading"><div><span className="eyebrow">STEP 02 / 04</span><h2>Record your loads</h2><p>Every haul has a material, a weight and a ticket number.</p></div><Badge tone="cyan">Up to 20 loads</Badge></div>
            <div className="loads-total surface"><div><span className="eyebrow">LIVE TOTAL</span><strong className="heading-font">{formatTons(totalTons(draft.loads))} <small>tons</small></strong><p>across {draft.loads.length} load{draft.loads.length === 1 ? "" : "s"}</p></div><Donut loads={draft.loads} /></div>
            <div className="load-list">{draft.loads.map((load, index) => <div className="load-entry" key={load.id}><div className="load-entry-top"><div className="load-number mono">{String(index + 1).padStart(2, "0")}</div><div><h3>Load {index + 1}</h3><span>{load.tons ? `${load.tons} tons` : "Add weight"} · {load.ticket ? `Ticket ${load.ticket}` : "Ticket needed"}</span></div>{draft.loads.length > 1 && <Button variant="ghost" size="icon" aria-label={`Remove load ${index + 1}`} onClick={() => { patch({ loads: draft.loads.filter((item) => item.id !== load.id) }); toast.info(`Load ${index + 1} removed`); }}><Trash2 size={19} /></Button>}</div>
                <div className="field"><span className="field-label">Material</span><ChoiceGroup value={load.material} options={materials} onChange={(material) => changeLoad(load.id, { material })} /></div>
                {load.material === "Other" && <Field label="Describe material" required><Input value={load.otherMaterial} placeholder="Enter material name" onChange={(event) => changeLoad(load.id, { otherMaterial: event.target.value })} /></Field>}
                <div className="load-input-grid"><Field label="Tons" required><div className="large-input-row"><Input className="mono big-number-input" type="text" inputMode="decimal" placeholder="10.91" value={load.tons} onChange={(event) => { if (/^\d*(\.\d{0,2})?$/.test(event.target.value)) changeLoad(load.id, { tons: event.target.value }); }} /><Button size="icon" aria-label={`Open tons keypad for load ${index + 1}`} onClick={() => setPad({ loadId: load.id, field: "tons" })}><Calculator size={22} /></Button></div></Field>
                  <Field label="Ticket #" required><div className="large-input-row"><Input className={`mono big-number-input ${duplicateTickets.includes(load.ticket) && load.ticket ? "input-error" : ""}`} type="text" inputMode="numeric" placeholder="958348" value={load.ticket} onChange={(event) => changeLoad(load.id, { ticket: event.target.value.replace(/[^0-9A-Za-z-]/g, "") })} /><Button size="icon" aria-label={`Open ticket keypad for load ${index + 1}`} onClick={() => setPad({ loadId: load.id, field: "ticket" })}><Calculator size={22} /></Button></div></Field>
                </div>
                {duplicateTickets.includes(load.ticket) && load.ticket && <p className="inline-error">Duplicate ticket number. Please check the scale ticket.</p>}
                <div className="load-attachment"><Button icon={Camera} onClick={() => navigate("/scanner", { state: { returnTo: "/sheet", returnStep: 1, loadId: load.id } })}>{load.image ? "Replace haul ticket" : "Scan haul ticket"}</Button>{load.image && <div className="attached-ticket"><img src={load.image} alt={`Scanned haul ticket for load ${index + 1}`} /><span><CheckCircle2 size={16} /> Ticket attached</span></div>}</div>
              </div>)}</div>
            <div className="load-actions"><Button icon={Plus} variant="primary" disabled={draft.loads.length >= 20} onClick={() => { patch({ loads: [...draft.loads, newLoad()] }); toast.success(`Load ${draft.loads.length + 1} added`); }}>Add load</Button><Button icon={Copy} disabled={draft.loads.length >= 20 || !draft.loads.length} onClick={() => { const last = draft.loads[draft.loads.length - 1]; patch({ loads: [...draft.loads, { ...last, id: uid(), ticket: "", scanId: undefined, image: undefined }] }); toast.info("Last load duplicated. Enter its new ticket number."); }}>Duplicate last load</Button></div>
          </div>}
          {step === 2 && <div className="step-panel surface"><div className="step-heading"><div><span className="eyebrow">STEP 03 / 04</span><h2>Finish & sign</h2><p>Add anything the office should know, then capture customer approval.</p></div><FileText size={27} className="text-cyan" /></div>
            <Field label="Notes for the office"><Textarea value={draft.notes} placeholder="Anything unusual about today's work?" onChange={(event) => patch({ notes: event.target.value })} /></Field><div className="quick-notes"><span>QUICK NOTES</span>{["Long wait at scale", "Site wet/muddy", "Rejected load"].map((note) => <button type="button" key={note} className="select-chip" onClick={() => { patch({ notes: draft.notes ? `${draft.notes.trim()}\n${note}` : note }); toast.info("Note added"); }}>{note}</button>)}</div>
            <div className="signature-section"><div className="signature-section-head"><h3>Customer sign-off</h3><span>Required before sending</span></div><SignaturePad label="Customer signature" value={draft.signature} onChange={(signature) => patch({ signature, signedAt: signature ? new Date().toISOString() : "" })} /><div className="signature-fields"><Field label="Customer printed name" required><Input value={draft.signedName} placeholder="Name of person signing" onChange={(event) => patch({ signedName: event.target.value })} /></Field><Field label="Signed at"><Input value={draft.signedAt ? new Date(draft.signedAt).toLocaleString("en-US") : "Date and time added when signed"} readOnly /></Field></div><button className="typed-signature-link" onClick={() => { if (!draft.signedName.trim()) { toast.error("Enter the customer's printed name first."); return; } patch({ signature: typedSignature(draft.signedName), signedAt: new Date().toISOString() }); toast.success("Typed signature applied"); }}>Can't draw? Use the printed name as an electronic signature</button></div>
            <div className="customer-email-section"><label className="checkbox-row"><input type="checkbox" checked={draft.sendCopy} onChange={(event) => patch({ sendCopy: event.target.checked })} /><span><strong>Send signed copy to customer</strong><small>Simulated email for this local demo</small></span></label><Field label="Customer email"><Input type="email" value={draft.customerEmail} disabled={!draft.sendCopy} placeholder="customer@example.com" onChange={(event) => patch({ customerEmail: event.target.value })} /></Field></div>
          </div>}
          {step === 3 && <div className="step-panel surface"><div className="step-heading"><div><span className="eyebrow">STEP 04 / 04</span><h2>Review before sending</h2><p>This is the exact PDF the office will receive.</p></div><Badge tone="green"><Check size={13} /> Ready to submit</Badge></div>
            <div className="review-summary"><div><span>CUSTOMER</span><strong>{customerName}</strong></div><div><span>INVOICE</span><strong className="mono">{draft.invoice}</strong></div><div><span>LOADS / TONS</span><strong>{draft.loads.length} / {formatTons(totalTons(draft.loads))}</strong></div><div><span>DATE</span><strong>{formatDate(draft.date)}</strong></div></div><PdfPreview key={draft.id} createPdf={() => sheetPdf(draft, state)} filename={`${draft.invoice}-daily-sheet.pdf`} minHeight={440} /><p className="review-note"><Mail size={18} /> {draft.sendCopy ? `A signed copy will be simulated to ${draft.customerEmail}.` : "No customer email copy requested."}</p>
          </div>}
          {!!errors.length && <div className="validation-box" role="alert"><strong>Please fix these items:</strong>{errors.map((error) => <p key={error}>• {error}</p>)}</div>}
          <div className="wizard-actions"><Button onClick={() => step ? goTo(step - 1) : navigate("/")} icon={ArrowLeft}>{step ? "Previous step" : "Home"}</Button>{step < 3 ? <StepForward onClick={() => goTo(step + 1)}>Continue to {steps[step + 1]}</StepForward> : <Button variant="primary" icon={CheckCircle2} onClick={submit}>Submit to Office <ArrowRight size={18} /></Button>}</div>
        </>}
      </motion.div></AnimatePresence></section>
    </div>
    <NumericPad open={!!pad} onOpenChange={(open) => { if (!open) setPad(null); }} label={pad?.field === "ticket" ? "Ticket number" : "Tons"} decimal={pad?.field !== "ticket"} value={pad ? draft.loads.find((load) => load.id === pad.loadId)?.[pad.field] || "" : ""} onChange={(value) => { if (pad) changeLoad(pad.loadId, { [pad.field]: value }); }} />
  </div>;
}

function TruckIcon() { return <div className="step-icon"><Clock3 size={25} /></div>; }
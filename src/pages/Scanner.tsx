import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, Crop, FileImage, Flashlight, FlashlightOff, FlipHorizontal2, ImagePlus, RotateCw, ScanLine, Send, SlidersHorizontal, Trash2, UploadCloud } from "lucide-react";
import type { Scan } from "../types";
import { BackLink, Badge, Button, ChoiceGroup, Drawer, EmptyState, Field, PdfPreview, SectionHeading, Select, SuccessMark, Textarea } from "../components/ui";
import { fileToDataUrl, processImage } from "../lib/images";
import { localDate, timeAgo, uid } from "../lib/helpers";
import { scanPdf } from "../lib/pdf";
import { useHubStore } from "../store";

const documentTypes: Scan["type"][] = ["Haul Ticket", "DOT Inspection", "Fuel Receipt", "Scale Ticket", "Other"];

export default function Scanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { returnTo?: string; returnStep?: number; loadId?: string } | null;
  const state = useHubStore();
  const driverId = state.activeDriverId || "marlin";
  const draft = state.draftSheets[driverId];
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"capture" | "review" | "sending" | "success">("capture");
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [type, setType] = useState<Scan["type"]>("Haul Ticket");
  const [note, setNote] = useState("");
  const [loadId, setLoadId] = useState(routeState?.loadId || "");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [working, setWorking] = useState(false);
  const [sentScanId, setSentScanId] = useState("");
  const [galleryId, setGalleryId] = useState("");
  const todayScans = state.scans.filter((item) => item.driverId === driverId && item.createdAt.slice(0, 10) === localDate());
  const galleryScan = state.scans.find((item) => item.id === galleryId);
  const sentScan = state.scans.find((item) => item.id === sentScanId);
  const returnTo = routeState?.returnTo || "/";
  const goBack = () => navigate(returnTo, { state: routeState?.returnStep != null ? { returnStep: routeState.returnStep } : undefined });

  useEffect(() => {
    if (mode !== "capture") return;
    let disposed = false;
    setCameraReady(false);
    setCameraError("");
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCameraError("Camera access isn't available here. Upload a photo instead."); return; }
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
        const capabilities = stream.getVideoTracks()[0]?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean } | undefined;
        setTorchAvailable(!!capabilities?.torch);
        setFlashOn(false);
        setCameraReady(true);
      } catch {
        if (!disposed) { setCameraError("Camera access was blocked or isn't available. Use Upload / take photo below."); setCameraReady(false); }
      }
    };
    start();
    return () => { disposed = true; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, [mode, facing]);

  const addFiles = async (files: FileList | File[]) => {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) { toast.error("Choose an image file to scan."); return; }
    setWorking(true);
    try {
      const converted = await Promise.all(images.map(async (file) => processImage(await fileToDataUrl(file), "compress", 1050)));
      const next = [...pages, ...converted].slice(0, 10);
      setPages(next);
      setCurrentPage(next.length - 1);
      setMode("review");
      toast.success(`${converted.length} page${converted.length === 1 ? "" : "s"} added`);
      if (pages.length + converted.length > 10) toast.info("Maximum 10 pages per scan. Extra pages were skipped.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read that image"); }
    finally { setWorking(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };
  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !cameraReady) { toast.error("Camera isn't ready yet. Try upload instead."); return; }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1050 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", .72);
    setPages((old) => [...old, image]);
    setCurrentPage(pages.length);
    setMode("review");
    toast.success("Page captured. Review your scan below.");
  };
  const transform = async (operation: "rotate" | "crop" | "enhance") => {
    if (!pages[currentPage]) return;
    setWorking(true);
    try {
      const changed = await processImage(pages[currentPage], operation, 1050);
      setPages((old) => old.map((page, index) => index === currentPage ? changed : page));
      toast.success(operation === "crop" ? "Edges auto-fitted" : operation === "enhance" ? "Document enhanced" : "Page rotated");
    } catch { toast.error("Couldn't edit this photo. Please try another one."); }
    finally { setWorking(false); }
  };
  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchAvailable) return;
    try { await track.applyConstraints({ advanced: [{ torch: !flashOn } as MediaTrackConstraintSet] }); setFlashOn(!flashOn); }
    catch { toast.info("Flash control isn't supported by this camera."); setTorchAvailable(false); }
  };
  const send = () => {
    if (!pages.length) { toast.error("Capture or upload at least one page."); return; }
    setMode("sending");
    window.setTimeout(() => {
      try {
        const scan: Scan = { id: uid(), driverId, status: state.simulateOffline ? "queued" : "sent", type, note: note.trim(), loadId, pages, createdAt: new Date().toISOString() };
        state.addScan(scan);
        setSentScanId(scan.id);
        setMode("success");
        toast.success(state.simulateOffline ? "Scan queued for sync" : "Scan sent to Office");
      } catch { setMode("review"); toast.error("Could not save this scan. Try fewer pages or smaller photos."); }
    }, 850);
  };
  const newScan = () => { setPages([]); setCurrentPage(0); setMode("capture"); setType("Haul Ticket"); setNote(""); setLoadId(""); setSentScanId(""); toast.info("Ready for a new scan"); };

  return <div className="page-shell scanner-page"><div className="page-topline"><BackLink onClick={goBack} label={routeState?.returnTo ? "Back to Work Sheet" : "Back to Home"} /><Badge tone={mode === "success" ? "green" : "cyan"}>{mode === "review" ? `${pages.length} page${pages.length === 1 ? "" : "s"} captured` : mode === "success" ? "Sent" : "Ready to scan"}</Badge></div>
    <SectionHeading eyebrow="04 / PAPERLESS OFFICE" title="Document Scanner" description="Capture, clean up and send tickets straight from the cab." action={<div className="scanner-count"><ScanLine size={19} /> {todayScans.length} sent today</div>} />
    {mode === "capture" && <div className="scanner-layout"><div className="camera-stage surface"><div className="camera-topline"><span><span className={`camera-live-dot ${cameraReady ? "" : "camera-waiting"}`} /> {cameraReady ? "CAMERA LIVE" : "CAMERA PREVIEW"}</span><span>{pages.length ? `PAGE ${pages.length + 1}` : "DOCUMENT CAPTURE"}</span></div>
        {cameraError ? <div className="camera-fallback"><div className="camera-fallback-icon"><Camera size={37} /></div><h2>Use a photo instead.</h2><p>{cameraError}</p><Button icon={Camera} onClick={() => captureInputRef.current?.click()}>Take a photo</Button><Button icon={UploadCloud} onClick={() => fileInputRef.current?.click()}>Choose existing photos</Button></div> : <><video ref={videoRef} muted playsInline autoPlay className="camera-video" /><div className="document-frame"><span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" /><span>Align the document inside the frame</span></div>{!cameraReady && <div className="camera-loading"><div className="skeleton h-8 w-2/3" /><p>Starting your camera...</p></div>}</>}
        <div className="camera-bottom"><button className="camera-tool" onClick={() => setFacing((value) => value === "environment" ? "user" : "environment")} aria-label="Switch camera"><FlipHorizontal2 size={21} /><span>Switch</span></button><button className="shutter" onClick={capture} aria-label="Capture document" disabled={!cameraReady}><span /></button>{torchAvailable ? <button className="camera-tool" onClick={toggleFlash} aria-label={flashOn ? "Turn flash off" : "Turn flash on"}>{flashOn ? <FlashlightOff size={21} /> : <Flashlight size={21} />}<span>Flash</span></button> : <button className="camera-tool" onClick={() => fileInputRef.current?.click()} aria-label="Upload a photo"><ImagePlus size={21} /><span>Upload</span></button>}</div>
      </div><div className="scanner-side surface"><div className="eyebrow">SCAN IN THREE STEPS</div><h2>Paper to office.<br /><span>Just like that.</span></h2><div className="scan-instructions"><div><span>01</span><p>Align the ticket or receipt in the frame.</p></div><div><span>02</span><p>Capture it, then rotate, crop or enhance.</p></div><div><span>03</span><p>Tag it and send all pages as one PDF.</p></div></div><Button className="w-full" icon={UploadCloud} onClick={() => fileInputRef.current?.click()} disabled={working}>{working ? "Opening photos..." : "Upload / take photo"}</Button><p className="scanner-side-hint">Camera unavailable? Upload works from photos and files too.</p></div></div>}
    {mode === "review" && <div className="scan-review-layout"><div className="scan-review-main surface"><div className="scan-review-top"><div><span className="eyebrow">REVIEW CAPTURE</span><h2>Make it legible.</h2></div><span className="mono">PAGE {currentPage + 1} / {pages.length}</span></div><div className="scan-image-stage">{pages[currentPage] && <img src={pages[currentPage]} alt={`Scanned document page ${currentPage + 1}`} />}</div><div className="scan-edit-tools"><Button icon={RotateCw} onClick={() => transform("rotate")} disabled={working}>Rotate</Button><Button icon={Crop} onClick={() => transform("crop")} disabled={working}>Auto-fit crop</Button><Button icon={SlidersHorizontal} onClick={() => transform("enhance")} disabled={working}>Enhance</Button><Button icon={Trash2} onClick={() => { const next = pages.filter((_, index) => index !== currentPage); setPages(next); setCurrentPage(Math.max(0, Math.min(currentPage, next.length - 1))); if (!next.length) setMode("capture"); toast.info("Page removed"); }}>Remove page</Button></div><div className="scan-thumbnails">{pages.map((page, index) => <button key={index} className={currentPage === index ? "active" : ""} onClick={() => setCurrentPage(index)} aria-label={`View page ${index + 1}`}><img src={page} alt="" /><span>{index + 1}</span></button>)}{pages.length < 10 && <button className="add-page" onClick={() => setMode("capture")} aria-label="Add another page"><ImagePlus size={23} /><span>ADD PAGE</span></button>}</div></div>
      <div className="scan-details surface"><div className="eyebrow">DOCUMENT DETAILS</div><h2>Label your scan</h2><p>Help the office know what they're looking at.</p><div className="field"><span className="field-label">Document type</span><ChoiceGroup value={type} options={documentTypes} onChange={setType} /></div><Field label="Note (optional)"><Textarea value={note} placeholder="e.g. Load 1 scale ticket #958348" onChange={(event) => setNote(event.target.value)} /></Field><Field label="Link to load on today's sheet (optional)"><Select value={loadId} onChange={(event) => setLoadId(event.target.value)}><option value="">No load linked</option>{draft?.status === "draft" && draft.loads.map((load, index) => <option key={load.id} value={load.id}>Load {index + 1}{load.ticket ? ` · Ticket ${load.ticket}` : ""}</option>)}</Select></Field><Button variant="primary" className="w-full" icon={Send} onClick={send} disabled={working}>Send {pages.length} page{pages.length === 1 ? "" : "s"} to Office <ArrowRight size={18} /></Button><p className="scan-privacy">The PDF is saved in this browser and appears live in the Office view.</p></div></div>}
    {mode === "sending" && <div className="scan-sending surface"><motion.div className="upload-graphic" initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ repeat: Infinity, repeatType: "reverse", duration: .5 }}><UploadCloud size={49} /></motion.div><h2>{state.simulateOffline ? "Saving scan offline..." : "Sending to Office..."}</h2><p>Preparing {pages.length} page{pages.length === 1 ? "" : "s"} as one PDF.</p><div className="upload-bar"><motion.span initial={{ width: "5%" }} animate={{ width: "100%" }} transition={{ duration: .85 }} /></div></div>}
    {mode === "success" && sentScan && <div className="scan-success"><div className="submitted-hero surface"><SuccessMark /><div><div className="eyebrow">{sentScan.status === "queued" ? "SAVED FOR SYNC" : "DELIVERED TO OFFICE"}</div><h2>{sentScan.status === "queued" ? "Scan queued." : "Scan sent."}</h2><p>{sentScan.pages.length} page{sentScan.pages.length === 1 ? "" : "s"} combined into a single {sentScan.type} PDF. {sentScan.status === "queued" ? "It will sync when you reconnect." : "The office has it now."}</p></div></div><PdfPreview key={sentScan.id} createPdf={() => scanPdf(sentScan, state)} filename={`${sentScan.type.toLowerCase().replace(/\s/g, "-")}-${sentScan.id.slice(-6)}.pdf`} minHeight={370} /><div className="wizard-actions"><Button onClick={goBack} icon={ArrowLeft}>{routeState?.returnTo ? "Return to Work Sheet" : "Back to Home"}</Button><Button variant="primary" icon={Camera} onClick={newScan}>Scan another document</Button></div></div>}
    {mode !== "sending" && <div className="scans-gallery"><div className="history-title"><div><div className="eyebrow">YOUR DOCUMENTS</div><h2>Today's scans</h2></div><span>{todayScans.length} document{todayScans.length === 1 ? "" : "s"}</span></div>{todayScans.length ? <div className="gallery-grid">{todayScans.map((scan) => <button className="gallery-entry" key={scan.id} onClick={() => setGalleryId(scan.id)}><div className="gallery-thumb">{scan.pages[0] ? <img src={scan.pages[0]} alt="" /> : <FileImage size={30} />}</div><div><strong>{scan.type}</strong><small>{scan.note || `${scan.pages.length} page${scan.pages.length === 1 ? "" : "s"}`} · {timeAgo(scan.createdAt)}</small></div><Badge tone={scan.status === "queued" ? "amber" : "green"}>{scan.status === "queued" ? "Queued" : "Sent"}</Badge></button>)}</div> : <EmptyState icon={ScanLine} title="No scans today" description="Capture a haul ticket or receipt and it will show up here." />}</div>}
    <input ref={fileInputRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Upload existing document pages" onChange={(event) => { if (event.target.files) addFiles(event.target.files); }} />
    <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a document photo" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
    <Drawer open={!!galleryScan} onOpenChange={(open) => { if (!open) setGalleryId(""); }} title="Scanned document">{galleryScan && <div className="scan-drawer"><div className="drawer-quick"><strong>{galleryScan.type}</strong><Badge tone={galleryScan.status === "queued" ? "amber" : "green"}>{galleryScan.status}</Badge></div><p>{galleryScan.note || "No note"} · {galleryScan.pages.length} page{galleryScan.pages.length === 1 ? "" : "s"}</p><PdfPreview key={galleryScan.id} createPdf={() => scanPdf(galleryScan, state)} filename={`${galleryScan.type.toLowerCase().replace(/\s/g, "-")}-${galleryScan.id.slice(-6)}.pdf`} minHeight={490} /></div>}</Drawer>
  </div>;
}
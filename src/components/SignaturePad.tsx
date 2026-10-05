import { useEffect, useRef } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "./ui";

interface Point { x: number; y: number }

export function SignaturePad({ value, onChange, label = "Signature" }: { value: string; onChange: (value: string) => void; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const importedRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const lastExportRef = useRef("");

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    if (importedRef.current) ctx.drawImage(importedRef.current, 0, 0, width, height);
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--signature-ink").trim() || "#1c314b";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokesRef.current.forEach((stroke) => {
      if (!stroke.length) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
      stroke.slice(1).forEach((point) => ctx.lineTo(point.x * width, point.y * height));
      if (stroke.length === 1) ctx.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height + 0.1);
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      redraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  });

  useEffect(() => {
    if (value === lastExportRef.current) return;
    strokesRef.current = [];
    if (!value) {
      importedRef.current = null;
      redraw();
      return;
    }
    const image = new Image();
    image.onload = () => { importedRef.current = image; redraw(); };
    image.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  };
  const emit = () => {
    redraw();
    const data = canvasRef.current?.toDataURL("image/png") || "";
    lastExportRef.current = data;
    onChange(data);
  };
  const clear = () => {
    strokesRef.current = [];
    importedRef.current = null;
    lastExportRef.current = "";
    redraw();
    onChange("");
  };
  const undo = () => {
    if (strokesRef.current.length) strokesRef.current.pop();
    else importedRef.current = null;
    if (!strokesRef.current.length && !importedRef.current) clear();
    else emit();
  };

  return <div className="signature-wrap"><div className="signature-top"><span className="field-label">{label}</span><div><Button type="button" variant="ghost" size="compact" icon={RotateCcw} onClick={undo} disabled={!value}>Undo</Button><Button type="button" variant="ghost" size="compact" icon={Trash2} onClick={clear} disabled={!value}>Clear</Button></div></div>
    <canvas ref={canvasRef} className="signature-canvas" aria-label={`${label} drawing area. Draw with a finger, mouse, or stylus.`} role="img" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drawingRef.current = true; strokesRef.current.push([point(event)]); redraw(); }} onPointerMove={(event) => { if (!drawingRef.current) return; strokesRef.current[strokesRef.current.length - 1]?.push(point(event)); redraw(); }} onPointerUp={() => { if (drawingRef.current) { drawingRef.current = false; emit(); } }} onPointerCancel={() => { if (drawingRef.current) { drawingRef.current = false; emit(); } }} />
    <span className="signature-hint">Sign in the area above with your finger or stylus.</span>
  </div>;
}
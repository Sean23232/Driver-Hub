import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Download, FileText, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Preset } from "../types";
import { cn } from "../utils/cn";
import { formatDate } from "../lib/helpers";
import type { jsPDF } from "jspdf";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "default" | "compact" | "icon";
  icon?: LucideIcon;
};

const buttonVariants = cva("ui-button", {
  variants: {
    variant: { primary: "ui-button-primary", secondary: "ui-button-secondary", ghost: "ui-button-ghost", danger: "ui-button-danger", success: "ui-button-success" },
    size: { default: "ui-button-default", compact: "ui-button-compact", icon: "ui-button-icon" },
  },
  defaultVariants: { variant: "secondary", size: "default" },
});

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "default", icon: Icon, className, children, ...props }, ref,
) {
  return <button ref={ref} type="button" className={cn(buttonVariants({ variant, size }), className)} {...props}>
    {Icon && <Icon size={19} strokeWidth={2.1} aria-hidden="true" />}{children}
  </button>;
});

export function IconButton({ label, icon: Icon, className, ...props }: Omit<ButtonProps, "children" | "icon"> & { label: string; icon: LucideIcon }) {
  return <Button size="icon" variant="ghost" className={className} aria-label={label} title={label} {...props}><Icon size={21} aria-hidden="true" /></Button>;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("ui-input", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("ui-input ui-textarea", className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return <select ref={ref} className={cn("ui-input ui-select", className)} {...props}>{children}</select>;
});

export function Field({ label, hint, required, children, className }: { label: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return <label className={cn("field", className)}><span className="field-label">{label}{required && <span className="text-amber"> *</span>}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={cn("brand", compact && "brand-compact")}>
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 44S7 31.5 7 20a17 17 0 0 1 34 0c0 11.5-17 24-17 24Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M13 25h23M15 18h14v10H15V18Zm14 3h4l3 4v3h-7v-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="29" r="2" fill="currentColor" /><circle cx="31" cy="29" r="2" fill="currentColor" />
      </svg>
    </span>
    <span className="brand-words"><strong>Driver <span>Hub</span></strong><small>by Samples Enterprise LLC</small></span>
  </div>;
}

export function Avatar({ name, size = "default" }: { name: string; size?: "default" | "large" }) {
  const initials = name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  return <span className={cn("avatar", size === "large" && "avatar-large")} aria-hidden="true">{initials}</span>;
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "amber" | "green" | "red" | "cyan"; className?: string }) {
  return <span className={cn("badge", `badge-${tone}`, className)}>{children}</span>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="section-action">{action}</div>}</div>;
}

export function BackLink({ onClick, label = "Back to Home" }: { onClick: () => void; label?: string }) {
  return <button className="back-link" onClick={onClick}><ArrowLeft size={18} />{label}</button>;
}

export function StepForward({ children = "Continue", ...props }: Omit<ButtonProps, "icon">) {
  return <Button variant="primary" {...props}>{children}<ArrowRight size={19} /></Button>;
}

export function ChoiceGroup<T extends string>({ value, options, onChange, className }: { value: T; options: readonly T[]; onChange: (value: T) => void; className?: string }) {
  return <div className={cn("choice-group", className)} role="group">{options.map((option) => <button key={option} className={cn("choice", value === option && "choice-active")} onClick={() => onChange(option)} type="button" aria-pressed={value === option}>{value === option && <Check size={16} />}{option}</button>)}</div>;
}

export function PresetPicker({ label, value, options, onChange, onSelect, placeholder, required = false }: {
  label: string; value: string; options: Preset[]; onChange: (value: string) => void; onSelect?: (item: Preset) => void; placeholder?: string; required?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const selected = options.find((item) => item.id === value || item.name === value);
  const filtered = options.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="picker"><span className="field-label">{label}{required && <span className="text-amber"> *</span>}</span>
    <div className="picker-search"><Search size={17} /><input aria-label={`Search or enter ${label.toLowerCase()}`} value={query} placeholder={selected ? selected.name : placeholder || `Search or enter ${label.toLowerCase()}...`} onChange={(event) => { setQuery(event.target.value); onChange(event.target.value); }} /></div>
    <div className="chip-row">{filtered.map((item) => <button key={item.id} type="button" className={cn("select-chip", (value === item.id || value === item.name) && "selected")} aria-pressed={value === item.id || value === item.name} onClick={() => { onChange(item.id); onSelect?.(item); setQuery(""); }}>{item.name}</button>)}
      {query && !filtered.some((item) => item.name.toLowerCase() === query.toLowerCase()) && <button type="button" className="select-chip custom-chip" onClick={() => { onChange(query); setQuery(""); }}>Use "{query}"</button>}
    </div>
  </div>;
}

export function EmptyState({ icon: Icon = FileText, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-illustration"><Icon size={34} strokeWidth={1.6} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function Modal({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="dialog-overlay" />
    <DialogPrimitive.Content className={cn("dialog-content", className)}>
      <div className="dialog-header"><div><DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description className="dialog-description">{description}</DialogPrimitive.Description>}</div><DialogPrimitive.Close asChild><IconButton label="Close dialog" icon={X} /></DialogPrimitive.Close></div>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal></DialogPrimitive.Root>;
}

export function Drawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="dialog-overlay" />
    <DialogPrimitive.Content className="drawer-content"><DialogPrimitive.Description className="sr-only">View the full report and available actions for {title.toLowerCase()}.</DialogPrimitive.Description><div className="dialog-header"><DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title><DialogPrimitive.Close asChild><IconButton label="Close details" icon={X} /></DialogPrimitive.Close></div><div className="drawer-scroll">{children}</div></DialogPrimitive.Content>
  </DialogPrimitive.Portal></DialogPrimitive.Root>;
}

export function PdfPreview({ createPdf, filename, minHeight = 330 }: { createPdf: () => jsPDF; filename: string; minHeight?: number }) {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      try {
        const blob = createPdf().output("blob");
        const next = URL.createObjectURL(blob);
        setUrl(next);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }, 100);
    return () => window.clearTimeout(timer);
    // The preview should regenerate when its parent remounts for a new record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return <div className="pdf-preview">
    <div className="pdf-preview-top"><span><FileText size={18} /> {filename}</span><Button size="compact" icon={Download} onClick={() => createPdf().save(filename)}>Download PDF</Button></div>
    {loading ? <div className="pdf-loading" style={{ minHeight }}><Skeleton className="h-8 w-2/3" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-40 w-full" /></div> : url ? <iframe title={`PDF preview of ${filename}`} src={`${url}#toolbar=0&navpanes=0`} className="pdf-frame" style={{ minHeight }} /> : <EmptyState title="Preview unavailable" description="The PDF could not be displayed. Try downloading it instead." />}
  </div>;
}

export function DateLine() {
  return <span>{formatDate(new Date().toLocaleDateString("en-CA"), { weekday: "long", month: "long", day: "numeric" })}</span>;
}

export function SuccessMark({ size = 74 }: { size?: number }) {
  return <motion.div className="success-mark" style={{ width: size, height: size }} initial={{ scale: 0.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 17 }}><motion.svg viewBox="0 0 52 52" width={size * 0.6} height={size * 0.6}><motion.path d="M12 27l10 10 19-23" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.22 }} /></motion.svg></motion.div>;
}
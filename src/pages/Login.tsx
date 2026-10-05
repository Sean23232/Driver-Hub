import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Delete, LockKeyhole, Truck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Brand, Button } from "../components/ui";
import { useHubStore } from "../store";

export default function Login() {
  const navigate = useNavigate();
  const drivers = useHubStore((state) => state.drivers);
  const login = useHubStore((state) => state.login);
  const activeDriverId = useHubStore((state) => state.activeDriverId);
  const [selected, setSelected] = useState(drivers[0]?.id || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [entering, setEntering] = useState(false);
  const driver = drivers.find((item) => item.id === selected);

  const submit = () => {
    if (pin.length !== 4) { setError("Enter your 4-digit PIN."); return; }
    if (!login(selected, pin)) { setError("That PIN doesn't match. Try again."); setPin(""); toast.error("Incorrect PIN"); return; }
    setError("");
    setEntering(true);
    toast.success(`Welcome back, ${driver?.name.split(" ")[0] || "driver"}`);
    window.setTimeout(() => navigate("/", { replace: true, state: { showGuide: true } }), 1150);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key) && pin.length < 4) { setPin((value) => value + event.key); setError(""); }
      else if (event.key === "Backspace") setPin((value) => value.slice(0, -1));
      else if (event.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selected]);

  return <div className="app-shell login-page"><div className="login-layout">
    <div className="login-story"><Brand /><div className="login-copy"><div className="eyebrow">THE ROAD, SIMPLIFIED</div><h1>Driver <span>Hub.</span></h1><p>Less paperwork. More road ahead.</p><div className="login-rule" /><span className="login-caption">A smarter day for the drivers of Samples Enterprise LLC.</span></div>
      <div className="road-scene" aria-hidden="true"><div className="road-glow" /><div className="road-lines" /><Truck size={68} strokeWidth={1.2} className="road-truck" /><span className="road-coordinate mono">33.7497 N  /  84.8950 W</span></div>
      <div className="login-bottom">LOCAL-FIRST FIELD OPERATIONS <span>ATLANTA, GEORGIA</span></div>
    </div>
    <div className="login-panel-wrap"><div className="login-panel glass">
      <div className="login-panel-top"><div className="login-lock"><LockKeyhole size={21} /></div><span>SECURE DRIVER ACCESS</span></div>
      <h2>Who is driving today?</h2><p>Choose your profile, then enter your four-digit PIN.</p>
      <div className="driver-options">{drivers.map((item) => <button key={item.id} type="button" className={`driver-option ${selected === item.id ? "active" : ""}`} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setPin(""); setError(""); }}><Avatar name={item.name} /><span>{item.name}</span></button>)}</div>
      <div className="pin-heading"><span>ENTER PIN</span><span className="mono">{driver?.truckId} / {driver?.trailerId}</span></div>
      <div className="pin-display" role="status" aria-live="polite" aria-label={`${pin.length} of 4 PIN digits entered`}>{[0, 1, 2, 3].map((index) => <span key={index} className={index < pin.length ? "filled" : ""} />)}</div>
      <div className="pin-keypad">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => <button key={number} onClick={() => { setPin((value) => value.length < 4 ? value + number : value); setError(""); }} aria-label={`PIN digit ${number}`}>{number}</button>)}<button className="pin-special" onClick={() => { setPin(""); setError(""); }} aria-label="Clear PIN">CLR</button><button onClick={() => { setPin((value) => value.length < 4 ? value + "0" : value); setError(""); }} aria-label="PIN digit 0">0</button><button className="pin-special" onClick={() => setPin((value) => value.slice(0, -1))} aria-label="Delete last digit"><Delete size={20} /></button></div>
      {error ? <p className="pin-error" role="alert">{error}</p> : <p className="pin-hint">Demo PINs: Marlin 1111 · Shane 2222 · Demo 3333</p>}
      <Button variant="primary" className="w-full" onClick={submit} disabled={entering}>Enter Driver Hub <ArrowRight size={19} /></Button>
    </div><div className="login-exit"><button onClick={() => navigate(activeDriverId ? "/" : "/office")}><ArrowLeft size={16} /> {activeDriverId ? "Back to dashboard" : "Explore Office demo"}</button><span>Concept by Web Designs Lab.</span></div></div>
  </div>
  <AnimatePresence>{entering && <motion.div className="truck-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="intro-road" /><motion.div initial={{ x: -170, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 150, damping: 18 }}><Truck size={86} strokeWidth={1.4} /></motion.div><Brand /><p>Ready for the road, {driver?.name.split(" ")[0]}.</p></motion.div>}</AnimatePresence>
  </div>;
}
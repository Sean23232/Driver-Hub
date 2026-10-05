import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, ScaleControl, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, Compass, Crosshair, Layers3, LoaderCircle, MapPin, Minus, Navigation, Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Preset } from "../types";
import { Button, IconButton } from "../components/ui";
import { useHubStore } from "../store";

type MapMode = "Satellite" | "Satellite + Labels" | "Streets";
interface Focus { lat: number; lng: number; zoom: number }

const satellite = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const labels = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const streets = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const esriCredit = "Tiles &copy; Esri; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const yard: Preset = { id: "yard", name: "Samples Yard", address: "658 Little Circle, Tallapoosa, GA 30176 (demo location)", lat: 33.7445, lng: -85.2882 };

const truckIcon = L.divIcon({
  className: "truck-map-icon",
  html: `<div class="marker-ring"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
  iconSize: [56, 65], iconAnchor: [28, 57], popupAnchor: [0, -48],
});

function FlyTo({ focus }: { focus: Focus }) {
  const map = useMap();
  useEffect(() => { map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 1.1 }); }, [map, focus]);
  return null;
}

function milesBetween(a: [number, number], b: [number, number]) {
  const radians = (degree: number) => degree * Math.PI / 180;
  const latitude = radians(b[0] - a[0]);
  const longitude = radians(b[1] - a[1]);
  const arc = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(longitude / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export default function MapPage() {
  const navigate = useNavigate();
  const state = useHubStore();
  const mapRef = useRef<L.Map | null>(null);
  const [mode, setMode] = useState<MapMode>("Satellite + Labels");
  const [focus, setFocus] = useState<Focus>({ lat: 33.856, lng: -84.54, zoom: 10 });
  const [destination, setDestination] = useState<Preset>(state.deliveries[0] || yard);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<Preset[]>([]);

  const savedLocations = useMemo(() => {
    const all = [...state.jobSites, ...state.deliveries, ...state.pickups, yard];
    return all.filter((item, index) => item.lat != null && item.lng != null && all.findIndex((other) => other.name === item.name) === index);
  }, [state.jobSites, state.deliveries, state.pickups]);
  const jumps = [state.jobSites[0], state.deliveries[0], yard].filter(Boolean);
  const distance = destination.lat != null && destination.lng != null ? milesBetween(myLocation || [yard.lat!, yard.lng!], [destination.lat, destination.lng]) : 0;

  const jumpTo = (place: Preset) => {
    if (place.lat == null || place.lng == null) { toast.error("This location needs coordinates in Office presets."); return; }
    setFocus({ lat: place.lat, lng: place.lng, zoom: 14 });
    setDestination(place);
    setResults([]);
    setSearchError("");
  };
  const locate = () => {
    if (!navigator.geolocation) { setFocus({ lat: yard.lat!, lng: yard.lng!, zoom: 13 }); toast.info("Location unavailable. Showing the demo yard instead."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      const point: [number, number] = [position.coords.latitude, position.coords.longitude];
      setMyLocation(point);
      setFocus({ lat: point[0], lng: point[1], zoom: 14 });
      toast.success("Centered on your location");
    }, () => { setFocus({ lat: yard.lat!, lng: yard.lng!, zoom: 13 }); toast.info("Location access denied. Showing the demo yard instead."); }, { enableHighAccuracy: true, timeout: 9000 });
  };
  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim().length < 3) { setSearchError("Enter at least 3 characters to search."); return; }
    setSearching(true); setSearchError(""); setResults([]);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query.trim());
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      const response = await fetch(url.toString(), { headers: { "Accept-Language": "en-US,en;q=0.9" } });
      if (!response.ok) throw new Error("Search service is unavailable right now.");
      const matches = await response.json() as { place_id: number; display_name: string; lat: string; lon: string }[];
      const places = matches.map((item) => ({ id: `search-${item.place_id}`, name: item.display_name.split(",")[0], address: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }));
      setResults(places);
      if (!places.length) setSearchError("No places found. Try a more specific address or a saved location.");
    } catch { setSearchError("Can't reach place search right now. Saved locations still work."); }
    finally { setSearching(false); }
  };
  const openDirections = () => {
    const target = destination.lat != null && destination.lng != null ? `${destination.lat},${destination.lng}` : destination.address || destination.name;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`, "_blank", "noopener,noreferrer");
  };

  return <div className="map-page"><div className="map-canvas"><MapContainer center={[focus.lat, focus.lng]} zoom={focus.zoom} zoomControl={false} scrollWheelZoom={true} ref={mapRef} className="leaflet-map" attributionControl={true}>
    <FlyTo focus={focus} />
    {mode === "Streets" ? <TileLayer url={streets} attribution={esriCredit} maxZoom={19} /> : <><TileLayer url={satellite} attribution={esriCredit} maxZoom={19} />{mode === "Satellite + Labels" && <TileLayer url={labels} attribution="Labels &copy; Esri" maxZoom={19} />}</>}
    <ScaleControl position="bottomright" imperial metric={false} />
    {savedLocations.map((place) => <Marker key={place.id} position={[place.lat!, place.lng!]} icon={truckIcon}><Popup><div className="map-popup"><strong>{place.name}</strong><p>{place.address || "Atlanta area (demo location)"}</p><button onClick={() => jumpTo(place)}>Set as destination <ArrowUpRight size={15} /></button></div></Popup></Marker>)}
    {results.map((place) => <Marker key={place.id} position={[place.lat!, place.lng!]} icon={truckIcon}><Popup><div className="map-popup"><strong>{place.name}</strong><p>{place.address}</p><button onClick={() => jumpTo(place)}>Set as destination <ArrowUpRight size={15} /></button></div></Popup></Marker>)}
    {myLocation && <Marker position={myLocation}><Popup>You're here</Popup></Marker>}
  </MapContainer></div>
    <div className="map-topbar"><Button icon={ArrowLeft} onClick={() => navigate("/")} className="map-back">Home</Button><div className="map-title"><Navigation size={18} /><span>SATELLITE MAP</span><small>DEMO LOCATIONS</small></div></div>
    <div className="map-left-panel glass"><div className="map-panel-heading"><span className="eyebrow">FIND YOUR WAY</span><h1>Where to?</h1><p>Search an address or jump to a saved stop.</p></div><form className="map-search" onSubmit={search}><Search size={19} /><input aria-label="Search for a location" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an address or place" /><button aria-label={searching ? "Searching" : "Search"} disabled={searching} type="submit">{searching ? <LoaderCircle size={20} className="animate-spin" /> : <ArrowUpRight size={20} />}</button></form>
      {searchError && <p className="map-search-error" role="status">{searchError}</p>}
      {!!results.length && <div className="map-results">{results.map((place) => <button key={place.id} onClick={() => jumpTo(place)}><MapPin size={16} /><span><strong>{place.name}</strong><small>{place.address}</small></span></button>)}<button className="clear-search" onClick={() => { setResults([]); setQuery(""); }}><X size={15} /> Clear results</button></div>}
      <div className="map-saved-title">QUICK JUMP <span>OFFICE-SAVED · DEMO DATA</span></div><div className="map-jumps">{jumps.map((place) => <button key={place.id} onClick={() => jumpTo(place)}><span><MapPin size={17} /></span><strong>{place.name === "Samples Yard" ? "Yard" : place.name}</strong><ArrowUpRight size={15} /></button>)}</div>
    </div>
    <div className="map-controls glass"><IconButton label="Zoom in" icon={Plus} onClick={() => mapRef.current?.zoomIn()} /><IconButton label="Zoom out" icon={Minus} onClick={() => mapRef.current?.zoomOut()} /><div className="control-separator" /><IconButton label="My location" icon={Crosshair} onClick={locate} /><IconButton label="North-up overview" icon={Compass} onClick={() => { setFocus({ lat: 33.856, lng: -84.54, zoom: 10 }); toast.info("North-up Atlanta overview restored"); }} /></div>
    <div className="map-mode glass"><Layers3 size={17} /><select aria-label="Map layer" value={mode} onChange={(event) => setMode(event.target.value as MapMode)}><option>Satellite</option><option>Satellite + Labels</option><option>Streets</option></select></div>
    <div className="destination-panel glass"><div className="destination-icon"><Navigation size={22} fill="currentColor" /></div><div className="destination-copy"><small>CURRENT DESTINATION</small><strong>{destination.name}</strong><span>{destination.address || "Atlanta area · Demo location"}</span></div><div className="destination-distance"><strong className="heading-font">{distance.toFixed(1)} <small>mi</small></strong><span>straight line {myLocation ? "from you" : "from demo yard"}</span></div><Button variant="primary" icon={ArrowUpRight} onClick={openDirections}>Open in Google Maps</Button></div>
  </div>;
}
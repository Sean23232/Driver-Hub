import { jsPDF } from "jspdf";
import type { DailySheet, HubData, Inspection, Scan } from "../types";
import { displayName, duration, formatDate, formatTons, totalTons } from "./helpers";

const amber: [number, number, number] = [225, 139, 24];
const navy: [number, number, number] = [17, 31, 51];
const gray: [number, number, number] = [96, 111, 128];
const paper = () => new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

function header(doc: jsPDF, title: string, number: string) {
  doc.setFillColor(...navy);
  doc.rect(0, 0, 216, 29, "F");
  doc.setFillColor(...amber);
  doc.roundedRect(12, 9, 9, 9, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SAMPLES ENTERPRISE LLC", 26, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("658 Little Circle  |  Tallapoosa, GA 30176", 26, 20);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 12, 40);
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text(number, 203, 40, { align: "right" });
  doc.setDrawColor(219, 225, 231);
  doc.line(12, 44, 204, 44);
}

function labelValue(doc: jsPDF, label: string, value: string, x: number, y: number, width = 88) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...navy);
  const clipped = doc.splitTextToSize(value || "--", width);
  doc.text(clipped[0] || "--", x, y + 5);
}

function section(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(242, 245, 248);
  doc.roundedRect(12, y - 5, 192, 9, 1, 1, "F");
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(title.toUpperCase(), 16, y + 0.5);
}

function footer(doc: jsPDF, name: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(220, 226, 232);
    doc.line(12, 265, 204, 265);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text("Samples Enterprise LLC  |  Digitally prepared in Driver Hub", 12, 271);
    doc.text(`${name}  |  Page ${page} of ${pages}`, 204, 271, { align: "right" });
  }
}

function signature(doc: jsPDF, data: string, x: number, y: number, width = 52) {
  if (!data) return;
  try {
    doc.addImage(data, "PNG", x, y, width, 17, undefined, "FAST");
  } catch {
    // A missing image should not prevent the rest of a valid report from downloading.
  }
}

export function sheetPdf(sheet: DailySheet, data: HubData) {
  const doc = paper();
  header(doc, "DAILY WORK SHEET", sheet.invoice);
  labelValue(doc, "Customer", displayName(sheet.customerId, data.customers), 12, 52);
  labelValue(doc, "Date", formatDate(sheet.date), 112, 52);
  labelValue(doc, "Driver", displayName(sheet.driverId, data.drivers), 12, 66);
  labelValue(doc, "Vehicle type", sheet.vehicleType, 112, 66);
  labelValue(doc, "Truck / Trailer", `${sheet.truck}  /  ${sheet.trailer}`, 12, 80);
  labelValue(doc, "Job # / PO #", `${sheet.jobNumber || "--"}  /  ${sheet.poNumber || "--"}`, 112, 80);
  labelValue(doc, "Start / End / Hours", `${sheet.startTime || "--"}  /  ${sheet.endTime || "--"}  /  ${sheet.endTime ? duration(sheet.startTime, sheet.endTime) : "--"}`, 12, 94);
  labelValue(doc, "Job site", sheet.jobSite, 112, 94);
  labelValue(doc, "Pickup location(s)", sheet.pickup, 12, 108);
  labelValue(doc, "Delivery location(s)", sheet.delivery, 112, 108);

  section(doc, "Material & haul tickets", 124);
  let y = 135;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("LOAD", 16, y);
  doc.text("MATERIAL", 38, y);
  doc.text("TICKET NO.", 112, y);
  doc.text("TONS", 199, y, { align: "right" });
  y += 3;
  doc.setDrawColor(221, 227, 232);
  doc.line(12, y, 204, y);
  sheet.loads.forEach((load, index) => {
    if (y > 222) {
      doc.addPage();
      header(doc, "DAILY WORK SHEET", `${sheet.invoice} (cont.)`);
      y = 51;
    }
    y += 8;
    doc.setTextColor(...navy);
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(String(index + 1).padStart(2, "0"), 16, y);
    doc.setFont("helvetica", "normal");
    doc.text((load.material === "Other" ? load.otherMaterial : load.material) || "--", 38, y);
    doc.setFont("courier", "normal");
    doc.text(load.ticket || "--", 112, y);
    doc.text(formatTons(Number(load.tons) || 0), 199, y, { align: "right" });
    doc.setDrawColor(235, 238, 241);
    doc.line(12, y + 3, 204, y + 3);
  });
  y += 12;
  doc.setFillColor(255, 248, 235);
  doc.roundedRect(12, y - 6, 192, 12, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text(`${sheet.loads.length} LOAD${sheet.loads.length === 1 ? "" : "S"}`, 17, y + 1);
  doc.text(`TOTAL  ${formatTons(totalTons(sheet.loads))} TONS`, 199, y + 1, { align: "right" });

  if (y > 196) {
    doc.addPage();
    header(doc, "DAILY WORK SHEET", `${sheet.invoice} (cont.)`);
    y = 50;
  }
  section(doc, "Notes & customer authorization", y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  const noteLines = doc.splitTextToSize(sheet.notes || "No additional notes.", 180) as string[];
  doc.text(noteLines.slice(0, 3), 16, y + 26);
  signature(doc, sheet.signature, 15, y + 37);
  doc.setDrawColor(128, 140, 152);
  doc.line(15, y + 56, 90, y + 56);
  doc.line(111, y + 56, 199, y + 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text(`Customer signature  |  ${sheet.signedName || "--"}`, 15, y + 61);
  doc.text(`Signed  ${sheet.signedAt ? new Date(sheet.signedAt).toLocaleString("en-US") : "--"}`, 111, y + 61);
  if (noteLines.length > 3) {
    doc.addPage();
    header(doc, "ADDITIONAL WORK NOTES", sheet.invoice);
    section(doc, "Complete notes", 54);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...navy);
    let noteY = 67;
    noteLines.forEach((line) => {
      if (noteY > 251) { doc.addPage(); header(doc, "ADDITIONAL WORK NOTES", sheet.invoice); noteY = 55; }
      doc.text(line, 16, noteY);
      noteY += 5;
    });
  }
  footer(doc, sheet.invoice);
  return doc;
}

export const TRACTOR_ITEMS = [
  ["Air Compressor", "Air Lines", "Battery", "Belts and Hoses", "Body", "Brake Accessories", "Brakes (Parking)", "Brakes (Service)", "Clutch", "Coupling Devices", "Defroster/Heater", "Drive Line", "Engine", "Exhaust", "Fifth Wheel", "Fluid Levels", "Frame and Assembly"],
  ["Front Axle", "Fuel Tanks", "Horn", "Lights (Head/Stop)", "Lights (Tail/Dash)", "Lights (Turn Indicators)", "Lights (Clearance/Marker)", "Mirrors", "Muffler", "Oil Pressure", "Radiator", "Rear End", "Reflectors"],
  ["Fire Extinguisher", "Flags/Flares/Fusees", "Reflective Triangles", "Spare Bulbs and Fuses", "Spare Seal Beam", "Starter", "Steering", "Suspension System", "Tire Chains", "Tires", "Transmission", "Trip Recorder", "Wheels and Rims", "Windows", "Windshield Wipers", "Other (Truck)"],
];

export const TRAILER_ITEMS = [
  "Brake Connections", "Brakes", "Coupling Devices", "Coupling (King) Pin", "Doors", "Hitch", "Landing Gear",
  "Lights (All)", "Reflectors/Reflective Tape", "Roof", "Suspension System", "Tarpaulin", "Tires", "Wheels and Rims", "Other (Trailer)",
];

export function inspectionPdf(inspection: Inspection, data: HubData) {
  const doc = paper();
  header(doc, "DRIVER'S VEHICLE INSPECTION REPORT", inspection.truck);
  labelValue(doc, "Carrier", "Samples Enterprise LLC", 12, 51);
  labelValue(doc, "Date / Time", `${formatDate(inspection.date)}  ${inspection.time}`, 112, 51);
  labelValue(doc, "Driver", displayName(inspection.driverId, data.drivers), 12, 64);
  labelValue(doc, "Truck / Trailer", `${inspection.truck}  /  ${inspection.trailer}`, 112, 64);
  labelValue(doc, "Odometer reading", `${Number(inspection.odometer).toLocaleString("en-US")} mi`, 12, 77);
  labelValue(doc, "Condition", inspection.condition === "satisfactory" ? "Satisfactory" : "Defects need correction", 112, 77);
  section(doc, "Tractor / truck  ·  marked items are defective", 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...gray);
  doc.text("SAFETY EQUIPMENT", 145, 100);
  TRACTOR_ITEMS.forEach((column, columnIndex) => {
    column.forEach((item, index) => {
      const x = 15 + columnIndex * 65;
      const y = (columnIndex === 2 ? 105 : 101) + index * 4.45;
      const flagged = inspection.defects.some((defect) => defect.item === item || defect.item === `Truck: ${item}`);
      doc.setDrawColor(flagged ? 205 : 165, flagged ? 55 : 177, flagged ? 55 : 188);
      doc.rect(x, y - 2.8, 3, 3);
      if (flagged) {
        doc.setTextColor(190, 42, 42);
        doc.text("X", x + 0.55, y - 0.2);
      }
      doc.setFont("helvetica", flagged ? "bold" : "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(flagged ? 180 : 39, flagged ? 44 : 53, flagged ? 44 : 65);
      doc.text(item, x + 5, y);
    });
  });
  section(doc, `Trailer(s) no.(s) ${inspection.trailer}`, 181);
  TRAILER_ITEMS.forEach((item, index) => {
    const column = Math.floor(index / 5);
    const row = index % 5;
    const x = 15 + column * 65;
    const y = 190 + row * 5;
    const flagged = inspection.defects.some((defect) => defect.item === item || defect.item === `Trailer: ${item}`);
    doc.setDrawColor(flagged ? 205 : 165, flagged ? 55 : 177, flagged ? 55 : 188);
    doc.rect(x, y - 2.8, 3, 3);
    if (flagged) {
      doc.setTextColor(190, 42, 42);
      doc.text("X", x + 0.55, y - 0.2);
    }
    doc.setFont("helvetica", flagged ? "bold" : "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...navy);
    doc.text(item, x + 5, y);
  });
  section(doc, "Remarks / defect detail", 220);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const remarks = [inspection.remarks, ...inspection.defects.map((defect) => `${defect.item}: ${defect.description}`)].filter(Boolean).join("  |  ") || "No defects reported. Vehicle condition is satisfactory.";
  const remarkLines = doc.splitTextToSize(remarks, 183) as string[];
  doc.text(remarkLines.slice(0, 2), 16, 229);
  signature(doc, inspection.signature, 15, 238, 40);
  doc.setFontSize(7);
  doc.setTextColor(...gray);
  doc.text(`Driver signature: ${displayName(inspection.driverId, data.drivers)}  |  ${inspection.signedAt ? new Date(inspection.signedAt).toLocaleString("en-US") : "--"}`, 15, 260);
  if (inspection.mechanicName || inspection.defects.length || remarkLines.length > 2) {
    doc.addPage();
    header(doc, "DEFECT DETAIL & CORRECTION", inspection.truck);
    let y = 54;
    if (remarkLines.length > 2) {
      section(doc, "Complete driver remarks", y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      remarkLines.forEach((line) => {
        if (y > 248) { doc.addPage(); header(doc, "DEFECT DETAIL & CORRECTION", inspection.truck); y = 54; }
        doc.text(line, 16, y);
        y += 4.5;
      });
      y += 10;
    }
    inspection.defects.forEach((defect, index) => {
      if (y + (defect.photo ? 70 : 22) > 252) { doc.addPage(); header(doc, "DEFECT DETAIL & CORRECTION", inspection.truck); y = 54; }
      labelValue(doc, `Defect ${index + 1}  ·  ${defect.item}`, defect.description, 12, y, 180);
      y += 18;
      if (defect.photo) {
        try { doc.addImage(defect.photo, "JPEG", 12, y, 60, 42, undefined, "FAST"); y += 48; } catch { /* keep text report */ }
      }
    });
    if (!inspection.defects.length && remarkLines.length <= 2) doc.text("No defects were reported.", 12, y);
    y = Math.max(y + 12, 120);
    if (y + 58 > 250) { doc.addPage(); header(doc, "DEFECT DETAIL & CORRECTION", inspection.truck); y = 54; }
    section(doc, "Office use only", y);
    labelValue(doc, "Mechanic", inspection.mechanicName || "Pending office review", 12, y + 13);
    labelValue(doc, "Disposition", inspection.resolution === "corrected" ? "Above defects corrected" : inspection.resolution === "not-required" ? "Above defects need not be corrected for safe operation" : "Pending", 12, y + 28, 180);
    signature(doc, inspection.mechanicSignature || "", 12, y + 36);
  }
  footer(doc, inspection.truck);
  return doc;
}

export function scanPdf(scan: Scan, data: HubData) {
  const doc = paper();
  if (!scan.pages.length) {
    header(doc, scan.type.toUpperCase(), scan.id.slice(-8).toUpperCase());
    labelValue(doc, "Driver", displayName(scan.driverId, data.drivers), 12, 56);
    labelValue(doc, "Received", new Date(scan.createdAt).toLocaleString("en-US"), 112, 56);
    section(doc, "Document record", 78);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text(doc.splitTextToSize(scan.note || "Document logged by driver.", 180), 16, 90);
    doc.setTextColor(...gray);
    doc.setFontSize(8);
    doc.text("Demo record: no source photograph was attached to this seeded entry.", 16, 110);
    footer(doc, scan.type);
    return doc;
  }
  scan.pages.forEach((page, index) => {
    if (index) doc.addPage();
    header(doc, scan.type.toUpperCase(), `${index + 1} / ${scan.pages.length}`);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(`${displayName(scan.driverId, data.drivers)}  |  ${new Date(scan.createdAt).toLocaleString("en-US")}  |  ${scan.note || "No note"}`, 12, 37);
    try {
      const props = doc.getImageProperties(page);
      const ratio = props.width / props.height;
      const maxW = 188;
      const maxH = 207;
      const width = Math.min(maxW, maxH * ratio);
      const height = width / ratio;
      doc.addImage(page, "JPEG", (216 - width) / 2, 46 + (207 - height) / 2, width, height, undefined, "FAST");
    } catch {
      doc.text("Image preview unavailable", 20, 80);
    }
  });
  footer(doc, scan.type);
  return doc;
}
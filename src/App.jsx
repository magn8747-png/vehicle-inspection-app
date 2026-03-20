import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const runtimeEnv = typeof import.meta !== "undefined" ? import.meta.env || {} : {};
const SUPABASE_URL = runtimeEnv.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY =
  runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY || runtimeEnv.VITE_SUPABASE_ANON_KEY || "";

const TABLE_NAME = "vehicle_hygiene_inspections";
const LOCAL_STORAGE_KEY = "vehicle-hygiene-inspections-demo";

const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

const checklistItems = [
  ["freeFromOdor", "Free from unusual odor"],
  ["freeFromDustDirt", "Free from dust and dirt"],
  ["noCondensationMoisture", "No condensation or moisture"],
  ["noPests", "No pests"],
  ["noMold", "No mold"],
  ["generalConditionOk", "General condition OK"],
];

const initialChecks = {
  freeFromOdor: false,
  freeFromDustDirt: false,
  noCondensationMoisture: false,
  noPests: false,
  noMold: false,
  generalConditionOk: false,
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCurrentLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toInputDateTime(value) {
  if (!value) return getCurrentLocalDateTime();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getCurrentLocalDateTime();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoString(localDateTime) {
  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createEmptyForm() {
  return {
    inspectionDateTime: getCurrentLocalDateTime(),
    driverName: "",
    vehicleNumber: "",
    inspector: "",
    customerName: "",
    carrier: "",
    temperature: "",
    comments: "",
    status: "approved",
    checks: { ...initialChecks },
  };
}

function validateForm(form) {
  const errors = [];
  if (!form.inspectionDateTime) errors.push("Date and time are required.");
  if (!form.driverName.trim()) errors.push("Driver name is required.");
  if (!form.vehicleNumber.trim()) errors.push("Vehicle number is required.");
  if (!form.inspector.trim()) errors.push("Inspector is required.");
  if (!["approved", "rejected"].includes(form.status)) {
    errors.push("Result must be Approved or Rejected.");
  }
  return errors;
}

function mapFormToRow(form) {
  return {
    inspection_datetime: toIsoString(form.inspectionDateTime),
    driver_name: form.driverName.trim(),
    vehicle_number: form.vehicleNumber.trim(),
    inspector: form.inspector.trim(),
    customer_name: form.customerName.trim(),
    carrier: form.carrier.trim(),
    free_from_unusual_odor: form.checks.freeFromOdor,
    free_from_dust_and_dirt: form.checks.freeFromDustDirt,
    no_condensation_or_moisture: form.checks.noCondensationMoisture,
    no_pests: form.checks.noPests,
    no_mold: form.checks.noMold,
    general_condition_ok: form.checks.generalConditionOk,
    temperature: form.temperature.trim(),
    comments: form.comments.trim(),
    status: form.status,
  };
}

function mapRowToInspection(row) {
  return {
    id: row.id,
    inspectionDateTime: row.inspection_datetime,
    driverName: row.driver_name,
    vehicleNumber: row.vehicle_number,
    inspector: row.inspector,
    customerName: row.customer_name || "",
    carrier: row.carrier || "",
    temperature: row.temperature || "",
    comments: row.comments || "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    checks: {
      freeFromOdor: !!row.free_from_unusual_odor,
      freeFromDustDirt: !!row.free_from_dust_and_dirt,
      noCondensationMoisture: !!row.no_condensation_or_moisture,
      noPests: !!row.no_pests,
      noMold: !!row.no_mold,
      generalConditionOk: !!row.general_condition_ok,
    },
  };
}

function sortByInspectionDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.inspectionDateTime) - new Date(a.inspectionDateTime));
}

function readDemoData() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDemoData(items) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
}

function buildCsvString(rows) {
  const headers = [
    "Inspection date and time",
    "Driver name",
    "Vehicle number",
    "Inspector",
    "Customer name",
    "Carrier",
    "Free from unusual odor",
    "Free from dust and dirt",
    "No condensation or moisture",
    "No pests",
    "No mold",
    "General condition OK",
    "Temperature",
    "Comments",
    "Status",
    "Created at",
    "Updated at",
  ];

  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  const lines = rows.map((row) => [
    row.inspectionDateTime,
    row.driverName,
    row.vehicleNumber,
    row.inspector,
    row.customerName,
    row.carrier,
    row.checks.freeFromOdor,
    row.checks.freeFromDustDirt,
    row.checks.noCondensationMoisture,
    row.checks.noPests,
    row.checks.noMold,
    row.checks.generalConditionOk,
    row.temperature,
    row.comments,
    row.status,
    row.createdAt,
    row.updatedAt,
  ]);

  return [headers, ...lines]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}

function downloadCsv(rows) {
  const csv = buildCsvString(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vehicle-hygiene-inspections-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadInspectionPdf(inspection) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Vehicle Hygiene Inspection Report", 40, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${formatDisplayDate(new Date().toISOString())}`, pageWidth - 40, 48, { align: "right" });

  autoTable(doc, {
    startY: 72,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 150 },
      1: { cellWidth: pageWidth - 230 },
    },
    body: [
      ["Inspection date", formatDisplayDate(inspection.inspectionDateTime)],
      ["Driver name", inspection.driverName || "-"],
      ["Vehicle number", inspection.vehicleNumber || "-"],
      ["Inspector", inspection.inspector || "-"],
      ["Customer name", inspection.customerName || "-"],
      ["Carrier", inspection.carrier || "-"],
      ["Temperature", inspection.temperature || "-"],
      ["Status", inspection.status === "approved" ? "Approved" : "Rejected"],
      ["Created at", formatDisplayDate(inspection.createdAt)],
      ["Last updated", formatDisplayDate(inspection.updatedAt)],
    ],
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [15, 23, 42] },
    body: checklistItems.map(([key, label]) => [label, inspection.checks[key] ? "Yes" : "No"]),
    columns: [
      { header: "Checklist item", dataKey: 0 },
      { header: "Result", dataKey: 1 },
    ],
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6, valign: "top" },
    headStyles: { fillColor: [15, 23, 42] },
    body: [["Comments", inspection.comments || "No comments added."]],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 150 },
      1: { cellWidth: pageWidth - 230 },
    },
  });

  const safeVehicle = (inspection.vehicleNumber || "vehicle").replace(/[^a-z0-9-_]+/gi, "-");
  const safeDate = new Date(inspection.inspectionDateTime || Date.now()).toISOString().slice(0, 10);
  doc.save(`inspection-report-${safeVehicle}-${safeDate}.pdf`);
}

function runSelfTests() {
  const sampleRow = {
    inspectionDateTime: "2026-03-19T10:00:00.000Z",
    driverName: 'Jane "JJ" Doe',
    vehicleNumber: "V-42",
    inspector: "Inspector A",
    customerName: "Frankly Juice",
    carrier: "Internal Fleet",
    temperature: "3°C",
    comments: "Line 1, Line 2",
    status: "approved",
    createdAt: "2026-03-19T10:01:00.000Z",
    updatedAt: "2026-03-19T10:02:00.000Z",
    checks: {
      freeFromOdor: true,
      freeFromDustDirt: true,
      noCondensationMoisture: true,
      noPests: true,
      noMold: true,
      generalConditionOk: true,
    },
  };

  const csv = buildCsvString([sampleRow]);
  console.assert(csv.includes("
"), "CSV should contain newline separators.");
  console.assert(csv.includes('"Jane ""JJ"" Doe"'), "CSV should escape quotes.");
  console.assert(csv.includes("Customer name"), "CSV should include customer name header.");
}

if (typeof window !== "undefined") {
  runSelfTests();
}

function AppButton({ children, variant = "primary", className = "", ...props }) {
  const base =
    "min-h-11 rounded-2xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "secondary"
      ? "border border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-white"
      : variant === "danger"
      ? "bg-red-600 text-white shadow-sm hover:bg-red-700"
      : "bg-slate-900 text-white shadow-sm hover:bg-slate-800";

  return (
    <button {...props} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function CardShell({ title, description, children, aside }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-[130px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
}

export default function VehicleInspectionApp() {
  const [form, setForm] = useState(createEmptyForm());
  const [inspections, setInspections] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const mode = supabase ? "cloud" : "demo";

  const loadInspections = useCallback(async () => {
    setError("");

    if (!supabase) {
      const demoRows = readDemoData();
      setInspections(sortByInspectionDateDesc(demoRows));
      setLastSyncedAt(new Date().toISOString());
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .order("inspection_datetime", { ascending: false })
        .limit(500);

      if (fetchError) throw fetchError;
      setInspections((data || []).map(mapRowToInspection));
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setError(err.message || "Failed to load inspections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  useEffect(() => {
    if (!supabase) return undefined;

    const channel = supabase
      .channel("vehicle-hygiene-inspections-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME },
        () => {
          loadInspections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInspections]);

  const approvedCount = useMemo(
    () => inspections.filter((item) => item.status === "approved").length,
    [inspections]
  );

  const rejectedCount = useMemo(
    () => inspections.filter((item) => item.status === "rejected").length,
    [inspections]
  );

  const allChecksPassed = useMemo(() => Object.values(form.checks).every(Boolean), [form.checks]);

  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const haystack = [
        item.driverName,
        item.vehicleNumber,
        item.inspector,
        item.customerName,
        item.carrier,
        item.temperature,
        item.comments,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search.toLowerCase()) && (statusFilter === "all" || item.status === statusFilter);
    });
  }, [inspections, search, statusFilter]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setCheck = (field, value) => {
    setForm((prev) => ({
      ...prev,
      checks: {
        ...prev.checks,
        [field]: !!value,
      },
    }));
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingId(null);
    setMessage("");
    setError("");
  };

  const saveInspection = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const errors = validateForm(form);
    if (errors.length > 0) {
      setError(errors.join(" "));
      return;
    }

    setSaving(true);

    try {
      if (!supabase) {
        const current = readDemoData();
        const now = new Date().toISOString();

        if (editingId) {
          const updated = current.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  inspectionDateTime: toIsoString(form.inspectionDateTime),
                  driverName: form.driverName.trim(),
                  vehicleNumber: form.vehicleNumber.trim(),
                  inspector: form.inspector.trim(),
                  customerName: form.customerName.trim(),
                  carrier: form.carrier.trim(),
                  temperature: form.temperature.trim(),
                  comments: form.comments.trim(),
                  status: form.status,
                  checks: { ...form.checks },
                  updatedAt: now,
                }
              : item
          );

          writeDemoData(updated);
          setInspections(sortByInspectionDateDesc(updated));
          setMessage("Inspection updated in preview/demo mode.");
        } else {
          const created = {
            id: makeId(),
            inspectionDateTime: toIsoString(form.inspectionDateTime),
            driverName: form.driverName.trim(),
            vehicleNumber: form.vehicleNumber.trim(),
            inspector: form.inspector.trim(),
            customerName: form.customerName.trim(),
            carrier: form.carrier.trim(),
            temperature: form.temperature.trim(),
            comments: form.comments.trim(),
            status: form.status,
            checks: { ...form.checks },
            createdAt: now,
            updatedAt: now,
          };

          const next = sortByInspectionDateDesc([created, ...current]);
          writeDemoData(next);
          setInspections(next);
          setExpandedId(created.id);
          setMessage("Inspection saved in preview/demo mode.");
        }

        setLastSyncedAt(now);
        setForm(createEmptyForm());
        setEditingId(null);
        return;
      }

      const payload = mapFormToRow(form);

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from(TABLE_NAME)
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();

        if (updateError) throw updateError;

        const updatedInspection = mapRowToInspection(data);
        setInspections((prev) =>
          sortByInspectionDateDesc(prev.map((item) => (item.id === editingId ? updatedInspection : item)))
        );
        setExpandedId(updatedInspection.id);
        setMessage("Inspection updated in the online database.");
      } else {
        const { data, error: insertError } = await supabase
          .from(TABLE_NAME)
          .insert(payload)
          .select()
          .single();

        if (insertError) throw insertError;

        const createdInspection = mapRowToInspection(data);
        setInspections((prev) => sortByInspectionDateDesc([createdInspection, ...prev]));
        setExpandedId(createdInspection.id);
        setMessage("Inspection saved to the online database.");
      }

      setLastSyncedAt(new Date().toISOString());
      setForm(createEmptyForm());
      setEditingId(null);
    } catch (err) {
      setError(err.message || "Failed to save inspection.");
    } finally {
      setSaving(false);
    }
  };

  const deleteInspection = async (id) => {
    const confirmed = window.confirm("Delete this inspection permanently?");
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      if (!supabase) {
        const next = readDemoData().filter((item) => item.id !== id);
        writeDemoData(next);
        setInspections(sortByInspectionDateDesc(next));
        if (expandedId === id) setExpandedId(null);
        if (editingId === id) resetForm();
        setMessage("Inspection deleted in preview/demo mode.");
        setLastSyncedAt(new Date().toISOString());
        return;
      }

      const { error: deleteError } = await supabase.from(TABLE_NAME).delete().eq("id", id);
      if (deleteError) throw deleteError;

      setInspections((prev) => prev.filter((item) => item.id !== id));
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) resetForm();
      setMessage("Inspection deleted from the online database.");
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setError(err.message || "Failed to delete inspection.");
    }
  };

  const editInspection = (inspection) => {
    setForm({
      inspectionDateTime: toInputDateTime(inspection.inspectionDateTime),
      driverName: inspection.driverName,
      vehicleNumber: inspection.vehicleNumber,
      inspector: inspection.inspector,
      customerName: inspection.customerName,
      carrier: inspection.carrier,
      temperature: inspection.temperature,
      comments: inspection.comments,
      status: inspection.status,
      checks: { ...inspection.checks },
    });
    setEditingId(inspection.id);
    setMessage("Inspection loaded for editing.");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-[28px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(241,245,249,0.92))] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Vehicle hygiene workflow
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Vehicle Hygiene Inspection</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Professional inspection form designed for tablet and mobile use, with shared history, CSV export, PDF reports, and cloud-ready storage.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:max-w-[320px] md:justify-end">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                {allChecksPassed ? "All checks marked" : "Inspection in progress"}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
                  mode === "cloud"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {mode === "cloud" ? "Cloud mode (Supabase)" : "Preview mode (local demo storage)"}
              </span>
            </div>
          </div>
        </header>

        {mode === "demo" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            Preview is running in demo mode because Supabase environment variables are not set. The app still works here, but saved records stay only in this browser preview until you connect Supabase.
          </div>
        )}

        {(message || error) && (
          <div className="space-y-2">
            {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total Saved" value={inspections.length} />
          <StatCard label="Approved" value={approvedCount} />
          <StatCard label="Rejected" value={rejectedCount} />
        </div>

        <form onSubmit={saveInspection} className="space-y-5">
          <CardShell
            title={editingId ? "Edit Inspection" : "New Inspection"}
            description="Fill in the inspection details before approving or rejecting the vehicle."
            aside={editingId ? <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Editing existing inspection</span> : null}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Date and Time">
                <TextInput type="datetime-local" value={form.inspectionDateTime} onChange={(e) => setField("inspectionDateTime", e.target.value)} />
              </Field>
              <Field label="Driver Name">
                <TextInput placeholder="Enter driver name" value={form.driverName} onChange={(e) => setField("driverName", e.target.value)} />
              </Field>
              <Field label="Vehicle Number">
                <TextInput placeholder="Enter vehicle number" value={form.vehicleNumber} onChange={(e) => setField("vehicleNumber", e.target.value)} />
              </Field>
              <Field label="Inspector">
                <TextInput placeholder="Enter inspector name" value={form.inspector} onChange={(e) => setField("inspector", e.target.value)} />
              </Field>
              <Field label="Customer Name">
                <TextInput placeholder="Enter customer name" value={form.customerName} onChange={(e) => setField("customerName", e.target.value)} />
              </Field>
              <Field label="Carrier">
                <TextInput placeholder="Enter carrier" value={form.carrier} onChange={(e) => setField("carrier", e.target.value)} />
              </Field>
            </div>
          </CardShell>

          <CardShell title="Inspection Checklist" description="Tick each box only if the requirement is fulfilled.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {checklistItems.map(([key, label]) => (
                <label key={key} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white">
                  <input type="checkbox" checked={form.checks[key]} onChange={(e) => setCheck(key, e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                </label>
              ))}
            </div>
          </CardShell>

          <CardShell title="Temperature and Comments" description="Add the measured temperature and any relevant notes.">
            <div className="grid gap-4">
              <Field label="Temperature (Chilled/Frozen)">
                <TextInput placeholder="Example: 3°C / -18°C" value={form.temperature} onChange={(e) => setField("temperature", e.target.value)} />
              </Field>
              <Field label="Comments">
                <TextArea placeholder="Add comments here" value={form.comments} onChange={(e) => setField("comments", e.target.value)} />
              </Field>
            </div>
          </CardShell>

          <CardShell title="Inspection Result" description="Select whether the vehicle is approved or rejected.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["approved", "Approved"],
                ["rejected", "Rejected"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white">
                  <input type="radio" name="status" value={value} checked={form.status === value} onChange={(e) => setField("status", e.target.value)} className="h-4 w-4 border-slate-300" />
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                </label>
              ))}
            </div>
          </CardShell>

          <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/85 p-2 shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:justify-end">
            {editingId && (
              <AppButton type="button" variant="secondary" onClick={resetForm}>
                Cancel Editing
              </AppButton>
            )}
            <AppButton type="button" variant="secondary" onClick={resetForm}>
              Reset Form
            </AppButton>
            <AppButton type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Inspection" : "Save Inspection"}
            </AppButton>
          </div>
        </form>

        <CardShell title="Inspection History" description="Search, edit, delete, and export saved inspections as CSV or PDF.">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-3 md:grid-cols-[1fr_180px] md:flex-1">
              <TextInput placeholder="Search driver, vehicle, inspector, customer, carrier or comments" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100">
                <option value="all">All statuses</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <AppButton type="button" variant="secondary" onClick={() => downloadCsv(filteredInspections)} disabled={filteredInspections.length === 0}>
                Export CSV
              </AppButton>
              <AppButton type="button" variant="secondary" onClick={loadInspections}>
                Refresh
              </AppButton>
            </div>
          </div>

          <div className="mb-4 text-xs text-slate-500">{lastSyncedAt ? `Last synced: ${formatDisplayDate(lastSyncedAt)}` : "Not synced yet"}</div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Loading inspections...</div>
          ) : filteredInspections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No saved inspections found.</div>
          ) : (
            <div className="space-y-3">
              {filteredInspections.map((inspection) => {
                const isExpanded = expandedId === inspection.id;
                const passedChecks = Object.values(inspection.checks).filter(Boolean).length;

                return (
                  <div key={inspection.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition hover:bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${inspection.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {inspection.status === "approved" ? "Approved" : "Rejected"}
                          </span>
                          <span className="text-xs text-slate-500">{formatDisplayDate(inspection.inspectionDateTime)}</span>
                        </div>

                        <div>
                          <div className="text-lg font-semibold text-slate-900">Vehicle {inspection.vehicleNumber || "-"}</div>
                          <div className="text-sm text-slate-600">Driver: {inspection.driverName || "-"} · Inspector: {inspection.inspector || "-"}</div>
                          <div className="text-sm text-slate-600">Customer: {inspection.customerName || "-"} · Carrier: {inspection.carrier || "-"}</div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Checks: {passedChecks}/6</span>
                          <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Temp: {inspection.temperature || "-"}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Updated: {formatDisplayDate(inspection.updatedAt)}</span>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 lg:w-[360px] lg:grid-cols-1">
                        <AppButton type="button" variant="secondary" onClick={() => setExpandedId(isExpanded ? null : inspection.id)}>
                          {isExpanded ? "Hide details" : "View details"}
                        </AppButton>
                        <AppButton type="button" variant="secondary" onClick={() => editInspection(inspection)}>
                          Edit
                        </AppButton>
                        <AppButton type="button" variant="secondary" onClick={() => downloadInspectionPdf(inspection)}>
                          Download PDF
                        </AppButton>
                        <AppButton type="button" variant="secondary" onClick={() => deleteInspection(inspection.id)}>
                          Delete
                        </AppButton>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {checklistItems.map(([key, label]) => (
                            <div key={key} className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm text-slate-700 shadow-sm">
                              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${inspection.checks[key] ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                {inspection.checks[key] ? "✓" : "✕"}
                              </span>
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Inspection Date</div>
                            <div className="mt-1 text-sm text-slate-800">{formatDisplayDate(inspection.inspectionDateTime)}</div>
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Created At</div>
                            <div className="mt-1 text-sm text-slate-800">{formatDisplayDate(inspection.createdAt)}</div>
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last Updated</div>
                            <div className="mt-1 text-sm text-slate-800">{formatDisplayDate(inspection.updatedAt)}</div>
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Result</div>
                            <div className="mt-1 text-sm text-slate-800">{inspection.status === "approved" ? "Approved" : "Rejected"}</div>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Comments</div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{inspection.comments || "No comments added."}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>
      </div>
    </div>
  );
}

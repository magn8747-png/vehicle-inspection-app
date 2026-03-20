import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

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
  return [...items].sort(
    (a, b) => new Date(b.inspectionDateTime) - new Date(a.inspectionDateTime)
  );
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

  return [headers, ...lines].map((row) => row.map(escape).join(",")).join("\n");
}

function downloadCsv(rows) {
  const csv = buildCsvString(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vehicle-hygiene-inspections-${new Date()
    .toISOString()
    .slice(0, 19)
    .replaceAll(":", "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  console.assert(csv.includes("\n"), "CSV should contain newline separators.");
  console.assert(csv.includes('"Jane ""JJ"" Doe"'), "CSV should escape quotes.");
  console.assert(csv.includes("Customer name"), "CSV should include customer name header.");
}

if (typeof window !== "undefined") {
  runSelfTests();
}

function Button({ children, variant = "primary", ...props }) {
  return (
    <button {...props} className={`btn ${variant === "secondary" ? "btn-secondary" : "btn-primary"}`}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function SectionCard({ title, description, rightContent, children }) {
  return (
    <section className="section-card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {rightContent ? <div>{rightContent}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
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

  const allChecksPassed = useMemo(
    () => Object.values(form.checks).every(Boolean),
    [form.checks]
  );

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

      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
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
          sortByInspectionDateDesc(
            prev.map((item) => (item.id === editingId ? updatedInspection : item))
          )
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
    <div className="page-bg">
      <div className="app-wrap">
        <header className="hero-card">
          <div className="hero-topline">Vehicle hygiene workflow</div>
          <div className="hero-row">
            <div>
              <h1>Vehicle Hygiene Inspection</h1>
              <p className="hero-text">
                Created by Magnus. If you need changes contact him.
                "One thing I've learned: you can know anything, it's all there, you just have to find it."
              </p>
            </div>

            <div className="hero-badges">
              <span className="chip chip-neutral">
                {allChecksPassed ? "All checks marked" : "Inspection in progress"}
              </span>
              <span className={`chip ${mode === "cloud" ? "chip-success" : "chip-warning"}`}>
                {mode === "cloud" ? "Cloud mode (Supabase)" : "Preview mode (local demo storage)"}
              </span>
            </div>
          </div>
        </header>

        {mode === "demo" && (
          <div className="notice notice-warning">
            Preview is running in demo mode because Supabase environment variables are not set.
            The app still works here, but saved records stay only in this browser until you connect Supabase.
          </div>
        )}

        {message && <div className="notice notice-success">{message}</div>}
        {error && <div className="notice notice-error">{error}</div>}

        <form onSubmit={saveInspection} className="form-stack">
          <SectionCard
            title={editingId ? "Edit Inspection" : "New Inspection"}
            description="Fill in the inspection details before approving or rejecting the vehicle."
            rightContent={
              editingId ? <span className="chip chip-neutral">Editing existing inspection</span> : null
            }
          >
            <div className="form-grid form-grid-3">
              <Field label="Date and Time">
                <input
                  className="input"
                  type="datetime-local"
                  value={form.inspectionDateTime}
                  onChange={(e) => setField("inspectionDateTime", e.target.value)}
                />
              </Field>

              <Field label="Driver Name">
                <input
                  className="input"
                  placeholder="Enter driver name"
                  value={form.driverName}
                  onChange={(e) => setField("driverName", e.target.value)}
                />
              </Field>

              <Field label="Vehicle Number">
                <input
                  className="input"
                  placeholder="Enter vehicle number"
                  value={form.vehicleNumber}
                  onChange={(e) => setField("vehicleNumber", e.target.value)}
                />
              </Field>

              <Field label="Inspector">
                <input
                  className="input"
                  placeholder="Enter inspector name"
                  value={form.inspector}
                  onChange={(e) => setField("inspector", e.target.value)}
                />
              </Field>

              <Field label="Customer Name">
                <input
                  className="input"
                  placeholder="Enter customer name"
                  value={form.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                />
              </Field>

              <Field label="Carrier">
                <input
                  className="input"
                  placeholder="Enter carrier"
                  value={form.carrier}
                  onChange={(e) => setField("carrier", e.target.value)}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Inspection Checklist"
            description="Tick each box only if the requirement is fulfilled."
          >
            <div className="form-grid form-grid-3">
              {checklistItems.map(([key, label]) => (
                <label key={key} className="check-card">
                  <input
                    type="checkbox"
                    checked={form.checks[key]}
                    onChange={(e) => setCheck(key, e.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Temperature and Comments"
            description="Add the measured temperature and any relevant notes."
          >
            <div className="form-grid">
              <Field label="Temperature (Chilled/Frozen)">
                <input
                  className="input"
                  placeholder="Example: 3°C / -18°C"
                  value={form.temperature}
                  onChange={(e) => setField("temperature", e.target.value)}
                />
              </Field>

              <Field label="Comments">
                <textarea
                  className="textarea"
                  placeholder="Add comments here"
                  value={form.comments}
                  onChange={(e) => setField("comments", e.target.value)}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Inspection Result"
            description="Select whether the vehicle is approved or rejected."
          >
            <div className="form-grid form-grid-2">
              {[
                ["approved", "Approved"],
                ["rejected", "Rejected"],
              ].map(([value, label]) => (
                <label key={value} className="check-card">
                  <input
                    type="radio"
                    name="status"
                    value={value}
                    checked={form.status === value}
                    onChange={(e) => setField("status", e.target.value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </SectionCard>

          <div className="sticky-actions">
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel Editing
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={resetForm}>
              Reset Form
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Inspection" : "Save Inspection"}
            </Button>
          </div>
        </form>

        <SectionCard
          title="Inspection History"
          description="Search, edit, delete, and export saved inspections."
          rightContent={
            <div className="history-actions-top">
              <Button
                type="button"
                variant="secondary"
                onClick={() => downloadCsv(filteredInspections)}
                disabled={filteredInspections.length === 0}
              >
                Export CSV
              </Button>
              <Button type="button" variant="secondary" onClick={loadInspections}>
                Refresh
              </Button>
            </div>
          }
        >
          <div className="history-toolbar">
            <input
              className="input"
              placeholder="Search driver, vehicle, inspector, customer, carrier or comments"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <div className="sync-text">
              {lastSyncedAt ? `Last synced: ${formatDisplayDate(lastSyncedAt)}` : "Not synced yet"}
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading inspections...</div>
          ) : filteredInspections.length === 0 ? (
            <div className="empty-state">No saved inspections found.</div>
          ) : (
            <div className="history-list">
              {filteredInspections.map((inspection) => {
                const isExpanded = expandedId === inspection.id;
                const passedChecks = Object.values(inspection.checks).filter(Boolean).length;

                return (
                  <div key={inspection.id} className="history-card">
                    <div className="history-header">
                      <div className="history-main">
                        <div className="history-meta">
                          <span
                            className={`status-pill ${
                              inspection.status === "approved" ? "approved" : "rejected"
                            }`}
                          >
                            {inspection.status === "approved" ? "Approved" : "Rejected"}
                          </span>
                          <span className="muted-text">
                            {formatDisplayDate(inspection.inspectionDateTime)}
                          </span>
                        </div>

                        <div className="history-title">
                          Vehicle {inspection.vehicleNumber || "-"}
                        </div>

                        <div className="history-subtitle">
                          Driver: {inspection.driverName || "-"} · Inspector:{" "}
                          {inspection.inspector || "-"}
                        </div>

                        <div className="history-subtitle">
                          Customer: {inspection.customerName || "-"} · Carrier:{" "}
                          {inspection.carrier || "-"}
                        </div>

                        <div className="tag-row">
                          <span className="tag">Checks: {passedChecks}/6</span>
                          <span className="tag">Temp: {inspection.temperature || "-"}</span>
                          <span className="tag">
                            Updated: {formatDisplayDate(inspection.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="history-side-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setExpandedId(isExpanded ? null : inspection.id)}
                        >
                          {isExpanded ? "Hide details" : "View details"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => editInspection(inspection)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => deleteInspection(inspection.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="history-details">
                        <div className="detail-grid detail-grid-checks">
                          {checklistItems.map(([key, label]) => (
                            <div key={key} className="detail-check-card">
                              <span
                                className={`check-dot ${
                                  inspection.checks[key] ? "check-dot-ok" : "check-dot-bad"
                                }`}
                              >
                                {inspection.checks[key] ? "✓" : "✕"}
                              </span>
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>

                        <div className="detail-grid detail-grid-info">
                          <div className="info-card">
                            <div className="info-label">Inspection Date</div>
                            <div>{formatDisplayDate(inspection.inspectionDateTime)}</div>
                          </div>
                          <div className="info-card">
                            <div className="info-label">Created At</div>
                            <div>{formatDisplayDate(inspection.createdAt)}</div>
                          </div>
                          <div className="info-card">
                            <div className="info-label">Last Updated</div>
                            <div>{formatDisplayDate(inspection.updatedAt)}</div>
                          </div>
                          <div className="info-card">
                            <div className="info-label">Result</div>
                            <div>{inspection.status === "approved" ? "Approved" : "Rejected"}</div>
                          </div>
                        </div>

                        <div className="info-card">
                          <div className="info-label">Comments</div>
                          <div className="pre-wrap">
                            {inspection.comments || "No comments added."}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
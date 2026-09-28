/* ============================================================
   ADMIN — INDIA COMPLIANCE (BWMR 2022)
   Full CRUD across the compliance module: CPCB producer
   registrations, per-battery compliance records, EPR obligations,
   EPR credits / certificates and document references. Vocabulary
   mirrors backend/constants/compliance.js. Everything is recorded
   against the real fleet database and surfaces on the customer
   battery passport; nothing is fabricated.
============================================================ */
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Factory,
  Leaf,
  Battery,
  ScrollText,
  FileText,
  Search,
  X,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Layers,
  Info,
  Map,
} from "lucide-react";

import { PageHeader, Card, Pagination } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { Modal } from "../../components/common/Modal";
import { getErrorMessage } from "../../services";
import OrganizationLocationMap from "../../components/common/map/OrganizationLocationMap";
import { fetchAdminOrganizations } from "../../services/mapApi";
import {
  fetchComplianceOverview,
  fetchComplianceProducers,
  createComplianceProducer,
  updateComplianceProducer,
  deleteComplianceProducer,
  fetchComplianceBatteries,
  fetchComplianceBattery,
  createComplianceBattery,
  updateComplianceBattery,
  fetchComplianceObligations,
  createComplianceObligation,
  updateComplianceObligation,
  deleteComplianceObligation,
  fetchComplianceCredits,
  createComplianceCredit,
  updateComplianceCredit,
  deleteComplianceCredit,
  fetchComplianceDocuments,
  createComplianceDocument,
  updateComplianceDocument,
  deleteComplianceDocument,
  fetchAdminBatteriesPaginated,
} from "../../services/adminApi";

/* ---------- Vocabulary (mirrors backend/constants/compliance.js) ---------- */
const PRODUCER_CATEGORIES = ["Manufacturer", "Importer", "Refurbisher", "Recycler"];
const PRODUCER_STATUSES = ["Active", "Inactive", "Suspended"];
const BATTERY_CATEGORIES = ["Portable", "Medium", "Large"];
const COLLECTION_CHANNELS = ["Return to Producer", "Dealer / Retailer", "Registered Recycler", "Refurbishment Network", "Other"];
const COMPLIANCE_STATUSES = ["Pending", "In Progress", "Compliant", "Non-Compliant", "Exempt"];
const COLLECTION_STATUSES = ["Not Required", "Pending", "Scheduled", "In Transit", "Collected", "Completed"];
const RECYCLING_STATUSES = ["Not Required", "Pending", "Under Assessment", "In Progress", "Completed", "Rejected"];
const OBLIGATION_TYPES = ["Recycling", "Refurbishment", "Other"];
const OBLIGATION_STATUSES = ["Open", "In Progress", "Closed"];
const CREDIT_STATUSES = ["Active", "Transferred", "Retired", "Expired"];
const DOCUMENT_TYPES = ["EPR Registration", "Recycling Registration", "Refurbishment Registration", "Product Documentation", "Test Certificate", "Collection Evidence", "Refurbishment Evidence", "Recycling Certificate", "Other"];
const DOCUMENT_STATUSES = ["Pending Review", "Approved", "Rejected", "Expired"];

const STEP_STATUS = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  "In Progress": "bg-sky-50 text-sky-700 border-sky-200",
  Compliant: "bg-green-50 text-green-700 border-green-200",
  "Non-Compliant": "bg-red-50 text-red-700 border-red-200",
  Exempt: "bg-slate-50 text-slate-600 border-slate-200",
  Active: "bg-green-50 text-green-700 border-green-200",
  Inactive: "bg-slate-50 text-slate-500 border-slate-200",
  Suspended: "bg-red-50 text-red-700 border-red-200",
  Open: "bg-green-50 text-green-700 border-green-200",
  Closed: "bg-slate-50 text-slate-600 border-slate-200",
  Transferred: "bg-sky-50 text-sky-700 border-sky-200",
  Retired: "bg-slate-50 text-slate-600 border-slate-200",
  Expired: "bg-red-50 text-red-700 border-red-200",
  "Pending Review": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_CHIP = (status) => {
  const cls = STEP_STATUS[status] || "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {status || "—"}
    </span>
  );
};

const verifiedChip = (verified) =>
  verified ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[10px] font-bold text-green-700">
      <CheckCircle2 className="w-3 h-3" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
      Not verified
    </span>
  );

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const valueOr = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : value;

/* ---------- Shared UI primitives ---------- */
const inputClass = "w-full h-11 px-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-sm text-[#16263A] placeholder:text-[#8A9096] focus:border-[#173B5C] outline-none transition";
const selectClass = "w-full h-11 px-4 pr-9 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-sm text-[#16263A] focus:border-[#173B5C] outline-none transition cursor-pointer";

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-xs font-bold text-[#16263A] mb-1.5">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-[#8A9096] mt-1">{hint}</p>}
  </div>
);

const ModalShell = ({ title, subtitle, onClose, children, wide }) => (
  <Modal isOpen={true} onClose={onClose}>
    <div className={`relative w-full ${wide ? "max-w-xl" : "max-w-lg"} bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#EEE9DA] p-6 sm:p-8 max-h-[90vh] overflow-y-auto`}>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F5F1E7] flex items-center justify-center text-[#16263A] hover:bg-[#E7E1D3] transition-colors shrink-0"
        aria-label="Close modal"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="mb-6 pr-8">
        <h3 className="font-bold text-lg sm:text-xl text-[#16263A] truncate">{title}</h3>
        {subtitle && <p className="text-xs text-[#B48611] font-semibold truncate mt-0.5">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </div>
  </Modal>
);

const ErrorBanner = ({ message }) =>
  message ? (
    <div className="mb-5 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="break-words">{message}</span>
    </div>
  ) : null;

const SubmitButtons = ({ submitting, submitLabel, saveLabel, onClose, destructive }) => (
  <div className="flex flex-wrap items-center gap-3 pt-3">
    <button
      type="button"
      onClick={onClose}
      className="flex-1 min-w-[120px] py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={submitting}
      className={`flex-1 min-w-[120px] py-3 rounded-2xl font-bold text-sm transition-colors shadow-sm disabled:opacity-60 ${
        destructive ? "bg-red-600 text-white hover:bg-red-700" : "bg-[#173B5C] text-white hover:bg-[#102F4A]"
      }`}
    >
      {submitting ? "Saving…" : submitLabel || saveLabel}
    </button>
  </div>
);

const TextInput = ({ value, onChange, placeholder, className = inputClass, type = "text" }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={className} />
);

const Select = ({ value, onChange, options, placeholder = "Select…", allowBlank = true }) => (
  <select value={value} onChange={onChange} className={selectClass}>
    {allowBlank && <option value="">{placeholder}</option>}
    {options.map((opt) => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
);

/* ---------- Form state helper ---------- */
const useForm = (initial) => {
  const [form, setForm] = useState(initial);
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return [form, update, setForm];
};

const filterPayload = (form, keys) => {
  const out = {};
  for (const key of keys) {
    if (form[key] !== undefined) out[key] = form[key];
  }
  return out;
};

/* ============================================================
   INLINE BATTERY COMPLIANCE DETAIL (expandable row)
   Clicking a battery in the Battery Records tab toggles this
   panel BENEATH the row — full compliance record, producer,
   end-of-life tracking, EPR reference, documents + audit trail.
   No navigation, no separate page.
============================================================ */
const EMPTY_DETAIL = { batteryId: null, record: null, documents: [], events: [], loading: false, error: "" };

const DetailSection = ({ title, children }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-wider text-[#B48611] mb-2">{title}</p>
    <div className="space-y-2">{children}</div>
  </div>
);

const DetailField = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">{label}</p>
    <p className="text-[12px] font-semibold text-[#16263A] mt-0.5 break-words">{value || "—"}</p>
  </div>
);

const ExpandedBatteryCompliance = ({ detail, onClose }) => {
  const rec = detail.record || {};
  const producer = rec.producer || null;
  const documents = detail.documents || [];
  const events = detail.events || [];

  return (
    <div className="rounded-2xl bg-[#FFFDF8] border border-[#E7E1D3] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEE9DA] bg-[#F5F1E7]/60 px-5 py-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-black text-sm text-[#16263A]">{valueOr(rec.batteryName, rec.batteryId)}</span>
          <span className="font-mono text-[11px] text-[#8A9096]">{rec.batteryId}</span>
          {rec.batteryModalId && <span className="text-[11px] font-semibold text-[#747B83]">Model {rec.batteryModalId}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[#8A9096]">Created {formatDate(rec.createdAt)}</span>
          {STATUS_CHIP(rec.complianceStatus)}
          {verifiedChip(rec.verifiedInApp)}
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse compliance details"
            className="w-7 h-7 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center text-[#8A9096] hover:text-[#16263A] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
        <DetailSection title="Producer & Registration">
          <DetailField label="Framework" value={rec.framework} />
          <DetailField label="Producer" value={producer?.producerName || rec.producerDisplayName} />
          <DetailField label="Entity Category" value={producer?.producerCategory} />
          <DetailField label="CPCB Registration No." value={producer?.registrationNumber} />
          <DetailField label="Reg. Status" value={producer?.status} />
          <DetailField label="Registration Valid Until" value={formatDate(producer?.registrationValidUntil)} />
        </DetailSection>
        <DetailSection title="Battery & Collection">
          <DetailField label="Battery Category (BWMR)" value={rec.batteryCategory} />
          <DetailField label="Collection Channel" value={rec.collectionChannel} />
          <DetailField label="Verified in MaxSpace" value={rec.verifiedInApp ? `Yes${rec.verifiedAt ? ` · ${formatDate(rec.verifiedAt)}` : ""}` : "No"} />
          <DetailField label="Last Updated" value={formatDate(rec.updatedAt)} />
        </DetailSection>
        <DetailSection title="End-of-Life Tracking">
          <DetailField label="Collection Status" value={rec.collectionStatus} />
          <DetailField label="Collection Date" value={formatDate(rec.collectionDate)} />
          <DetailField label="Collection Location" value={rec.collectionLocation} />
          <DetailField label="Refurbisher (Third-Party)" value={rec.refurbisherName} />
          <DetailField label="Recycler (Third-Party)" value={rec.recyclerName} />
          <DetailField label="Recycler Registration" value={rec.recyclerRegistration} />
          <DetailField label="Recycling Status" value={rec.recyclingStatus} />
          <DetailField label="Recycling Facility" value={rec.recyclingFacility} />
          <DetailField label="Recycling Certificate" value={rec.recyclingCertificate} />
          <DetailField label="Recycling Date" value={formatDate(rec.recyclingDate)} />
        </DetailSection>
      </div>

      <div className="grid gap-6 border-t border-[#EEE9DA] px-5 py-5 lg:grid-cols-3">
        <DetailSection title="EPR Reference & Notes">
          <DetailField label="EPR Reference" value={rec.eprReference || "Not available"} />
          {rec.notes ? (
            <p className="text-[12px] font-semibold text-[#16263A] bg-[#F5F1E7] border border-[#E7E1D3] rounded-xl px-3 py-2 break-words">{rec.notes}</p>
          ) : (
            <p className="text-[11px] text-[#8A9096]">No notes recorded.</p>
          )}
        </DetailSection>
        <DetailSection title="Documents (metadata only)">
          {documents.length ? (
            <ul className="space-y-1.5">
              {documents.map((doc, i) => (
                <li key={i} className="rounded-xl border border-[#E7E1D3] bg-[#FFFDF8] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-[#16263A] break-words">{doc.documentName}</span>
                    {STATUS_CHIP(doc.status)}
                  </div>
                  <p className="text-[11px] text-[#8A9096] mt-0.5">
                    {[doc.documentType, doc.documentNumber].filter(Boolean).join(" · ") || "—"}
                    {doc.expiresOn ? ` · expires ${formatDate(doc.expiresOn)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-[#8A9096]">No document references attached.</p>
          )}
        </DetailSection>
        <DetailSection title="Audit Trail">
          {events.length ? (
            <ul className="space-y-1.5">
              {events.map((ev, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl border border-[#E7E1D3] bg-[#FFFDF8] px-3 py-2">
                  <span className="text-[11px] text-[#8A9096] mt-0.5 shrink-0">{formatDate(ev.createdAt)}</span>
                  <span className="text-[12px] font-semibold text-[#16263A] break-words">{ev.eventDescription || ev.eventType}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-[#8A9096]">No audit events recorded.</p>
          )}
        </DetailSection>
      </div>
    </div>
  );
};

/* ============================================================
   PRODUCER FORM
============================================================ */
const ProducerFormModal = ({ record, onClose, onSave }) => {
  const editing = Boolean(record);
  const [form, update] = useForm(
    record || {
      producerName: "",
      registrationNumber: "",
      producerCategory: PRODUCER_CATEGORIES[0],
      registrationValidUntil: "",
      pan: "",
      gstin: "",
      address: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      status: "Active",
      notes: "",
    }
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producerName.trim()) return setError("Producer name is required.");
    if (!form.registrationNumber.trim()) return setError("CPCB registration number is required.");
    setSubmitting(true);
    setError("");
    try {
      await onSave(
        editing ? form.id : form,
        editing
          ? filterPayload(form, ["producerName", "registrationNumber", "producerCategory", "registrationValidUntil", "pan", "gstin", "address", "contactEmail", "contactPhone", "website", "status", "notes"])
          : form
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={editing ? "Edit Producer Registration" : "Register Producer"}
      subtitle={editing ? record.registrationNumber : "CPCB EPR producer registration"}
      onClose={onClose}
      wide
    >
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Producer Name" required>
          <TextInput value={form.producerName} onChange={(e) => update("producerName", e.target.value)} placeholder="e.g. GreenCycle Recyclers Pvt Ltd" />
        </Field>
        <Field label="CPCB Registration Number" required>
          <TextInput value={form.registrationNumber} onChange={(e) => update("registrationNumber", e.target.value)} placeholder="e.g. CPCB/BAT/2025/0101" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Entity Category">
            <Select value={form.producerCategory} onChange={(e) => update("producerCategory", e.target.value)} options={PRODUCER_CATEGORIES} allowBlank={false} />
          </Field>
          <Field label="Registration Valid Until">
            <TextInput type="date" value={form.registrationValidUntil || ""} onChange={(e) => update("registrationValidUntil", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="PAN">
            <TextInput value={form.pan || ""} onChange={(e) => update("pan", e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="GSTIN">
            <TextInput value={form.gstin || ""} onChange={(e) => update("gstin", e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Registered Office Address">
          <textarea value={form.address || ""} onChange={(e) => update("address", e.target.value)} rows={2} className={`${inputClass} h-auto py-3 resize-none`} placeholder="Registered office address" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Contact Email">
            <TextInput type="email" value={form.contactEmail || ""} onChange={(e) => update("contactEmail", e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Contact Phone">
            <TextInput value={form.contactPhone || ""} onChange={(e) => update("contactPhone", e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Website">
            <TextInput value={form.website || ""} onChange={(e) => update("website", e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Registration Status">
          <Select value={form.status} onChange={(e) => update("status", e.target.value)} options={PRODUCER_STATUSES} allowBlank={false} />
        </Field>
        <Field label="Notes">
          <TextInput value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes" />
        </Field>
        <SubmitButtons submitting={submitting} submitLabel={editing ? "Save Changes" : "Register Producer"} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

/* ============================================================
   BATTERY COMPLIANCE FORM (incl. End-of-Life lifecycle + EPR)
   Business model: ABC Battery Pvt. Ltd. is Manufacturer & Service Provider.
   Recycling/Refurbishment is performed by third-party partners — the form
   records the handler explicitly and never implies ABC is the recycler.
============================================================ */
const BatteryComplianceFormModal = ({ record, batteries = [], producers = [], onClose, onSave }) => {
  const editing = Boolean(record);
  const [form, update] = useForm(
    record
      ? {
          producerId: record.producerId || "",
          batteryCategory: record.batteryCategory || "",
          collectionChannel: record.collectionChannel || "",
          complianceStatus: record.complianceStatus || "Pending",
          verifiedInApp: record.verifiedInApp || false,
          notes: record.notes || "",
          collectionStatus: record.collectionStatus || "",
          collectionDate: record.collectionDate || "",
          collectionLocation: record.collectionLocation || "",
          refurbisherId: record.refurbisherId || "",
          refurbisherName: record.refurbisherName || "",
          refurbisherDetails: record.refurbisherDetails || "",
          recyclerId: record.recyclerId || "",
          recyclerName: record.recyclerName || "",
          recyclerRegistration: record.recyclerRegistration || "",
          recyclingFacility: record.recyclingFacility || "",
          recyclingDate: record.recyclingDate || "",
          recyclingStatus: record.recyclingStatus || "",
          recyclingCertificate: record.recyclingCertificate || "",
          eprReference: record.eprReference || "",
        }
      : {
          batteryId: "",
          producerId: "",
          batteryCategory: "",
          collectionChannel: "",
          complianceStatus: "Pending",
          verifiedInApp: false,
          notes: "",
          collectionStatus: "",
          collectionDate: "",
          collectionLocation: "",
          refurbisherId: "",
          refurbisherName: "",
          refurbisherDetails: "",
          recyclerId: "",
          recyclerName: "",
          recyclerRegistration: "",
          recyclingFacility: "",
          recyclingDate: "",
          recyclingStatus: "",
          recyclingCertificate: "",
          eprReference: "",
        }
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editing && !form.batteryId) return setError("Select the battery to link a compliance record to.");
    setSubmitting(true);
    setError("");
    try {
      const keys = ["producerId", "batteryCategory", "collectionChannel", "complianceStatus", "verifiedInApp", "notes",
        "collectionStatus","collectionDate","collectionLocation",
        "refurbisherId","refurbisherName","refurbisherDetails",
        "recyclerId","recyclerName","recyclerRegistration","recyclingFacility","recyclingDate","recyclingStatus","recyclingCertificate",
        "eprReference"];
      if (editing) {
        await onSave(record.batteryId, filterPayload(form, keys));
      } else {
        await onSave(form.batteryId, filterPayload(form, keys));
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={editing ? "Edit Compliance Record" : "Link Battery to Compliance"}
      subtitle={editing ? `${record.batteryName || record.batteryId} · ${record.batteryId}` : "Attach a BWMR 2022 compliance record to a battery"}
      onClose={onClose}
      wide
    >
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editing && (
          <Field label="Battery" required hint="Only batteries without an existing compliance record are tracked">
            <select value={form.batteryId} onChange={(e) => update("batteryId", e.target.value)} className={selectClass}>
              <option value="">Select battery…</option>
              {batteries.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.id} — {b.id}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Producer Registration" hint="CPCB-registered producer this battery is associated with">
          <select value={form.producerId} onChange={(e) => update("producerId", e.target.value)} className={selectClass}>
            <option value="">No producer (unlinked)</option>
            {producers.map((p) => (
              <option key={p.id} value={p.id}>{p.producerName} — {p.registrationNumber}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Battery Category (BWMR)">
            <Select value={form.batteryCategory} onChange={(e) => update("batteryCategory", e.target.value)} options={BATTERY_CATEGORIES} />
          </Field>
          <Field label="Collection Channel">
            <Select value={form.collectionChannel} onChange={(e) => update("collectionChannel", e.target.value)} options={COLLECTION_CHANNELS} />
          </Field>
        </div>
        <Field label="Compliance Status">
          <Select value={form.complianceStatus} onChange={(e) => update("complianceStatus", e.target.value)} options={COMPLIANCE_STATUSES} allowBlank={false} />
        </Field>
        <label className="flex items-center justify-between rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] px-4 py-3 cursor-pointer">
          <span className="text-sm font-semibold text-[#16263A]">
            Verified in MaxSpace
            <span className="block text-[10px] font-normal text-[#747B83]">Marks that the record was checked within this platform (not the official CPCB stamp).</span>
          </span>
          <input
            type="checkbox"
            checked={Boolean(form.verifiedInApp)}
            onChange={(e) => update("verifiedInApp", e.target.checked)}
            className="w-5 h-5 accent-[#173B5C]"
          />
        </label>
        <Field label="Notes">
          <TextInput value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes" />
        </Field>

        <div className="pt-2 border-t border-[#EEE9DA]">
          <p className="text-xs font-black text-[#16263A] uppercase tracking-wide mb-3">End-of-Life Tracking</p>
          <p className="text-[10px] text-[#8A9096] mb-3">ABC Battery Pvt Ltd tracks lifecycle — recycling/refurbishment handlers are third-party partners, not the manufacturer.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Collection Status">
              <Select value={form.collectionStatus} onChange={(e) => update("collectionStatus", e.target.value)} options={COLLECTION_STATUSES} />
            </Field>
            <Field label="Collection Date">
              <TextInput type="date" value={form.collectionDate || ""} onChange={(e) => update("collectionDate", e.target.value)} />
            </Field>
            <Field label="Collection Location">
              <TextInput value={form.collectionLocation || ""} onChange={(e) => update("collectionLocation", e.target.value)} placeholder="e.g. Bangalore" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Refurbisher Partner (Third-Party)">
              <select value={form.refurbisherId} onChange={(e) => update("refurbisherId", e.target.value)} className={selectClass}>
                <option value="">Not assigned</option>
                {producers.filter((p)=>p.producerCategory==="Refurbisher"||p.producerCategory==="Recycler").map((p)=>(
                  <option key={p.id} value={p.id}>{p.producerName} — {p.registrationNumber}</option>
                ))}
              </select>
            </Field>
            <Field label="Refurbisher Name (if not listed)">
              <TextInput value={form.refurbisherName || ""} onChange={(e) => update("refurbisherName", e.target.value)} placeholder="Or type partner name" />
            </Field>
          </div>
          <Field label="Refurbisher Details">
            <TextInput value={form.refurbisherDetails || ""} onChange={(e) => update("refurbisherDetails", e.target.value)} placeholder="Authorization / contact" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Recycler Partner (Third-Party)">
              <select value={form.recyclerId} onChange={(e) => update("recyclerId", e.target.value)} className={selectClass}>
                <option value="">Not assigned</option>
                {producers.filter((p)=>p.producerCategory==="Recycler"||p.producerCategory==="Refurbisher").map((p)=>(
                  <option key={p.id} value={p.id}>{p.producerName} — {p.registrationNumber}</option>
                ))}
              </select>
            </Field>
            <Field label="Recycler Name (if not listed)">
              <TextInput value={form.recyclerName || ""} onChange={(e) => update("recyclerName", e.target.value)} placeholder="Or type recycler name" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <Field label="Recycler Registration">
              <TextInput value={form.recyclerRegistration || ""} onChange={(e) => update("recyclerRegistration", e.target.value)} placeholder="Registration number" />
            </Field>
            <Field label="Recycling Facility">
              <TextInput value={form.recyclingFacility || ""} onChange={(e) => update("recyclingFacility", e.target.value)} placeholder="Facility name/location" />
            </Field>
            <Field label="Recycling Status">
              <Select value={form.recyclingStatus} onChange={(e) => update("recyclingStatus", e.target.value)} options={RECYCLING_STATUSES} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Recycling Date">
              <TextInput type="date" value={form.recyclingDate || ""} onChange={(e) => update("recyclingDate", e.target.value)} />
            </Field>
            <Field label="Recycling Certificate">
              <TextInput value={form.recyclingCertificate || ""} onChange={(e) => update("recyclingCertificate", e.target.value)} placeholder="Certificate number / evidence" />
            </Field>
          </div>
        </div>

        <div className="pt-2 border-t border-[#EEE9DA]">
          <p className="text-xs font-black text-[#16263A] uppercase tracking-wide mb-3">EPR Reference</p>
          <Field label="EPR Reference" hint="Real CPCB EPR reference if available; otherwise leave as Not available">
            <TextInput value={form.eprReference || ""} onChange={(e) => update("eprReference", e.target.value)} placeholder="Not available" />
          </Field>
        </div>

        <SubmitButtons submitting={submitting} submitLabel={editing ? "Save Changes" : "Link Battery"} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

/* ============================================================
   OBLIGATION FORM
============================================================ */
const ObligationFormModal = ({ record, producers = [], onClose, onSave }) => {
  const editing = Boolean(record);
  const [form, update] = useForm(
    record
      ? {
          producerId: record.producerId || "",
          financialYear: record.financialYear || "",
          batteryCategory: record.batteryCategory || "",
          obligationType: record.obligationType || "",
          targetPercent: record.targetPercent ?? "",
          obligationKg: record.obligationKg ?? "",
          achievedKg: record.achievedKg ?? "",
          status: record.status || "Open",
          notes: record.notes || "",
        }
      : {
          producerId: "",
          financialYear: "",
          batteryCategory: "Medium",
          obligationType: "Recycling",
          targetPercent: "",
          obligationKg: "",
          achievedKg: "",
          status: "Open",
          notes: "",
        }
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producerId) return setError("Select a producer registration.");
    if (!form.financialYear.trim()) return setError("Financial year is required (e.g. 2024-2025).");
    if (form.targetPercent !== "" && (Number(form.targetPercent) < 0 || Number(form.targetPercent) > 100))
      return setError("Target percentage must be between 0 and 100.");
    setSubmitting(true);
    setError("");
    try {
      const payload = filterPayload(form, ["producerId", "financialYear", "batteryCategory", "obligationType", "targetPercent", "obligationKg", "achievedKg", "status", "notes"]);
      if (editing) await onSave(record.id, payload);
      else await onSave(payload);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={editing ? "Edit EPR Obligation" : "Create EPR Obligation"}
      subtitle={editing ? `${record.financialYear} · ${record.batteryCategory}` : "Set a producer's EPR recycling/refurbishment target"}
      onClose={onClose}
      wide
    >
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Producer" required>
          <select value={form.producerId} onChange={(e) => update("producerId", e.target.value)} className={selectClass}>
            <option value="">Select producer…</option>
            {producers.map((p) => (
              <option key={p.id} value={p.id}>{p.producerName} — {p.registrationNumber}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Financial Year" required hint="e.g. 2024-2025">
            <TextInput value={form.financialYear} onChange={(e) => update("financialYear", e.target.value)} placeholder="2024-2025" />
          </Field>
          <Field label="Battery Category">
            <Select value={form.batteryCategory} onChange={(e) => update("batteryCategory", e.target.value)} options={BATTERY_CATEGORIES} allowBlank={false} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Obligation Type">
            <Select value={form.obligationType} onChange={(e) => update("obligationType", e.target.value)} options={OBLIGATION_TYPES} allowBlank={false} />
          </Field>
          <Field label="Target %">
            <TextInput type="number" min="0" max="100" value={form.targetPercent} onChange={(e) => update("targetPercent", e.target.value)} placeholder="70" />
          </Field>
          <Field label="Target (kg)">
            <TextInput type="number" min="0" value={form.obligationKg} onChange={(e) => update("obligationKg", e.target.value)} placeholder="5000" />
          </Field>
        </div>
        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Achieved (kg)">
              <TextInput type="number" min="0" value={form.achievedKg} onChange={(e) => update("achievedKg", e.target.value)} placeholder="0" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => update("status", e.target.value)} options={OBLIGATION_STATUSES} allowBlank={false} />
            </Field>
          </div>
        )}
        <Field label="Notes">
          <TextInput value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes" />
        </Field>
        <SubmitButtons submitting={submitting} submitLabel={editing ? "Save Changes" : "Create Obligation"} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

/* ============================================================
   CREDIT FORM
============================================================ */
const CreditFormModal = ({ record, obligations = [], onClose, onSave }) => {
  const editing = Boolean(record);
  const [form, update] = useForm(
    record
      ? {
          obligationId: record.obligationId || "",
          certificateNumber: record.certificateNumber || "",
          quantityKg: record.quantityKg ?? "",
          issueDate: record.issueDate || "",
          validUntil: record.validUntil || "",
          status: record.status || "Active",
          notes: record.notes || "",
        }
      : {
          obligationId: "",
          certificateNumber: "",
          quantityKg: "",
          issueDate: "",
          validUntil: "",
          status: "Active",
          notes: "",
        }
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.obligationId) return setError("Select the EPR obligation this certificate offsets.");
    if (!form.certificateNumber.trim()) return setError("Certificate number is required.");
    setSubmitting(true);
    setError("");
    try {
      const payload = filterPayload(form, ["obligationId", "certificateNumber", "quantityKg", "issueDate", "validUntil", "status", "notes"]);
      if (editing) await onSave(record.id, payload);
      else await onSave(payload);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={editing ? "Edit EPR Credit / Certificate" : "Record EPR Credit / Certificate"}
      subtitle={editing ? record.certificateNumber : "A CPCB EPR certificate that fulfils an obligation"}
      onClose={onClose}
    >
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Obligation" required>
          <select value={form.obligationId} onChange={(e) => update("obligationId", e.target.value)} className={selectClass}>
            <option value="">Select obligation…</option>
            {obligations.map((o) => (
              <option key={o.id} value={o.id}>{o.financialYear} · {o.batteryCategory} · {o.producerName || `Producer #${o.producerId}`}</option>
            ))}
          </select>
        </Field>
        <Field label="Certificate Number" required>
          <TextInput value={form.certificateNumber} onChange={(e) => update("certificateNumber", e.target.value)} placeholder="e.g. EPR-CERT-0001" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Quantity (kg)">
            <TextInput type="number" min="0" value={form.quantityKg} onChange={(e) => update("quantityKg", e.target.value)} placeholder="3500" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => update("status", e.target.value)} options={CREDIT_STATUSES} allowBlank={false} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Issue Date">
            <TextInput type="date" value={form.issueDate || ""} onChange={(e) => update("issueDate", e.target.value)} />
          </Field>
          <Field label="Valid Until">
            <TextInput type="date" value={form.validUntil || ""} onChange={(e) => update("validUntil", e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <TextInput value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes" />
        </Field>
        <SubmitButtons submitting={submitting} submitLabel={editing ? "Save Changes" : "Record Credit"} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

/* ============================================================
   DOCUMENT FORM
============================================================ */
const DocumentFormModal = ({ record, batteries = [], producers = [], onClose, onSave }) => {
  const editing = Boolean(record);
  const [form, update] = useForm(
    record
      ? {
          batteryId: record.batteryId || "",
          producerId: record.producerId || "",
          documentType: record.documentType || "",
          documentName: record.documentName || "",
          documentNumber: record.documentNumber || "",
          issuedBy: record.issuedBy || "",
          issuedOn: record.issuedOn || "",
          expiresOn: record.expiresOn || "",
          status: record.status || "Pending Review",
          notes: record.notes || "",
        }
      : {
          batteryId: "",
          producerId: "",
          documentType: "",
          documentName: "",
          documentNumber: "",
          issuedBy: "",
          issuedOn: "",
          expiresOn: "",
          status: "Pending Review",
          notes: "",
        }
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.documentName.trim()) return setError("Document name is required.");
    setSubmitting(true);
    setError("");
    try {
      const payload = filterPayload(form, ["batteryId", "producerId", "documentType", "documentName", "documentNumber", "issuedBy", "issuedOn", "expiresOn", "status", "notes"]);
      if (editing) await onSave(record.id, payload);
      else await onSave(payload);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={editing ? "Edit Document Reference" : "Add Document Reference"}
      subtitle={editing ? record.documentName : "Metadata-only — MaxSpace stores no document files"}
      onClose={onClose}
      wide
    >
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Document Name" required>
          <TextInput value={form.documentName} onChange={(e) => update("documentName", e.target.value)} placeholder="e.g. Recycling certificate 2025.pdf" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Document Type">
            <Select value={form.documentType} onChange={(e) => update("documentType", e.target.value)} options={DOCUMENT_TYPES} />
          </Field>
          <Field label="Document Number">
            <TextInput value={form.documentNumber || ""} onChange={(e) => update("documentNumber", e.target.value)} placeholder="Reference number" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Battery">
            <select value={form.batteryId} onChange={(e) => update("batteryId", e.target.value)} className={selectClass}>
              <option value="">No specific battery</option>
              {batteries.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.id} — {b.id}</option>
              ))}
            </select>
          </Field>
          <Field label="Producer">
            <select value={form.producerId} onChange={(e) => update("producerId", e.target.value)} className={selectClass}>
              <option value="">No specific producer</option>
              {producers.map((p) => (
                <option key={p.id} value={p.id}>{p.producerName}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Issued On">
            <TextInput type="date" value={form.issuedOn || ""} onChange={(e) => update("issuedOn", e.target.value)} />
          </Field>
          <Field label="Expires On">
            <TextInput type="date" value={form.expiresOn || ""} onChange={(e) => update("expiresOn", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => update("status", e.target.value)} options={DOCUMENT_STATUSES} allowBlank={false} />
          </Field>
        </div>
        <Field label="Issued By">
          <TextInput value={form.issuedBy || ""} onChange={(e) => update("issuedBy", e.target.value)} placeholder="Issuing authority" />
        </Field>
        <Field label="Notes">
          <TextInput value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes" />
        </Field>
        <SubmitButtons submitting={submitting} submitLabel={editing ? "Save Changes" : "Add Document"} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

/* ============================================================
   DELETE CONFIRMATION
============================================================ */
const DeleteConfirmModal = ({ target, onClose, onConfirm, busy }) => (
  <ModalShell title="Delete Record" subtitle={target?.title} onClose={onClose}>
    <div className="mb-5 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        {target?.wording || "This record will be permanently removed from the compliance module. Consider whether this is a legal audit action before proceeding."}
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 min-w-[120px] py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className="flex-1 min-w-[120px] py-3 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Delete Forever"}
      </button>
    </div>
  </ModalShell>
);

/* ============================================================
   TABS CONFIGURATION
============================================================ */
const TABS = [
  { id: "network", label: "Network Map", icon: Map, desc: "Facility & partner locations" },
  { id: "producers", label: "Producers", icon: Factory, desc: "CPCB EPR registrations" },
  { id: "batteries", label: "Battery Records", icon: Battery, desc: "Per-battery compliance" },
  { id: "obligations", label: "Obligations", icon: Layers, desc: "EPR targets by producer" },
  { id: "credits", label: "Credits", icon: Leaf, desc: "EPR certificates" },
  { id: "documents", label: "Documents", icon: FileText, desc: "Document references" },
];

/* ============================================================
   MAIN PAGE
============================================================ */
const AdminCompliancePage = () => {
  const [activeTab, setActiveTab] = useState("producers");
  const [overview, setOverview] = useState(null);

  const [list, setList] = useState({ data: [], pagination: null, page: 1, search: "", status: "", fetching: false, error: "" });
  const [modal, setModal] = useState(null); // { type, mode, record }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState(EMPTY_DETAIL);

  /* Reusable lookup lists for dropdowns */
  const [dropdown, setDropdown] = useState({ producers: [], batteries: [], obligations: [] });

  const loadOverview = async () => {
    try {
      const res = await fetchComplianceOverview();
      setOverview(res?.data || null);
    } catch {
      setOverview(null);
    }
  };

  const loadDropdownData = async () => {
    try {
      const [producers, batteries, obligations] = await Promise.all([
        fetchComplianceProducers({ page: 1, limit: 100 }),
        fetchAdminBatteriesPaginated({ page: 1, limit: 100 }),
        fetchComplianceObligations({ page: 1, limit: 100 }),
      ]);
      setDropdown({
        producers: producers?.data || [],
        batteries: batteries?.data || [],
        obligations: (obligations?.data || []).map((o) => ({
          ...o,
          producerName: dropdown.producers.find((p) => p.id === o.producerId)?.producerName || `Producer #${o.producerId}`,
        })),
      });
    } catch {
      // Dropdown lists are best-effort for forms.
    }
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDropdownData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchList = async (opts = {}) => {
    const tab = opts.tab || activeTab;
    /* The Network Map tab is purely visual — it has no data rows. */
    if (tab === "network") {
      setList({ data: [], pagination: null, page: 1, search: "", status: "", fetching: false, error: "" });
      return;
    }
    const params = {
      page: opts.page || 1,
      limit: 10,
      search: opts.search !== undefined ? opts.search : list.search,
      ...(opts.status !== undefined ? { status: opts.status } : list.status ? { status: list.status } : {}),
    };
    setList((s) => ({ ...s, fetching: true, error: "" }));
    try {
      let res;
      switch (tab) {
        case "producers":
          res = await fetchComplianceProducers(params);
          break;
        case "batteries":
          res = await fetchComplianceBatteries(params);
          break;
        case "obligations":
          res = await fetchComplianceObligations(params);
          break;
        case "credits":
          res = await fetchComplianceCredits(params);
          break;
        case "documents":
          res = await fetchComplianceDocuments(params);
          break;
        default:
          res = { data: [], pagination: null };
      }
      setList({
        data: res?.data || [],
        pagination: res?.pagination || null,
        page: params.page,
        search: params.search || "",
        status: opts.status !== undefined ? opts.status : list.status || "",
        fetching: false,
        error: "",
      });
    } catch (err) {
      setList((s) => ({ ...s, fetching: false, error: getErrorMessage(err) }));
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setExpandedDetail(EMPTY_DETAIL);
    setList((s) => ({ ...s, page: 1, search: "", status: "", error: "" }));
  };

  useEffect(() => {
    fetchList({ tab: activeTab, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => fetchList({ tab: activeTab, page: 1, search: list.search, status: list.status }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.search, list.status]);

  const reload = async () => {
    await fetchList({ tab: activeTab, page: list.page });
    await loadOverview();
    await loadDropdownData();
  };

  const handleCreate = (type, payload) => {
    const actions = {
      producers: createComplianceProducer,
      batteries: createComplianceBattery,
      obligations: createComplianceObligation,
      credits: createComplianceCredit,
      documents: createComplianceDocument,
    };
    if (type === "batteries") {
      const { batteryId, ...rest } = payload;
      return actions[type](batteryId, rest);
    }
    return actions[type](payload);
  };

  const handleUpdate = (type, id, payload) => {
    const actions = {
      producers: updateComplianceProducer,
      batteries: updateComplianceBattery,
      obligations: updateComplianceObligation,
      credits: updateComplianceCredit,
      documents: updateComplianceDocument,
    };
    if (type === "batteries") return actions[type](id, payload);
    return actions[type](id, payload);
  };

  const handleDelete = (type, id) => {
    const actions = {
      producers: deleteComplianceProducer,
      batteries: () => Promise.reject(new Error("Battery compliance records are deleted via the battery record itself.")),
      obligations: deleteComplianceObligation,
      credits: deleteComplianceCredit,
      documents: deleteComplianceDocument,
    };
    return actions[type](id);
  };

  const statusOptionsForTab = (tab) =>
    tab === "producers"
      ? PRODUCER_STATUSES
      : tab === "batteries"
      ? COMPLIANCE_STATUSES
      : tab === "obligations"
      ? OBLIGATION_STATUSES
      : tab === "credits"
      ? CREDIT_STATUSES
      : DOCUMENT_STATUSES;

  const columnsForTab = useMemo(
    () => ({
      producers: ["Producer", "Reg. Number", "Category", "Status", "Valid Until", ""],
      batteries: ["Battery (click)", "Producer", "Category", "Status", "Verification", "Created", ""],
      obligations: ["Producer", "Financial Year", "Category", "Target", "Achieved", "Status", ""],
      credits: ["Certificate", "Obligation", "Quantity", "Issue", "Valid Until", "Status", ""],
      documents: ["Document", "Type", "Battery / Producer", "Status", "Expires", ""],
    }),
    []
  );

  const renderRows = (row) => {
    switch (activeTab) {
      case "producers":
        return (
          <>
            <td className="px-6 py-4">
              <p className="font-bold text-sm text-[#16263A]">{valueOr(row.producerName)}</p>
            </td>
            <td className="px-6 py-4 text-xs font-mono text-[#16263A]">{valueOr(row.registrationNumber)}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{valueOr(row.producerCategory)}</td>
            <td className="px-6 py-4">{STATUS_CHIP(row.status)}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{formatDate(row.registrationValidUntil)}</td>
          </>
        );
      case "batteries":
        return (
          <>
            <td className="px-6 py-4">
              <button
                type="button"
                onClick={() => toggleBatteryDetail(row.batteryId)}
                title={expandedDetail.batteryId === row.batteryId ? "Collapse compliance details" : "Show compliance details"}
                className="text-left w-full flex items-start gap-2 group"
              >
                <ChevronDown
                  className={`w-4 h-4 mt-1 shrink-0 transition-transform cursor-pointer ${
                    expandedDetail.batteryId === row.batteryId ? "rotate-180 text-[#173B5C]" : "text-[#8A9096]"
                  }`}
                />
                <span>
                  <span className="font-bold text-sm text-[#16263A] group-hover:text-[#173B5C] transition-colors">{valueOr(row.batteryName)}</span>
                  <span className="block text-[11px] font-mono text-[#8A9096]">{row.batteryId}</span>
                  <span className="block text-[10px] text-[#8A9096] mt-0.5">Manufacturer: ABC Battery Pvt Ltd</span>
                  {row.eprReference ? <span className="block text-[10px] text-[#747B83]">EPR: {row.eprReference}</span> : <span className="block text-[10px] text-[#747B83]">EPR: Not available</span>}
                </span>
              </button>
            </td>
            <td className="px-6 py-4 text-xs text-[#747B83]">
              <span>{valueOr(row.producer?.producerName || row.producerDisplayName, "—")}</span>
              {row.recyclerName || row.recyclerId ? <span className="block text-[10px] text-[#8A9096]">Recycler (Third-Party): {valueOr(row.recyclerName)}</span> : null}
              {row.refurbisherName || row.refurbisherId ? <span className="block text-[10px] text-[#8A9096]">Refurbisher (Third-Party): {valueOr(row.refurbisherName)}</span> : null}
            </td>
            <td className="px-6 py-4 text-xs text-[#747B83]">
              <span>{valueOr(row.batteryCategory)}</span>
              {row.collectionStatus ? <span className="block text-[10px]">{row.collectionStatus} {row.collectionDate ? `· ${formatDate(row.collectionDate)}` : ""}</span> : <span className="block text-[10px] text-[#8A9096]">Collection: Not applicable</span>}
              {row.recyclingStatus ? <span className="block text-[10px]">Recycling: {row.recyclingStatus}</span> : null}
            </td>
            <td className="px-6 py-4">{STATUS_CHIP(row.complianceStatus)}</td>
            <td className="px-6 py-4">{verifiedChip(row.verifiedInApp)}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{formatDate(row.createdAt)}</td>
          </>
        );
      case "obligations":
        return (
          <>
            <td className="px-6 py-4 text-xs text-[#16263A]">{valueOr(row.producerName || `Producer #${row.producerId}`)}</td>
            <td className="px-6 py-4 text-xs font-mono text-[#16263A]">{valueOr(row.financialYear)}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{valueOr(row.batteryCategory)}</td>
            <td className="px-6 py-4 text-xs text-[#16263A]">
              {row.targetPercent != null ? `${row.targetPercent}%` : "—"}
              {row.obligationKg != null && <span className="block text-[10px] text-[#8A9096]">{row.obligationKg} kg</span>}
            </td>
            <td className="px-6 py-4 text-xs text-[#16263A]">
              {row.achievedKg != null ? `${row.achievedKg} kg` : "—"}
            </td>
            <td className="px-6 py-4">{STATUS_CHIP(row.status)}</td>
          </>
        );
      case "credits":
        return (
          <>
            <td className="px-6 py-4">
              <p className="font-bold text-sm font-mono text-[#16263A]">{valueOr(row.certificateNumber)}</p>
            </td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{valueOr(row.obligationYear ? `${row.obligationYear} · ${row.obligationCategory}` : `Obligation #${row.obligationId}`)}</td>
            <td className="px-6 py-4 text-xs text-[#16263A]">{row.quantityKg != null ? `${row.quantityKg} kg` : "—"}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{formatDate(row.issueDate)}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{formatDate(row.validUntil)}</td>
            <td className="px-6 py-4">{STATUS_CHIP(row.status)}</td>
          </>
        );
      case "documents":
        return (
          <>
            <td className="px-6 py-4">
              <p className="font-bold text-sm text-[#16263A]">{valueOr(row.documentName)}</p>
              {row.documentNumber && <p className="text-[11px] font-mono text-[#8A9096]">{row.documentNumber}</p>}
            </td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{valueOr(row.documentType)}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">
              {row.batteryId ? `Battery ${row.batteryId}` : row.producerId ? `Producer #${row.producerId}` : "—"}
            </td>
            <td className="px-6 py-4">{STATUS_CHIP(row.status)}</td>
            <td className="px-6 py-4 text-xs text-[#747B83]">{formatDate(row.expiresOn)}</td>
          </>
        );
      default:
        return null;
    }
  };

  const renderRowActions = (row) => (
    <td className="px-6 py-4 text-right whitespace-nowrap">
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setModal({ type: activeTab, mode: "edit", record: row })}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F5F1E7] text-[#173B5C] text-xs font-bold border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          type="button"
          onClick={() =>
            setDeleteTarget({
              type: activeTab,
              id: activeTab === "batteries" ? row.batteryId : row.id,
              title: row.producerName || row.batteryName || row.batteryId || row.certificateNumber || row.documentName || `${activeTab} #${row.id}`,
              wording:
                activeTab === "batteries"
                  ? "Battery compliance records cannot be deleted from here. Edit the record or clear the compliance fields instead."
                  : activeTab === "credits"
                  ? "This EPR certificate reference will be permanently removed."
                  : activeTab === "documents"
                  ? "This document reference will be permanently removed."
                  : "This record and its associated audit trail will be permanently removed.",
            })
          }
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </td>
  );

  const emptyState = () => (
    <tr>
      <td colSpan="20" className="px-6 py-14 text-center text-[#747B83]">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#F5F1E7] flex items-center justify-center mb-3">
          <Search className="w-5 h-5 text-[#8A7A4A]" />
        </div>
        <p className="font-semibold text-sm">No records found</p>
        <p className="text-xs text-[#8A9096] mt-0.5">Try adjusting the search query or status filter.</p>
      </td>
    </tr>
  );

  const openCreate = () => setModal({ type: activeTab, mode: "create", record: null });

  const switchToBatteryStatus = (status) => {
    setActiveTab("batteries");
    setList((s)=>({ ...s, status, search: "" }));
  };

  /* Click a battery → show its full compliance record inline (below the row). */
  const openBatteryDetail = async (batteryId) => {
    setExpandedDetail({ batteryId, record: null, documents: [], events: [], loading: true, error: "" });
    try {
      const res = await fetchComplianceBattery(batteryId);
      const data = res?.data || null;
      setExpandedDetail({
        batteryId,
        record: data ? { ...data, documents: undefined, events: undefined } : null,
        documents: data?.documents || [],
        events: data?.events || [],
        loading: false,
        error: data ? "" : "No compliance record exists for this battery yet.",
      });
    } catch (err) {
      setExpandedDetail((s) =>
        s.batteryId === batteryId ? { ...s, loading: false, error: getErrorMessage(err) } : s
      );
    }
  };

  const toggleBatteryDetail = (batteryId) => {
    if (expandedDetail.batteryId === batteryId && !expandedDetail.loading) {
      setExpandedDetail(EMPTY_DETAIL);
      return;
    }
    openBatteryDetail(batteryId);
  };

  const totalBatteries = dropdown.batteries.length || overview?.batteriesTracked || 0;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={ShieldComplianceIcon}
        title="Compliance"
        subtitle="ABC Battery Pvt Ltd · Manufacturer & Service Provider — BWMR 2022 lifecycle tracking"
        actions={
          <button
            onClick={() => {
              if (activeTab === "network") {
                setActiveTab("producers");
                setModal({ type: "producers", mode: "create", record: null });
                return;
              }
              openCreate();
            }}
            className="btn btn-primary px-5 py-3 text-sm w-full sm:w-auto shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === "network" ? "Producer" : TABS.find((t) => t.id === activeTab)?.label.replace(/s$/, "") || "Record"}
          </button>
        }
      />

      <div className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#16263A]">ABC Battery Pvt Ltd</p>
          <p className="text-xs font-semibold text-[#B48611]">Manufacturer & Service Provider</p>
          <p className="text-[11px] text-[#747B83] mt-1">Tracks battery records & lifecycle via third-party partners where applicable</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-3xl font-black text-[#173B5C]">{overview ? overview.batteriesTracked : totalBatteries}</p>
          <p className="text-xs font-bold text-[#747B83]">Total Batteries Tracked</p>
          <p className="text-[10px] text-[#8A9096]">Calculated from PostgreSQL · MaxSpace Compliance Status</p>
        </div>
      </div>

      {overview && (
        <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Compliant", value: overview.compliant, sub: "MaxSpace Compliance Status · Compliant", tone: "text-green-600", status: "Compliant" },
            { label: "Pending", value: overview.pending, sub: "Missing / incomplete information", tone: "text-amber-600", status: "Pending" },
            { label: "Under Review", value: overview.inProgress, sub: "In Progress · requires verification", tone: "text-sky-600", status: "In Progress" },
            { label: "Attention", value: overview.nonCompliant, sub: "Non-Compliant · action required", tone: "text-red-600", status: "Non-Compliant" },
          ].map((stat) => (
            <button key={stat.label} type="button" onClick={()=>switchToBatteryStatus(stat.status)} className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm text-left hover:border-[#173B5C]/30 transition-colors">
              <p className={`text-3xl font-black ${stat.tone}`}>{stat.value}</p>
              <p className="text-xs font-bold text-[#16263A] mt-1">{stat.label}</p>
              <p className="text-[10px] text-[#8A9096] mt-0.5">{stat.sub}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Registered Producers", value: overview.producers, sub: `${overview.activeProducers} active`, tone: "text-[#173B5C]" },
            { label: "Batteries Tracked", value: overview.batteriesTracked, sub: `${overview.compliant} compliant`, tone: "text-green-600" },
            { label: "Open Obligations", value: overview.openObligations, sub: `${overview.pending} pending records`, tone: "text-[#B48611]" },
            { label: "Active Credits", value: overview.creditsActive, sub: `${overview.nonCompliant} non-compliant`, tone: "text-red-600" },
          ].map((stat) => (
            <div key={`sec-${stat.label}`} className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm">
              <p className={`text-3xl font-black ${stat.tone}`}>{stat.value}</p>
              <p className="text-xs font-bold text-[#16263A] mt-1">{stat.label}</p>
              <p className="text-[10px] text-[#8A9096] mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-colors ${
                active
                  ? "bg-[#173B5C] text-white border-[#173B5C] shadow-sm"
                  : "bg-[#FFFDF8] text-[#747B83] border-[#E7E1D3] hover:bg-[#F5F1E7] hover:text-[#16263A]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Network Map tab — visual organisation/facility map (no rows) */}
      {activeTab === "network" ? (
        <div className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="font-black text-[#16263A]">Organisation & Facility Network</h3>
          <p className="text-xs text-[#747B83] mt-0.5">
            Visual map of MaxSpace partner organisations — Manufacturer (Delhi), Service Provider (Noida / Bengaluru),
            Reseller (Gurugram), Recycler (Mumbai), Collection Center (Pune). Click a marker for details.
          </p>
          </div>
          <OrganizationLocationMap
            fetcher={fetchAdminOrganizations}
            showFilters
            height="min(68vh, 640px)"
          />
          <p className="text-[10px] text-[#8A9096] mt-3">
            Development/test coordinates supplied by the backend (backend/utils/organizationLocations.js) —
            MaxSpace stores no map table. Visual indicator only; no navigation or GPS.
          </p>
        </div>
      ) : (
        <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
          <input
            type="text"
            value={list.search}
            onChange={(e) => setList((s) => ({ ...s, search: e.target.value }))}
            placeholder="Search this tab…"
            className="w-full h-12 pl-11 pr-10 rounded-2xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none text-sm text-[#16263A] placeholder:text-[#8A9096] focus:border-[#173B5C] transition shadow-sm"
          />
          {list.search && (
            <button
              type="button"
              onClick={() => setList((s) => ({ ...s, search: "" }))}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9096] hover:text-[#16263A]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="sm:w-64 flex items-center gap-2 px-3.5 rounded-2xl bg-[#FFFDF8] border border-[#E7E1D3] h-12">
          <span className="text-xs font-semibold text-[#747B83] shrink-0">Status:</span>
          <select
            value={list.status}
            onChange={(e) => setList((s) => ({ ...s, status: e.target.value }))}
            className="w-full bg-transparent text-sm font-medium text-[#16263A] focus:outline-none cursor-pointer"
          >
            <option value="">All statuses</option>
            {statusOptionsForTab(activeTab).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {list.error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {list.error}
        </div>
      )}

      <Card padded={false} className="overflow-hidden">
        {list.fetching && list.data.length === 0 ? (
          <div className="min-h-[240px]"><LoadingSpinner minHeight="min-h-[240px]" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F1E7] text-[#747B83] text-xs font-semibold uppercase tracking-wider border-b border-[#EEE9DA]">
                  {(columnsForTab[activeTab] || []).map((col, i) => (
                    <th key={i} className={`px-6 py-4 ${i === (columnsForTab[activeTab].length - 1) ? "text-right" : "text-left"}`}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE9DA]">
                {list.data.length === 0 ? (
                  emptyState()
                ) : (
                  list.data.map((row, idx) => (
                    <Fragment key={row.id ?? row.batteryId ?? idx}>
                      <tr className="hover:bg-[#F5F1E7]/60 transition-colors">
                        {renderRows(row)}
                        {renderRowActions(row)}
                      </tr>
                      {activeTab === "batteries" && expandedDetail.batteryId === row.batteryId && (
                        <tr className="bg-[#F5F1E7]/40">
                          <td colSpan="20" className="px-6 pb-5 pt-1">
                            {expandedDetail.loading ? (
                              <div className="min-h-[120px]"><LoadingSpinner minHeight="min-h-[120px]" /></div>
                            ) : expandedDetail.error ? (
                              <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {expandedDetail.error}
                              </div>
                            ) : (
                              <ExpandedBatteryCompliance detail={expandedDetail} onClose={() => setExpandedDetail(EMPTY_DETAIL)} />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        pagination={list.pagination}
        onPageChange={(nextPage) => fetchList({ tab: activeTab, page: nextPage, search: list.search, status: list.status })}
      />
        </>
      )}

      {/* Create / Edit modals */}
      {modal?.type === "producers" && (
        <ProducerFormModal
          record={modal.mode === "edit" ? modal.record : null}
          onClose={() => setModal(null)}
          onSave={async (idOrPayload, payload) => {
            if (modal.mode === "edit") await handleUpdate("producers", idOrPayload, payload);
            else await handleCreate("producers", payload);
            await reload();
          }}
        />
      )}
      {modal?.type === "batteries" && (
        <BatteryComplianceFormModal
          record={modal.mode === "edit" ? modal.record : null}
          batteries={dropdown.batteries}
          producers={dropdown.producers}
          onClose={() => setModal(null)}
          onSave={async (id, payload) => {
            if (modal.mode === "edit") await handleUpdate("batteries", id, payload);
            else await handleCreate("batteries", payload);
            await reload();
            if (expandedDetail.batteryId === id) await openBatteryDetail(id);
          }}
        />
      )}
      {modal?.type === "obligations" && (
        <ObligationFormModal
          record={modal.mode === "edit" ? modal.record : null}
          producers={dropdown.producers}
          onClose={() => setModal(null)}
          onSave={async (idOrPayload, payload) => {
            if (modal.mode === "edit") await handleUpdate("obligations", idOrPayload, payload);
            else await handleCreate("obligations", payload);
            await reload();
          }}
        />
      )}
      {modal?.type === "credits" && (
        <CreditFormModal
          record={modal.mode === "edit" ? modal.record : null}
          obligations={dropdown.obligations}
          onClose={() => setModal(null)}
          onSave={async (idOrPayload, payload) => {
            if (modal.mode === "edit") await handleUpdate("credits", idOrPayload, payload);
            else await handleCreate("credits", payload);
            await reload();
          }}
        />
      )}
      {modal?.type === "documents" && (
        <DocumentFormModal
          record={modal.mode === "edit" ? modal.record : null}
          batteries={dropdown.batteries}
          producers={dropdown.producers}
          onClose={() => setModal(null)}
          onSave={async (idOrPayload, payload) => {
            if (modal.mode === "edit") await handleUpdate("documents", idOrPayload, payload);
            else await handleCreate("documents", payload);
            await reload();
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          busy={busy}
          onConfirm={async () => {
            if (deleteTarget.type === "batteries") {
              setDeleteTarget(null);
              return;
            }
            setBusy(true);
            try {
              await handleDelete(deleteTarget.type, deleteTarget.id);
              setDeleteTarget(null);
              await reload();
            } catch (err) {
              setDeleteTarget((t) => ({ ...t, wording: getErrorMessage(err) }));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      <div className="flex items-start gap-2 rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8] px-4 py-3">
        <Info className="w-4 h-4 text-[#B48611] mt-0.5 shrink-0" />
        <p className="text-xs text-[#16263A] leading-relaxed">
          Compliance records are maintained from official CPCB EPR registrations and certificates.
          <span className="font-semibold"> Verified in MaxSpace</span> means an administrator checked the record within this
          platform — it does not replace the official CPCB registration/certificate. Removing a producer cascades to its
          obligations and credits; battery records keep a &ldquo;Not verified&rdquo; placeholder instead of being destroyed.
        </p>
      </div>
    </div>
  );
};

const ShieldComplianceIcon = ScrollText;

export default AdminCompliancePage;
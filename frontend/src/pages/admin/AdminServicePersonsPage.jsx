import { useState, useMemo } from "react";
import {
  UserPlus,
  Search,
  Pencil,
  X,
  Mail,
  Phone,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  Eye,
  KeyRound,
  Calendar,
  Sparkles,
  Info,
  Filter,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card } from "../../components/common";
import { Modal } from "../../components/common/Modal";
import { getErrorMessage } from "../../services/adminApi";

/* ============================================================
   Constants
============================================================ */
const SPECIALIZATION_OPTIONS = [
  "BMS Diagnostics",
  "Battery Repair",
  "Battery Maintenance",
  "Battery Installation",
  "LFP Battery Systems",
  "EV Battery Systems",
  "ESS Battery Systems",
  "Electrical Diagnostics",
];

const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;
const TECH_ID_REGEX = /^TECH-\d{4}-\d{4}$/;

/* ============================================================
   Shared Modal Shell
============================================================ */
const ModalShell = ({ title, subtitle, icon: Icon, onClose, children }) => (
  <Modal isOpen={true} onClose={onClose}>
    <div className="relative w-full max-w-lg bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#EEE9DA] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F5F1E7] flex items-center justify-center text-[#16263A] hover:bg-[#E7E1D3] transition-colors shrink-0"
        aria-label="Close modal"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3.5 mb-6 pr-8">
        {Icon && (
          <div className="w-12 h-12 rounded-2xl bg-[#173B5C] flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-bold text-lg sm:text-xl text-[#16263A] truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[#B48611] font-semibold truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div>{children}</div>
    </div>
  </Modal>
);

const ErrorBanner = ({ message }) =>
  message ? (
    <div className="mb-5 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  ) : null;

const SuccessBanner = ({ message }) =>
  message ? (
    <div className="mb-5 flex items-start gap-2 rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  ) : null;

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

const inputClass = "w-full h-11 px-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-sm text-[#16263A] placeholder:text-[#8A9096] focus:border-[#173B5C] outline-none transition";

/* ============================================================
   Technician Form Modal (Create / Edit)
============================================================ */
const TechnicianFormModal = ({ person, onClose, onCreate, onUpdate, onGenerateId }) => {
  const [form, setForm] = useState({
    name: person?.name || "",
    technicianId: person?.technicianId || "",
    phone: person?.phone || "",
    email: person?.email || "",
    certification: person?.certification || "",
    specializations: person?.specializations || [],
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(person);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleSpecialization = (spec) => {
    setForm((prev) => {
      const has = prev.specializations.includes(spec);
      return {
        ...prev,
        specializations: has
          ? prev.specializations.filter((s) => s !== spec)
          : [...prev.specializations, spec],
      };
    });
  };

  const handleGenerateId = () => {
    if (onGenerateId) {
      setForm((prev) => ({
        ...prev,
        technicianId: onGenerateId(prev.name),
      }));
    }
  };

  const validate = () => {
    if (!form.name.trim()) return "Full name is required.";
    if (!form.technicianId.trim()) return "Technician ID is required.";
    if (!TECH_ID_REGEX.test(form.technicianId.trim()))
      return "Technician ID must follow the format TECH-YYYY-NNNN (e.g. TECH-2026-0001).";
    if (!form.phone.trim()) return "Phone number is required.";
    if (!PHONE_REGEX.test(form.phone.trim()))
      return "Invalid phone number format. Use digits, spaces, dashes or + prefix.";
    if (!form.email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return "Invalid email format.";
    if (form.specializations.length === 0)
      return "Select at least one specialization.";
    if (!isEdit) {
      if (!form.password) return "Password is required.";
      if (form.password.length < 6)
        return "Password must be at least 6 characters.";
      if (form.password !== form.confirmPassword)
        return "Passwords do not match.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (isEdit) {
        const { password: _password, confirmPassword: _confirmPassword, ...fields } = form;
        await onUpdate(person.id, fields);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Technician" : "Create Technician"}
      subtitle={
        isEdit
          ? person?.technicianId || "Update technician details"
          : "New battery technician account"
      }
      icon={isEdit ? UserCheck : UserPlus}
      onClose={onClose}
    >
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Markus Vance"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Technician ID" required hint="Format: TECH-2026-0001">
            <div className="flex gap-2">
              <input
                type="text"
                value={form.technicianId}
                onChange={(e) => update("technicianId", e.target.value.toUpperCase())}
                placeholder="TECH-2026-0001"
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                onClick={handleGenerateId}
                title="Auto-generate next Technician ID"
                className="px-3.5 py-2 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#8A7A4A] hover:bg-[#E7E1D3] hover:text-[#B48611] transition-colors shrink-0"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </Field>

          <Field label="Phone Number" required>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+49 30 1234 5678"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Email" required hint="Used for technician login">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="email@maxspace.com"
            className={inputClass}
          />
        </Field>

        <Field label="Certification" hint="Optional, e.g. Cert #1234">
          <input
            type="text"
            value={form.certification}
            onChange={(e) => update("certification", e.target.value)}
            placeholder="e.g. Cert #8812"
            className={inputClass}
          />
        </Field>

        <Field label="Specializations" required hint="Select one or more">
          <div className="flex flex-wrap gap-2 pt-1">
            {SPECIALIZATION_OPTIONS.map((spec) => {
              const selected = form.specializations.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpecialization(spec)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    selected
                      ? "bg-[#173B5C] text-white border-[#173B5C]"
                      : "bg-[#F5F1E7] text-[#747B83] border-[#E7E1D3] hover:bg-[#E7E1D3] hover:text-[#16263A]"
                  }`}
                >
                  {selected && <CheckCircle2 className="w-3 h-3 inline-block mr-1" />}
                  {spec}
                </button>
              );
            })}
          </div>
        </Field>

        {!isEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Password" required hint="Min 6 characters">
              <input
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Enter password"
                className={inputClass}
              />
            </Field>
            <Field label="Confirm Password" required>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder="Re-enter password"
                className={inputClass}
              />
            </Field>
          </div>
        )}

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
            className="flex-1 min-w-[120px] py-3 rounded-2xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors shadow-sm disabled:opacity-60"
          >
            {submitting
              ? "Saving…"
              : isEdit
              ? "Save Changes"
              : "Create Technician"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================
   Reset Password Modal
============================================================ */
const ResetPasswordModal = ({ person, onClose, onReset }) => {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.password) return setError("New password is required.");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match.");
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await onReset(person.id, {
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setSuccess("Password reset successfully.");
      setForm({ password: "", confirmPassword: "" });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Reset Password"
      subtitle={`${person.name} · ${person.technicianId || person.id}`}
      icon={KeyRound}
      onClose={onClose}
    >
      <div className="mb-4 flex items-start gap-2 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] px-4 py-3 text-xs text-[#747B83]">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#8A7A4A]" />
        <span>
          A new password is required for{" "}
          <strong className="text-[#16263A]">{person.name}</strong>. The technician
          will use it to sign in to the Battery Technician panel. Passwords are
          stored as secure hashes and never displayed.
        </span>
      </div>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New Password" required hint="Min 6 characters">
          <input
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Enter new password"
            className={inputClass}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm New Password" required>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => update("confirmPassword", e.target.value)}
            placeholder="Re-enter new password"
            className={inputClass}
            autoComplete="new-password"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[120px] py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
          >
            {success ? "Close" : "Cancel"}
          </button>
          {!success && (
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-w-[120px] py-3 rounded-2xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors shadow-sm disabled:opacity-60"
            >
              {submitting ? "Resetting…" : "Reset Password"}
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================
   View Technician Modal
============================================================ */
const ViewTechnicianModal = ({ person, onClose }) => {
  const specializations = person.specializations || [];

  const rows = [
    { label: "Technician ID", value: person.technicianId || "—", mono: true },
    { label: "Full Name", value: person.name },
    { label: "Email", value: person.email || "—" },
    { label: "Phone", value: person.phone || "—" },
    { label: "Certification", value: person.certification || "No certification" },
    { label: "Status", value: person.status === "active" ? "Active" : "Inactive" },
    { label: "Created", value: person.createdAt || "—" },
    {
      label: "Assigned Services",
      value: `${person.assignedServiceCount ?? (person.assignedServices || []).length}`,
    },
  ];

  return (
    <ModalShell
      title="Technician Details"
      subtitle={person.technicianId || person.id}
      icon={Eye}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3]">
          <div className="w-12 h-12 rounded-2xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-base font-black shrink-0">
            {String(person.name || "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#16263A] truncate">{person.name}</p>
            <p className="text-xs text-[#B48611] font-semibold truncate">
              {specializations.join(" · ") || person.specialization || "No specializations"}
            </p>
          </div>
          <span
            className={`chip border min-w-max ${
              person.status === "active"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                person.status === "active" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {person.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="p-3.5 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3]"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
                {row.label}
              </p>
              <p
                className={`mt-1 text-sm font-semibold text-[#16263A] break-words ${
                  row.mono ? "font-mono text-xs" : ""
                }`}
              >
                {row.value}
              </p>
            </div>
          ))}
        </div>

        <div className="p-3.5 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
            Specializations
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {specializations.length === 0 ? (
              <span className="text-sm text-[#747B83]">None</span>
            ) : (
              specializations.map((spec) => (
                <span
                  key={spec}
                  className="px-2.5 py-1 rounded-lg bg-[#173B5C] text-[#FBF1C9] text-xs font-bold"
                >
                  {spec}
                </span>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
};

/* ============================================================
   Confirmation Modal (Activate / Deactivate)
============================================================ */
const ConfirmStatusModal = ({ person, action, onClose, onConfirm, busy }) => {
  const activating = action === "activate";
  return (
    <ModalShell
      title={activating ? "Activate Technician" : "Deactivate Technician"}
      subtitle={`${person.name} · ${person.technicianId || person.id}`}
      icon={activating ? CheckCircle2 : XCircle}
      onClose={onClose}
    >
      <p className="text-sm text-[#747B83] leading-relaxed mb-6">
        {activating
          ? "This technician will be able to accept new service assignments and sign in to the Battery Technician panel."
          : "This technician will no longer be assignable to new services. Existing assignments are not affected. They will not be able to sign in."}
      </p>
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
          className={`flex-1 min-w-[120px] py-3 rounded-2xl font-bold text-sm transition-colors shadow-sm disabled:opacity-60 ${
            activating
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          {busy ? "Updating…" : activating ? "Activate" : "Deactivate"}
        </button>
      </div>
    </ModalShell>
  );
};

/* ============================================================
   Technician Card
============================================================ */
const TechnicianCard = ({ person, onView, onEdit, onReset, onToggleStatus }) => {
  const specs = person.specializations || (person.specialization ? [person.specialization] : []);
  const active = person.status === "active";
  const assignedCount = person.assignedServiceCount ?? (person.assignedServices || []).length;
  const completedCount = person.completedServiceCount ?? 0;
  const activeCount = person.activeServiceCount ?? 0;

  return (
    <div className="flex flex-col bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 lg:p-7 shadow-sm transition-all duration-300 hover:shadow-md hover:border-[#E7E1D3] hover:-translate-y-0.5">
      {/* Profile section */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-sm font-black shrink-0">
            {String(person.name || "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#16263A] break-words leading-tight">{person.name}</p>
            <p className="font-mono text-xs font-bold text-[#B48611] mt-0.5 break-all">
              {person.technicianId || person.id}
            </p>
          </div>
        </div>
        <span
          className={`chip border text-[10px] shrink-0 min-w-max ${
            active
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-red-500"}`}
          />
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Contact information */}
      <div className="space-y-2 text-xs text-[#747B83]">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
          <span className="break-words">{person.phone || "No phone"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
          <span className="break-all">{person.email || "No email"}</span>
        </div>
        {person.certification && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
            <span className="break-words">{person.certification}</span>
          </div>
        )}
      </div>

      {/* Specializations */}
      {specs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {specs.map((spec) => (
            <span
              key={spec}
              className="px-2.5 py-1 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[10px] font-bold text-[#747B83]"
            >
              {spec}
            </span>
          ))}
        </div>
      )}

      {/* Technician statistics */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <div className="p-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-center">
          <p className="text-lg font-black text-[#16263A] leading-none">
            {assignedCount}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#8A9096]">
            Services
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-center">
          <p className="text-lg font-black text-green-600 leading-none">
            {completedCount}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#8A9096]">
            Completed
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-center">
          <p className="text-lg font-black text-[#B48611] leading-none">
            {activeCount}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#8A9096]">
            Active
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 text-xs text-[#747B83]">
        <Calendar className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
        <span className="break-words">Created {person.createdAt || "—"}</span>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-[#EEE9DA]">
        <button
          type="button"
          onClick={() => onView(person)}
          className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-[#F5F1E7] text-[#16263A] text-xs font-bold border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
        <button
          type="button"
          onClick={() => onEdit(person)}
          className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-[#F5F1E7] text-[#16263A] text-xs font-bold border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onReset(person)}
          className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-[#F5F1E7] text-[#B48611] text-xs font-bold border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Reset Password
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(person)}
          className={`flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
            active
              ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          }`}
        >
          {active ? (
            <>
              <XCircle className="w-3.5 h-3.5" />
              Deactivate
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Activate
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/* ============================================================
   Technician Card Grid
============================================================ */
const TechnicianGrid = ({ persons, onView, onEdit, onReset, onToggleStatus }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
    {persons.map((person) => (
      <TechnicianCard
        key={person.id}
        person={person}
        onView={onView}
        onEdit={onEdit}
        onReset={onReset}
        onToggleStatus={onToggleStatus}
      />
    ))}
  </div>
);

/* ============================================================
   Skeleton cards
============================================================ */
const TechnicianCardSkeletons = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 shadow-sm"
      >
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F5F1E7] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-[#F5F1E7] animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-[#F5F1E7] animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-[#F5F1E7] animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-[#F5F1E7] animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-3">
          <div className="h-5 w-24 rounded-xl bg-[#F5F1E7] animate-pulse" />
          <div className="h-5 w-20 rounded-xl bg-[#F5F1E7] animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="h-14 rounded-2xl bg-[#F5F1E7] animate-pulse" />
          <div className="h-14 rounded-2xl bg-[#F5F1E7] animate-pulse" />
          <div className="h-14 rounded-2xl bg-[#F5F1E7] animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#EEE9DA]">
          <div className="h-9 rounded-xl bg-[#F5F1E7] animate-pulse" />
          <div className="h-9 rounded-xl bg-[#F5F1E7] animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

/* ============================================================
   Main Page
============================================================ */
const AdminServicePersonsPage = () => {
  const {
    servicePersons,
    loading,
    createTechnician,
    updateTechnician,
    toggleTechnicianStatus,
    resetTechnicianPassword,
    refreshTechnicians,
  } = useAdmin();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modal, setModal] = useState(null); // null | "add" | person
  const [resetTarget, setResetTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [actionError, setActionError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);

  const filtered = useMemo(() => {
    let list = [...servicePersons];
    if (statusFilter !== "All") {
      list = list.filter((sp) => sp.status === statusFilter.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (sp) =>
          (sp.name || "").toLowerCase().includes(q) ||
          (sp.email || "").toLowerCase().includes(q) ||
          (sp.technicianId || "").toLowerCase().includes(q) ||
          (sp.phone || "").toLowerCase().includes(q) ||
          (sp.specializations || [])
            .join(" ")
            .toLowerCase()
            .includes(q) ||
          (sp.specialization || "").toLowerCase().includes(q) ||
          (sp.certification || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [servicePersons, search, statusFilter]);

  const generateNextTechnicianId = () => {
    const currentYear = new Date().getFullYear();
    const prefix = `TECH-${currentYear}-`;
    let maxNum = 0;
    servicePersons.forEach((sp) => {
      if (sp.technicianId && sp.technicianId.startsWith(prefix)) {
        const num = parseInt(sp.technicianId.split("-")[2], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setActionError("");
    setStatusBusy(true);
    try {
      await toggleTechnicianStatus(statusTarget.id);
      setStatusTarget(null);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleReset = async (id, data) => {
    await resetTechnicianPassword(id, data);
    try {
      await refreshTechnicians();
    } catch {
      // Best-effort refresh — the reset already succeeded.
    }
  };

  if (loading && servicePersons.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={UserCheck}
          title="Battery Technicians"
          subtitle="Loading registered battery technicians…"
        />
        <div className="flex items-center gap-2.5 px-4 rounded-2xl bg-[#FFFDF8] border border-[#E7E1D3]">
          <Search className="w-4 h-4 text-[#8A9096] shrink-0" />
          <div className="w-full py-3.5 h-5 bg-[#F5F1E7] rounded-xl animate-pulse" />
        </div>
        <TechnicianCardSkeletons />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={UserCheck}
        title="Battery Technicians"
        subtitle={`${servicePersons.length} registered battery technicians`}
        actions={
          <button
            type="button"
            onClick={() => setModal("add")}
            className="btn btn-primary px-5 py-3 text-sm w-full sm:w-auto shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Create Technician
          </button>
        }
      />

      {actionError && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Filters Card */}
      <Card padded={false} className="p-5 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, phone, specialization…"
              className="w-full h-12 pl-11 pr-10 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] outline-none text-sm text-[#16263A] placeholder:text-[#8A9096] focus:border-[#173B5C] transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9096] hover:text-[#16263A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-3.5 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] sm:w-56 h-12">
            <Filter className="w-4 h-4 text-[#8A9096] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[#16263A] focus:outline-none cursor-pointer"
            >
              {["All", "Active", "Inactive"].map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EEE9DA]/60">
          <span className="text-xs font-semibold text-[#747B83] mr-1">Status:</span>
          {["All", "Active", "Inactive"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                statusFilter === status
                  ? "bg-[#173B5C] text-white border-[#173B5C] shadow-sm"
                  : "bg-[#FFFDF8] text-[#747B83] border-[#E7E1D3] hover:bg-[#F5F1E7] hover:text-[#16263A]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </Card>

      {/* Card grid */}
      {!loading && (
        <TechnicianGrid
          persons={filtered}
          onView={setViewTarget}
          onEdit={setModal}
          onReset={setResetTarget}
          onToggleStatus={setStatusTarget}
        />
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-14 bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F5F1E7] flex items-center justify-center mb-4">
            <UserPlus className="w-6 h-6 text-[#8A7A4A]" />
          </div>
          <p className="text-base font-bold text-[#16263A]">
            {servicePersons.length === 0
              ? "No technicians yet"
              : "No technicians match your search"}
          </p>
          <p className="text-xs text-[#747B83] mt-1 max-w-sm mx-auto">
            {servicePersons.length === 0
              ? "Create your first battery technician to get started."
              : "Try adjusting the search query or status filter."}
          </p>
          {servicePersons.length === 0 && (
            <button
              type="button"
              onClick={() => setModal("add")}
              className="btn btn-primary px-5 py-3 text-sm mt-5 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Create Technician
            </button>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <TechnicianFormModal
          person={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onCreate={createTechnician}
          onUpdate={updateTechnician}
          onGenerateId={generateNextTechnicianId}
        />
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <ResetPasswordModal
          person={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={handleReset}
        />
      )}

      {/* View modal */}
      {viewTarget && (
        <ViewTechnicianModal
          person={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}

      {/* Activate / Deactivate confirmation */}
      {statusTarget && (
        <ConfirmStatusModal
          person={statusTarget}
          action={statusTarget.status === "active" ? "deactivate" : "activate"}
          onClose={() => setStatusTarget(null)}
          onConfirm={handleToggleStatus}
          busy={statusBusy}
        />
      )}
    </div>
  );
};

export default AdminServicePersonsPage;

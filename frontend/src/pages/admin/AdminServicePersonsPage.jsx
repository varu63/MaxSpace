import React, { useState, useMemo } from "react";
import {
  UserPlus,
  Search,
  Pencil,
  X,
  Mail,
  Phone,
  Shield,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { getErrorMessage } from "../../services/adminApi";

/* ============================================================
   Add/Edit Service Person Modal
============================================================ */
const PersonModal = ({ person, onClose, onCreate, onUpdate }) => {
  const [form, setForm] = useState({
    name: person?.name || "",
    email: person?.email || "",
    phone: person?.phone || "",
    certification: person?.certification || "",
    specialization: person?.specialization || "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(person);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (isEdit) {
        await onUpdate(person.id, form);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#FFFDF8] rounded-2xl shadow-xl border border-[#EEE9DA] p-6 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#F5F1E7] flex items-center justify-center hover:bg-[#E7E1D3] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-[#173B5C] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#16263A]">
              {isEdit ? "Edit Service Person" : "Add Service Person"}
            </h3>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: "name", label: "Full Name", type: "text", placeholder: "e.g. Markus Vance", required: true },
            { key: "email", label: "Email", type: "email", placeholder: "email@maxspace.com", required: true },
            { key: "phone", label: "Phone", type: "tel", placeholder: "+49 30 1234 5678" },
            { key: "certification", label: "Certification", type: "text", placeholder: "e.g. Cert #1234" },
            { key: "specialization", label: "Specialization", type: "text", placeholder: "e.g. BMS Diagnostics" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-bold text-[#16263A] mb-1.5">
                {field.label}
              </label>
              <input
                type={field.type}
                value={form[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="field-input px-3.5 py-3 text-sm"
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors disabled:opacity-60"
            >
              {submitting
                ? "Saving…"
                : isEdit
                ? "Save Changes"
                : "Add Person"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================
   Main Page
============================================================ */
const AdminServicePersonsPage = () => {
  const {
    servicePersons,
    loading,
    createServicePerson,
    updateServicePerson,
    toggleServicePersonStatus,
  } = useAdmin();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modal, setModal] = useState(null); // null | "add" | person object
  const [actionError, setActionError] = useState("");

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
          (sp.specialization || "").toLowerCase().includes(q) ||
          (sp.certification || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [servicePersons, search, statusFilter]);

  const handleToggleStatus = async (id) => {
    setActionError("");
    try {
      await toggleServicePersonStatus(id);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  if (loading && servicePersons.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCheck}
        title="Service Persons"
        subtitle={`${servicePersons.length} registered service personnel`}
        actions={
          <button
            type="button"
            onClick={() => setModal("add")}
            className="btn btn-primary px-4 py-2.5 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add Person
          </button>
        }
      />

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2.5 px-3.5 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] flex-1 focus-within:border-[#173B5C] transition-colors">
          <Search className="w-4 h-4 text-[#8A9096] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, specialization…"
            className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          {["All", "Active", "Inactive"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                statusFilter === s
                  ? "bg-[#173B5C] text-white border-[#173B5C]"
                  : "bg-[#FFFDF8] text-[#747B83] border-[#EEE9DA] hover:bg-[#F5F1E7]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 text-center py-12">
            <p className="text-sm text-[#747B83]">No service persons found.</p>
          </div>
        ) : (
          filtered.map((person) => (
            <div
              key={person.id}
              className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-sm font-black shrink-0">
                    {person.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#16263A] truncate">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-[#B48611] font-semibold truncate">
                      {person.specialization}
                    </p>
                  </div>
                </div>
                <span
                  className={`chip border text-[10px] shrink-0 ${
                    person.status === "active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      person.status === "active"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  {person.status}
                </span>
              </div>

              <div className="space-y-2 text-xs text-[#747B83]">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
                  <span className="truncate">{person.email}</span>
                </div>
                {person.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
                    <span>{person.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
                  <span>{person.certification || "No certification"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
                  <span>{person.assignedServiceCount || 0} services assigned</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#EEE9DA]">
                <button
                  type="button"
                  onClick={() => setModal(person)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-[#F5F1E7] text-[#16263A] text-xs font-bold border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(person.id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    person.status === "active"
                      ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  }`}
                >
                  {person.status === "active" ? (
                    <>
                      <XCircle className="w-3 h-3" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Activate
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modal && (
        <PersonModal
          person={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onCreate={createServicePerson}
          onUpdate={updateServicePerson}
        />
      )}
    </div>
  );
};

export default AdminServicePersonsPage;
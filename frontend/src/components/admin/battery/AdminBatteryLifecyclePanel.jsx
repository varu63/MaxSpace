/* ============================================================
   ADMIN BATTERY LIFECYCLE PANEL
   The operator-side counterpart to the owner-facing passport
   lifecycle: record events, move custody, authorise an EPR partner,
   log firmware, grade for second life, and check the record's
   integrity.

   Every action here is append-only or audited on the server. There is
   deliberately no control to edit or delete an existing event: the
   ledger is a chain, and a UI that could quietly rewrite history would
   defeat the point of having one.

   The event list is populated from GET /batteries/lifecycle/vocabulary,
   which is the same catalogue the API validates against, so the form
   cannot offer something the server would reject.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Recycle,
  ShieldCheck,
  UserRound,
  Wrench,
  RefreshCcw,
} from "lucide-react";

import {
  appendBatteryLifecycleEvent,
  assignBatteryEolPartner,
  backfillBatteryLifecycle,
  detectBatteryTelemetryEvents,
  fetchBatteryLifecycle,
  fetchComplianceProducers,
  fetchLifecycleVocabulary,
  getErrorMessage,
  recordBatteryFirmware,
  recordBatterySecondLife,
  transferBatteryOwnership,
  updateBatteryEolAssignment,
} from "../../../services/adminApi";

const ACTION_LABELS = {
  append: "Record event",
  transfer: "Transfer ownership",
  partner: "Authorise EPR partner",
  firmware: "Log firmware install",
  secondLife: "Record second life assessment",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const inputClass =
  "w-full rounded-xl border border-[#E7E1D3] bg-white px-3 py-2 text-sm text-[#16263A] outline-none focus:border-[#173B5C]";
const labelClass = "block text-[11px] uppercase tracking-wider text-[#747B83] font-semibold mb-1";
const buttonClass =
  "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#173B5C] text-white text-xs font-bold hover:bg-[#102F4A] transition disabled:opacity-50";

/* Events an operator may pick from, filtered to the ones that make a
   coherent next step. Ordering the catalogue is the server's job; this
   only hides what would be nonsense to offer on a single battery. */
const OFFERED_EVENT_CODES = [
  "note",
  "commissioned",
  "first_owner_registered",
  "ownership_transferred",
  "service_started",
  "service_completed",
  "firmware_updated",
  "retired",
  "collection_arranged",
  "collected",
  "second_life_assessment",
  "refurbished",
  "second_life_deployed",
  "recycled",
  "epr_evidence_recorded",
  "document_uploaded",
];

export default function AdminBatteryLifecyclePanel({ batteryId, onChanged }) {
  const [lifecycle, setLifecycle] = useState(null);
  const [vocabulary, setVocabulary] = useState(null);
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("append");
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, vocab] = await Promise.all([
        fetchBatteryLifecycle(batteryId),
        fetchLifecycleVocabulary(),
      ]);
      setLifecycle(data);
      setVocabulary(vocab);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [batteryId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Partner options are only needed for the authorisation form. */
  useEffect(() => {
    if (action !== "partner" || producers.length > 0) return;
    fetchComplianceProducers({ limit: 100 })
      .then((res) => setProducers(res?.data || res?.producers || []))
      .catch(() => setProducers([]));
  }, [action, producers.length]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const run = async (fn, successMessage) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(successMessage);
      setForm({});
      await load();
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const eventOptions = (vocabulary?.events || []).filter((e) => OFFERED_EVENT_CODES.includes(e.code));
  const chain = lifecycle?.summary?.chain;

  if (loading) {
    return <p className="text-xs text-[#747B83] py-4">Loading lifecycle…</p>;
  }

  return (
    <div className="mt-5 border-t border-[#E7E1D3] pt-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-black text-[#173B5C] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Lifecycle &amp; Custody
        </h4>
        <div className="flex items-center gap-2">
          {chain ? (
            chain.valid ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Chain verified ({chain.eventsChecked})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-200 text-[11px] font-semibold">
                <AlertTriangle className="w-3 h-3" /> Chain broken
              </span>
            )
          ) : null}
          <button type="button" className={buttonClass} onClick={load} disabled={busy}>
            <RefreshCcw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {chain && !chain.valid ? (
        <p className="text-[11px] text-[#C0392B]">
          {chain.reason} (first affected event: {chain.brokenAt || "unknown"})
        </p>
      ) : null}

      {/* summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {[
          ["Stage", lifecycle?.summary?.lifecycleStage],
          ["Events", lifecycle?.summary?.eventCount],
          ["Health events", lifecycle?.summary?.telemetryEventCount],
          ["Firmware", lifecycle?.summary?.firmwareUpdateCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#E7E1D3] bg-[#F5F1E7] px-2 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[#747B83] font-semibold">{label}</p>
            <p className="text-sm font-bold text-[#16263A] break-words">{value ?? 0}</p>
          </div>
        ))}
      </div>

      {!lifecycle?.summary?.eventCount ? (
        <div className="rounded-xl border border-[#F0E6C8] bg-[#FBF1C9] p-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-[#16263A] flex-1 min-w-[200px]">
            This battery has no lifecycle events. It was created before the digital passport existed —
            seed the ledger from its existing manufacturing record.
          </p>
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => run(() => backfillBatteryLifecycle(batteryId), "Lifecycle ledger seeded from the manufacturing record.")}
          >
            <Fingerprint className="w-3 h-3" /> Seed ledger
          </button>
        </div>
      ) : null}

      {/* recent events */}
      <div>
        <p className={labelClass}>Recent events</p>
        <div className="max-h-56 overflow-y-auto border border-[#E7E1D3] rounded-xl">
          {(lifecycle?.events || []).length === 0 ? (
            <p className="text-xs text-[#747B83] p-3">No events recorded.</p>
          ) : (
            lifecycle.events.slice(0, 12).map((event) => (
              <div key={event.id} className="border-b border-[#EEE9DA] last:border-b-0 px-3 py-2">
                <p className="text-xs font-semibold text-[#16263A]">
                  {event.eventType}
                  {event.lifecycleStage ? ` · ${event.lifecycleStage}` : ""}
                </p>
                <p className="text-[11px] text-[#8A9099]">
                  {formatDateTime(event.occurredAt)}
                  {event.actorName ? ` · ${event.actorName}` : ""} · {event.source}
                </p>
                {event.notes ? <p className="text-[11px] text-[#747B83] italic mt-0.5">{event.notes}</p> : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* custody chain */}
      <div>
        <p className={labelClass}>Custody chain</p>
        <div className="border border-[#E7E1D3] rounded-xl">
          {(lifecycle?.ownership || []).length === 0 ? (
            <p className="text-xs text-[#747B83] p-3">No custody periods recorded.</p>
          ) : (
            lifecycle.ownership.map((record) => (
              <div key={record.id} className="border-b border-[#EEE9DA] last:border-b-0 px-3 py-2 flex items-center gap-2">
                <UserRound className="w-3.5 h-3.5 text-[#173B5C] shrink-0" />
                <span className="text-xs text-[#16263A] font-semibold">{record.ownerName || "Unassigned"}</span>
                <span className="text-[11px] text-[#8A9099]">
                  {record.acquiredAt ? new Date(record.acquiredAt).toLocaleDateString("en-GB") : ""} →{" "}
                  {record.releasedAt ? new Date(record.releasedAt).toLocaleDateString("en-GB") : "present"}
                </span>
                {record.isCurrent ? (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200 font-semibold">
                    current
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* EOL assignments */}
      <div>
        <p className={labelClass}>End-of-life assignments</p>
        <div className="border border-[#E7E1D3] rounded-xl">
          {(lifecycle?.eolAssignments || []).length === 0 ? (
            <p className="text-xs text-[#747B83] p-3">No partner has been authorised for this battery.</p>
          ) : (
            lifecycle.eolAssignments.map((assignment) => (
              <div key={assignment.id} className="border-b border-[#EEE9DA] last:border-b-0 px-3 py-2 flex flex-wrap items-center gap-2">
                <Recycle className="w-3.5 h-3.5 text-[#173B5C] shrink-0" />
                <span className="text-xs text-[#16263A] font-semibold">{assignment.partnerName}</span>
                <span className="text-[11px] text-[#8A9099]">{assignment.partnerRole}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#E7E1D3] bg-[#F5F1E7] font-semibold">
                  {assignment.status}
                </span>
                {assignment.status === "active" ? (
                  <span className="ml-auto flex gap-1.5">
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 rounded-lg border border-[#E7E1D3] font-semibold hover:bg-[#F5F1E7]"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => updateBatteryEolAssignment(batteryId, assignment.id, "complete"),
                          `Assignment to ${assignment.partnerName} completed.`
                        )
                      }
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => updateBatteryEolAssignment(batteryId, assignment.id, "revoke"),
                          `Assignment to ${assignment.partnerName} revoked.`
                        )
                      }
                    >
                      Revoke
                    </button>
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* actions */}
      <div className="border-t border-[#E7E1D3] pt-4">
        <p className={labelClass}>Record</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setAction(key);
                setForm({});
              }}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                action === key
                  ? "bg-[#173B5C] text-white border-[#173B5C]"
                  : "border-[#E7E1D3] text-[#16263A] hover:bg-[#F5F1E7]"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[#E7E1D3] text-[#16263A] font-semibold hover:bg-[#F5F1E7]"
            disabled={busy}
            onClick={() =>
              run(
                () => detectBatteryTelemetryEvents(batteryId),
                "Telemetry scan complete. New events, if any, are now listed."
              )
            }
          >
            Scan telemetry for events
          </button>
        </div>

        {notice ? <p className="text-[11px] text-green-700 mb-2">{notice}</p> : null}
        {error ? <p className="text-[11px] text-[#C0392B] mb-2">{error}</p> : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {action === "append" ? (
            <>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="lc-event">Event</label>
                <select id="lc-event" className={inputClass} value={form.eventCode || ""} onChange={set("eventCode")}>
                  <option value="">Select an event…</option>
                  {eventOptions.map((event) => (
                    <option key={event.code} value={event.code}>
                      {event.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-new">New value</label>
                <input id="lc-new" className={inputClass} value={form.newValue || ""} onChange={set("newValue")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-occurred">Occurred at</label>
                <input
                  id="lc-occurred"
                  type="datetime-local"
                  className={inputClass}
                  value={form.occurredAt || ""}
                  onChange={set("occurredAt")}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="lc-notes">Notes</label>
                <textarea id="lc-notes" rows={2} className={inputClass} value={form.notes || ""} onChange={set("notes")} />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || !form.eventCode}
                  onClick={() =>
                    run(
                      () =>
                        appendBatteryLifecycleEvent(batteryId, {
                          eventCode: form.eventCode,
                          newValue: form.newValue || null,
                          occurredAt: form.occurredAt || null,
                          notes: form.notes || null,
                        }),
                      "Event appended to the lifecycle ledger."
                    )
                  }
                >
                  Append to ledger
                </button>
              </div>
            </>
          ) : null}

          {action === "transfer" ? (
            <>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="lc-owner">New owner user id</label>
                <input
                  id="lc-owner"
                  className={inputClass}
                  placeholder="Leave empty to release the battery"
                  value={form.newOwnerId || ""}
                  onChange={set("newOwnerId")}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-reason">Transfer reference</label>
                <input id="lc-reason" className={inputClass} value={form.transferReference || ""} onChange={set("transferReference")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-type">Ownership type</label>
                <select id="lc-type" className={inputClass} value={form.ownershipType || "transfer"} onChange={set("ownershipType")}>
                  {["first_owner", "transfer", "resale", "lease", "battery_as_a_service", "release", "return_to_producer"].map(
                    (type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        transferBatteryOwnership(batteryId, {
                          newOwnerId: form.newOwnerId || null,
                          ownershipType: form.ownershipType || "transfer",
                          transferReference: form.transferReference || null,
                          notes: form.notes || null,
                        }),
                      "Custody transferred and recorded in the ledger."
                    )
                  }
                >
                  <UserRound className="w-3 h-3" /> Transfer custody
                </button>
              </div>
            </>
          ) : null}

          {action === "partner" ? (
            <>
              <div>
                <label className={labelClass} htmlFor="lc-partner">Partner (EPR producer)</label>
                <select id="lc-partner" className={inputClass} value={form.partnerId || ""} onChange={set("partnerId")}>
                  <option value="">Select a partner…</option>
                  {producers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.producerName || p.producer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-role">Role</label>
                <select id="lc-role" className={inputClass} value={form.partnerRole || "recycler"} onChange={set("partnerRole")}>
                  {["collection_center", "recycler", "refurbisher", "auditor"].map((role) => (
                    <option key={role} value={role}>
                      {role.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-expires">Access expires</label>
                <input
                  id="lc-expires"
                  type="date"
                  className={inputClass}
                  value={form.accessExpiresAt || ""}
                  onChange={set("accessExpiresAt")}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-address">Collection address</label>
                <input id="lc-address" className={inputClass} value={form.collectionAddress || ""} onChange={set("collectionAddress")} />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || !form.partnerId}
                  onClick={() =>
                    run(
                      () =>
                        assignBatteryEolPartner(batteryId, {
                          partnerId: Number(form.partnerId),
                          partnerRole: form.partnerRole || "recycler",
                          accessExpiresAt: form.accessExpiresAt || null,
                          collectionAddress: form.collectionAddress || null,
                        }),
                      "Partner authorised for end-of-life handling."
                    )
                  }
                >
                  <Recycle className="w-3 h-3" /> Authorise partner
                </button>
              </div>
            </>
          ) : null}

          {action === "firmware" ? (
            <>
              <div>
                <label className={labelClass} htmlFor="lc-fw">Firmware version</label>
                <input id="lc-fw" className={inputClass} value={form.firmwareVersion || ""} onChange={set("firmwareVersion")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-fwprev">Previous version</label>
                <input id="lc-fwprev" className={inputClass} value={form.previousVersion || ""} onChange={set("previousVersion")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-fwresult">Result</label>
                <select id="lc-fwresult" className={inputClass} value={form.result || "Success"} onChange={set("result")}>
                  {["Success", "Failed", "Rolled Back"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || !form.firmwareVersion}
                  onClick={() =>
                    run(
                      () =>
                        recordBatteryFirmware(batteryId, {
                          firmwareVersion: form.firmwareVersion,
                          previousVersion: form.previousVersion || null,
                          result: form.result || "Success",
                        }),
                      "Firmware install recorded."
                    )
                  }
                >
                  <Wrench className="w-3 h-3" /> Record install
                </button>
              </div>
            </>
          ) : null}

          {action === "secondLife" ? (
            <>
              <div>
                <label className={labelClass} htmlFor="lc-grade">Grade</label>
                <select id="lc-grade" className={inputClass} value={form.grade || ""} onChange={set("grade")}>
                  <option value="">Select a grade…</option>
                  {["A", "B", "C", "Not Suitable"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-decision">Decision</label>
                <select id="lc-decision" className={inputClass} value={form.decision || ""} onChange={set("decision")}>
                  <option value="">Select a decision…</option>
                  {["second_life", "repair", "recycle", "reuse_application", "pending_inspection", "reject"].map((d) => (
                    <option key={d} value={d}>
                      {d.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-soh">Health %</label>
                <input id="lc-soh" type="number" min="0" max="100" className={inputClass} value={form.healthPercent || ""} onChange={set("healthPercent")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lc-cap">Capacity %</label>
                <input id="lc-cap" type="number" min="0" max="100" className={inputClass} value={form.capacityPercent || ""} onChange={set("capacityPercent")} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="lc-slnotes">Assessment notes</label>
                <textarea id="lc-slnotes" rows={2} className={inputClass} value={form.decisionNotes || ""} onChange={set("decisionNotes")} />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || !form.grade || !form.decision}
                  onClick={() =>
                    run(
                      () =>
                        recordBatterySecondLife(batteryId, {
                          grade: form.grade,
                          decision: form.decision,
                          healthPercent: form.healthPercent || null,
                          capacityPercent: form.capacityPercent || null,
                          decisionNotes: form.decisionNotes || null,
                        }),
                      "Second-life assessment recorded."
                    )
                  }
                >
                  Record assessment
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
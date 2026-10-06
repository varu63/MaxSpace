/* ============================================================
   BATTERY LIFECYCLE SECTION
   Renders the passport's history: the append-only event ledger and
   its integrity check, the custody chain, where each value came from,
   firmware history, derived battery-health events, and the
   end-of-life record (partner assignment + second-life assessment).

   Everything here comes from `passport.lifecycle`, which the backend
   already returns alongside the passport. A public barcode scan gets
   the summary only — the API withholds event rows, actor names and
   previous owners from callers who are not the owner — so this
   component renders a reduced, honest view rather than implying the
   detail exists.

   Nothing here is mocked. An absent fact is shown as "not recorded",
   never as a plausible default.
   ============================================================ */
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Link2,
  Microscope,
  Recycle,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";

import { DetailRow, InfoBlock } from "../../common";

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const valueOr = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : value;

const NOT_RECORDED = "Not recorded";

const SEVERITY_BADGE = {
  info: "bg-slate-100 text-slate-700 border-slate-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

const CLASSIFICATION_BADGE = {
  authoritative: "bg-[#E7EFF5] text-[#173B5C] border-[#C9DCEB]",
  measured: "bg-green-100 text-green-800 border-green-200",
  derived: "bg-sky-100 text-sky-800 border-sky-200",
  service: "bg-violet-100 text-violet-800 border-violet-200",
  user_supplied: "bg-amber-100 text-amber-800 border-amber-200",
  unclassified_legacy: "bg-slate-100 text-slate-600 border-slate-200",
};

const SOURCE_LABELS = {
  manufacturer_system: "Manufacturer system",
  manufacturing_record: "Manufacturing record",
  bms_telemetry: "BMS telemetry",
  service_technician: "Service technician",
  inspection: "Inspection",
  admin: "MaxSpace admin",
  user: "Battery owner",
  derived_calculated: "Derived (calculated)",
  import: "Import",
  legacy_registration: "Legacy registration",
  legacy_unknown: "Unknown source",
};

const EVENT_SOURCE_LABELS = {
  ...SOURCE_LABELS,
  manufacturing_record: "Manufacturing record",
  bms_telemetry: "BMS telemetry",
  service_technician: "Service technician",
  legacy_registration: "Imported record",
};

const badge = (text, className) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${className}`}>
    {text}
  </span>
);

/* ---------- chain integrity ---------- */

function ChainIntegrity({ chain }) {
  if (!chain) return null;
  if (chain.valid) {
    return badge(
      `Verified · ${chain.eventsChecked} event${chain.eventsChecked === 1 ? "" : "s"}`,
      "bg-green-100 text-green-800 border-green-200"
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-200 text-[11px] font-semibold"
      title={chain.reason || "The lifecycle chain did not verify."}
    >
      <AlertTriangle className="w-3 h-3" />
      Integrity check failed
    </span>
  );
}

/* ---------- lifecycle timeline ---------- */

function LifecycleTimeline({ events }) {
  if (!Array.isArray(events)) return null;
  if (events.length === 0) {
    return (
      <DetailRow icon={Activity} label="Lifecycle Events" value={NOT_RECORDED} variant="passport" />
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event) => (
        <div key={event.id} className="border-b border-[#EEE9DA] last:border-b-0 py-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F5F1E7] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-[#173B5C]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#16263A]">{valueOr(event.eventType, event.eventCode)}</p>
                {event.lifecycleStage && badge(event.lifecycleStage, "bg-[#F1EFE7] text-[#4A5568] border-[#DFDACE]")}
              </div>
              <p className="text-xs text-[#747B83] mt-0.5">
                {formatDateTime(event.occurredAt)}
                {event.actorName ? ` · ${event.actorName}` : ""}
                {event.serviceTicket ? ` · Ticket ${event.serviceTicket}` : ""}
              </p>
              <p className="text-[11px] text-[#8A9099] mt-0.5">
                Recorded by {EVENT_SOURCE_LABELS[event.source] || valueOr(event.source)}
                {event.recordedAt && event.occurredAt ? ` · logged ${formatDateTime(event.recordedAt)}` : ""}
              </p>
              {(event.previousValue || event.newValue) && (
                <p className="text-xs text-[#4A5568] mt-1">
                  {event.previousValue ? <span className="line-through opacity-70">{event.previousValue}</span> : null}
                  {event.previousValue && event.newValue ? " → " : null}
                  {event.newValue ? <span className="font-semibold">{event.newValue}</span> : null}
                </p>
              )}
              {event.notes && <p className="text-xs text-[#747B83] mt-1 italic">{event.notes}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- custody chain ---------- */

function OwnershipHistory({ history }) {
  if (!Array.isArray(history)) return null;
  if (history.length === 0) {
    return <DetailRow icon={UserRound} label="Custody Record" value={NOT_RECORDED} variant="passport" />;
  }

  return (
    <div>
      {history.map((record) => (
        <div key={record.id} className="border-b border-[#EEE9DA] last:border-b-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#16263A]">
              {valueOr(record.ownerName, "Unassigned")}
            </p>
            {record.isCurrent ? badge("Current holder", "bg-green-100 text-green-800 border-green-200") : null}
          </div>
          <p className="text-xs text-[#747B83] mt-0.5">
            {formatDate(record.acquiredAt)} → {record.releasedAt ? formatDate(record.releasedAt) : "present"}
            {record.ownershipType ? ` · ${record.ownershipType.replace(/_/g, " ")}` : ""}
          </p>
          {record.transferReference ? (
            <p className="text-[11px] text-[#8A9099] mt-0.5">Reference: {record.transferReference}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ---------- provenance ---------- */

function ProvenanceList({ provenance }) {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    return (
      <DetailRow
        icon={Microscope}
        label="Field Provenance"
        value="No field sources have been recorded for this battery yet."
        variant="passport"
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 text-[11px] text-[#8A9099]">
        <span>Field</span>
        <span>Classification</span>
        <span>Source</span>
      </div>
      {provenance.map((entry) => (
        <div key={entry.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-2 border-b border-[#EEE9DA] last:border-b-0">
          <span className="text-xs font-semibold text-[#16263A]">{entry.fieldName}</span>
          <span>
            {badge(
              entry.classification.replace(/_/g, " "),
              CLASSIFICATION_BADGE[entry.classification] || CLASSIFICATION_BADGE.unclassified_legacy
            )}
          </span>
          <span className="text-[11px] text-[#747B83]">
            {SOURCE_LABELS[entry.source] || entry.source}
            {entry.recordedAt ? ` · ${formatDate(entry.recordedAt)}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- derived health events ---------- */

function TelemetryEventList({ events }) {
  if (!Array.isArray(events) || events.length === 0) {
    return (
      <DetailRow
        icon={AlertTriangle}
        label="Detected Health Events"
        value="No threshold breaches detected in the recorded telemetry."
        variant="passport"
      />
    );
  }

  return (
    <div>
      {events.map((event) => (
        <div key={event.id} className="border-b border-[#EEE9DA] last:border-b-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#16263A]">
              {valueOr(event.eventType, "health event").replace(/_/g, " ")}
            </p>
            {badge(event.severity, SEVERITY_BADGE[event.severity] || SEVERITY_BADGE.info)}
          </div>
          <p className="text-xs text-[#747B83] mt-0.5">
            {formatDateTime(event.occurredAt)}
            {event.measuredValue !== null && event.measuredValue !== undefined
              ? ` · measured ${event.measuredValue}${event.unit ? ` ${event.unit}` : ""}`
              : ""}
            {event.thresholdValue !== null && event.thresholdValue !== undefined
              ? ` · threshold ${event.thresholdValue}${event.unit ? ` ${event.unit}` : ""}`
              : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------- end of life ---------- */

function EndOfLife({ assignments, assessments }) {
  const hasEol =
    (Array.isArray(assignments) && assignments.length > 0) ||
    (Array.isArray(assessments) && assessments.length > 0);

  if (!hasEol) {
    return (
      <DetailRow
        icon={Recycle}
        label="End of Life"
        value="Not retired and not assigned for collection. Nothing to report yet."
        variant="passport"
      />
    );
  }

  return (
    <div>
      {assignments?.map((assignment) => (
        <div key={assignment.id} className="border-b border-[#EEE9DA] last:border-b-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#16263A]">{assignment.partnerName}</p>
            {badge(
              assignment.status,
              assignment.status === "active"
                ? "bg-green-100 text-green-800 border-green-200"
                : assignment.status === "completed"
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-red-100 text-red-800 border-red-200"
            )}
            <span className="text-[11px] text-[#8A9099]">{assignment.partnerRole.replace(/_/g, " ")}</span>
          </div>
          <p className="text-xs text-[#747B83] mt-0.5">
            Assigned {formatDate(assignment.assignedAt)}
            {assignment.accessExpiresAt ? ` · access until ${formatDate(assignment.accessExpiresAt)}` : ""}
          </p>
          {assignment.collectionAddress ? (
            <p className="text-[11px] text-[#8A9099] mt-0.5">Collection: {assignment.collectionAddress}</p>
          ) : null}
        </div>
      ))}

      {assessments?.map((assessment) => (
        <div key={assessment.id} className="border-b border-[#EEE9DA] last:border-b-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#16263A]">
              Second life: {valueOr(assessment.grade, "ungraded")} · {valueOr(assessment.decision, "pending").replace(/_/g, " ")}
            </p>
          </div>
          <p className="text-xs text-[#747B83] mt-0.5">
            Assessed {formatDate(assessment.assessedAt)}
            {assessment.assessorName ? ` by ${assessment.assessorName}` : ""}
            {assessment.partnerName ? ` (${assessment.partnerName})` : ""}
          </p>
          {assessment.healthPercent !== null && assessment.healthPercent !== undefined ? (
            <p className="text-[11px] text-[#8A9099] mt-0.5">
              Health {assessment.healthPercent}%
              {assessment.capacityPercent !== null && assessment.capacityPercent !== undefined
                ? ` · capacity ${assessment.capacityPercent}%`
                : ""}
            </p>
          ) : null}
          {assessment.decisionNotes ? (
            <p className="text-xs text-[#747B83] mt-1 italic">{assessment.decisionNotes}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ---------- firmware ---------- */

function FirmwareHistory({ history }) {
  if (!Array.isArray(history) || history.length === 0) {
    return (
      <DetailRow
        icon={Wrench}
        label="Firmware History"
        value="No firmware install has been recorded for this battery."
        variant="passport"
      />
    );
  }

  return (
    <div>
      {history.map((entry) => (
        <div key={entry.id} className="border-b border-[#EEE9DA] last:border-b-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#16263A]">
              {entry.previousVersion ? `${entry.previousVersion} → ` : ""}
              {entry.firmwareVersion}
            </p>
            {entry.result !== "Success" ? badge(entry.result, SEVERITY_BADGE.warning) : null}
          </div>
          <p className="text-xs text-[#747B83] mt-0.5">
            {formatDate(entry.installedAt)}
            {entry.bmsModel ? ` · ${entry.bmsModel}` : ""}
            {entry.installedByName ? ` · by ${entry.installedByName}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------- component ---------- */

export default function BatteryLifecycleSection({ lifecycle }) {
  const summary = lifecycle?.summary;

  if (!summary) return null;

  const stage = valueOr(summary.lifecycleStage, "Unknown");
  const reduced = !lifecycle.events;

  return (
    <>
      <InfoBlock title="Lifecycle &amp; Custody" icon={ShieldCheck} variant="passport">
        <DetailRow icon={Activity} label="Current Stage" value={stage} variant="passport" />
        <DetailRow
          icon={Link2}
          label="Lifecycle Events"
          value={summary.eventCount > 0 ? `${summary.eventCount} recorded` : NOT_RECORDED}
          variant="passport"
        />
        <DetailRow
          icon={Fingerprint}
          label="Passport Source"
          value={
            summary.registrationOrigin
              ? summary.registrationOrigin.replace(/_/g, " ")
              : "Not classified — this battery predates the digital passport"
          }
          variant="passport"
        />
        <DetailRow icon={CheckCircle2} label="Last Activity" value={formatDateTime(summary.lastLifecycleEventAt)} variant="passport" />
        <div className="flex items-center justify-between py-3 border-t border-[#EEE9DA]">
          <span className="text-xs text-[#747B83]">Record Integrity</span>
          <ChainIntegrity chain={summary.chain} />
        </div>
        {!summary.chain?.valid && summary.chain?.reason ? (
          <p className="text-[11px] text-[#C0392B] pb-2">
            {summary.chain.reason} (first affected event: {valueOr(summary.chain.brokenAt)})
          </p>
        ) : null}
      </InfoBlock>

      {reduced ? (
        <InfoBlock title="Lifecycle History" icon={Activity} variant="passport">
          <DetailRow
            icon={ShieldCheck}
            label="History Access"
            value="Sign in as the battery owner to view the full lifecycle history."
            variant="passport"
          />
        </InfoBlock>
      ) : (
        <>
          <InfoBlock title="Lifecycle History" icon={Activity} variant="passport">
            <LifecycleTimeline events={lifecycle.events} />
          </InfoBlock>

          <InfoBlock title="Custody Chain" icon={UserRound} variant="passport">
            <OwnershipHistory history={lifecycle.ownership} />
          </InfoBlock>

          <InfoBlock title="Data Provenance" icon={Microscope} variant="passport">
            <ProvenanceList provenance={lifecycle.provenance} />
          </InfoBlock>

          <InfoBlock title="Firmware &amp; BMS" icon={Wrench} variant="passport">
            <FirmwareHistory history={lifecycle.firmware} />
          </InfoBlock>

          <InfoBlock title="Detected Health Events" icon={AlertTriangle} variant="passport">
            <TelemetryEventList events={lifecycle.telemetryEvents} />
          </InfoBlock>

          <InfoBlock title="End of Life &amp; Second Life" icon={Recycle} variant="passport">
            <EndOfLife assignments={lifecycle.eolAssignments} assessments={lifecycle.secondLifeAssessments} />
          </InfoBlock>
        </>
      )}
    </>
  );
}
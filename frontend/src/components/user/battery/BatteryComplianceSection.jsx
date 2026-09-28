/* ============================================================
   BATTERY COMPLIANCE SECTION (India · BWMR 2022)
   Read-only compliance summary displayed on the battery passport.
   Fetches GET /batteries/:id/compliance which returns
   { success, data, available }:
     - unavailable → honest "not yet tracked" state (never fabricated)
     - available   → producer, category, status, verification and the
                     recent compliance audit events
   The section deliberately distinguishes what MaxSpace verified
   (verifiedInApp) from what CPCB officially registered — that nuance
   is surfaced to the reader instead of being blurred.
============================================================ */
import { useCallback, useEffect, useState } from "react";
import {
  Leaf,
  Factory,
  Hash,
  FileText,
  ScrollText,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
} from "lucide-react";

import { fetchBatteryCompliance } from "../../../services";
import { DetailRow, InfoBlock, LoadingSpinner } from "../../common";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

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

const valueOr = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : value;

const STATUS_BADGE = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  "In Progress": "bg-sky-100 text-sky-800 border-sky-200",
  Compliant: "bg-green-100 text-green-800 border-green-200",
  "Non-Compliant": "bg-red-100 text-red-800 border-red-200",
  Exempt: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function BatteryComplianceSection({ batteryId }) {
  const [compliance, setCompliance] = useState(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBatteryCompliance(batteryId);
      setCompliance(data?.data || null);
      setAvailable(Boolean(data?.available));
    } catch (err) {
      setError(err?.message || "Compliance record unavailable.");
    } finally {
      setLoading(false);
    }
  }, [batteryId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <InfoBlock title="India Compliance (BWMR 2022)" icon={Leaf} variant="passport">
        <div className="py-6">
          <LoadingSpinner minHeight="min-h-[120px]" />
        </div>
      </InfoBlock>
    );
  }

  if (error) {
    return (
      <InfoBlock title="India Compliance (BWMR 2022)" icon={Leaf} variant="passport">
        <div className="rounded-xl bg-[#FBEDED] border border-[#F2C4C0] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#C0392B] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#16263A]">Compliance record unavailable</p>
              <p className="text-xs text-[#747B83] mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#173B5C] text-white text-xs font-bold hover:bg-[#102F4A] transition-colors"
            >
              <RefreshCcw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      </InfoBlock>
    );
  }

  if (!available || !compliance) {
    return (
      <InfoBlock title="India Compliance (BWMR 2022)" icon={Leaf} variant="passport">
        <div className="rounded-xl bg-[#F5F1E7] border border-dashed border-[#E7E1D3] p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#B48611] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#16263A]">Not yet tracked</p>
              <p className="text-xs text-[#747B83] mt-1 leading-relaxed">
                No Battery Waste Management Rules (BWMR 2022) compliance record has been entered
                for this battery yet. Nothing is shown here until a producer registration and a
                compliance status are recorded for it.
              </p>
            </div>
          </div>
        </div>
      </InfoBlock>
    );
  }

  const p = compliance.producer || null;
  const documents = compliance.documents || [];
  const events = compliance.events || [];
  const hasEOL = Boolean(compliance.collectionStatus || compliance.recyclingStatus || compliance.collectionDate || compliance.recyclingDate || compliance.recyclerName || compliance.refurbisherName);

  return (
    <InfoBlock title="India Compliance (BWMR 2022)" icon={Leaf} variant="passport">
      <p className="text-[10px] font-semibold text-[#8A9096] mt-1">MaxSpace Compliance Status — based on recorded database information, not an official legal certification</p>
      <div className="flex flex-wrap items-center gap-2 mt-3 mb-1">
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide bg-[#173B5C] text-white">
          {valueOr(compliance.framework)}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold border ${
            STATUS_BADGE[compliance.complianceStatus] || "bg-slate-100 text-slate-600 border-slate-200"
          }`}
        >
          {valueOr(compliance.complianceStatus, "Unknown status")}
        </span>
        {compliance.verifiedInApp ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 border border-green-200 px-2.5 py-1 text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            Verified in MaxSpace
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[10px] font-bold">
            Not verified in MaxSpace
          </span>
        )}
      </div>

      <DetailRow icon={Factory} label="Manufacturer" value="ABC Battery Pvt Ltd" variant="passport" />
      <DetailRow icon={Factory} label="Service Provider" value="ABC Battery Pvt Ltd" variant="passport" />
      <DetailRow icon={Factory} label="Producer (CPCB Registered)" value={p ? valueOr(p.producerName) : "Not available"} variant="passport" />
      <DetailRow icon={Hash} label="CPCB Registration Number" value={p ? valueOr(p.registrationNumber) : "Not available"} variant="passport" />
      <DetailRow icon={Factory} label="Producer Category" value={p ? valueOr(p.producerCategory) : "Not available"} variant="passport" />
      <DetailRow icon={Hash} label="Registration Status" value={p ? valueOr(p.status) : "Not available"} variant="passport" />
      <DetailRow icon={Hash} label="Registration Valid Until" value={p ? formatDate(p.registrationValidUntil) : "Not available"} variant="passport" />
      <DetailRow icon={Leaf} label="Battery Category (BWMR)" value={valueOr(compliance.batteryCategory, "Not available")} variant="passport" />
      <DetailRow icon={Leaf} label="Collection Channel" value={valueOr(compliance.collectionChannel, "Not available")} variant="passport" />
      <DetailRow icon={Hash} label="EPR Reference" value={valueOr(compliance.eprReference, "Not available")} variant="passport" />
      {compliance.verifiedInApp && (
        <DetailRow icon={Clock} label="Verified At" value={formatDateTime(compliance.verifiedAt)} variant="passport" />
      )}
      <DetailRow icon={FileText} label="Notes" value={valueOr(compliance.notes, "No additional notes")} variant="passport" />

      <div className="pt-3 pb-1 mt-2 border-t border-[#EEE9DA]">
        <p className="text-[10px] font-bold text-[#9A8240] uppercase tracking-wide">End-of-Life Tracking</p>
        <p className="text-[10px] text-[#8A9096]">End-of-Life is tracked, not performed, by ABC Battery — handlers are third-party partners where applicable</p>
      </div>
      {!hasEOL ? (
        <DetailRow icon={Leaf} label="End of Life" value="Not Applicable — battery is active, no end-of-life record" variant="passport" />
      ) : (
        <>
          <DetailRow icon={Leaf} label="Collection Status" value={valueOr(compliance.collectionStatus, "Not available")} variant="passport" />
          <DetailRow icon={Clock} label="Collection Date" value={compliance.collectionDate ? formatDate(compliance.collectionDate) : "Not available"} variant="passport" />
          <DetailRow icon={Factory} label="Collection Location" value={valueOr(compliance.collectionLocation, "Not available")} variant="passport" />
          <DetailRow icon={Factory} label="Handled By (Third-Party Partner)" value={valueOr(compliance.recyclerName || compliance.refurbisherName, "Not assigned")} variant="passport" />
          {compliance.recyclerName && <DetailRow icon={Factory} label="Recycler" value={`${valueOr(compliance.recyclerName)}${compliance.recyclerRegistration ? ` — ${compliance.recyclerRegistration}` : ""}${compliance.recyclingFacility ? ` · ${compliance.recyclingFacility}` : ""}`} variant="passport" />}
          {compliance.refurbisherName && <DetailRow icon={Factory} label="Refurbisher" value={valueOr(compliance.refurbisherName)} variant="passport" />}
          <DetailRow icon={Leaf} label="Recycling Status" value={valueOr(compliance.recyclingStatus, "Not available")} variant="passport" />
          <DetailRow icon={Clock} label="Recycling Date" value={compliance.recyclingDate ? formatDate(compliance.recyclingDate) : "Not available"} variant="passport" />
          <DetailRow icon={FileText} label="Recycling Certificate / Evidence" value={valueOr(compliance.recyclingCertificate, "Not available")} variant="passport" />
          <div className="rounded-lg bg-[#F5F1E7] border border-[#E7E1D3] p-2 mt-2">
            <p className="text-[10px] text-[#16263A]"><span className="font-bold">Manufacturer:</span> ABC Battery Pvt Ltd <span className="mx-1">·</span> <span className="font-bold">Recycler/Refurbisher:</span> {valueOr(compliance.recyclerName || compliance.refurbisherName, "Not assigned (third-party)")} </p>
          </div>
        </>
      )}

      <div className="pt-2 pb-1">
        <p className="text-[10px] font-bold text-[#9A8240] uppercase tracking-wide">
          Compliance Documents & Certificates
        </p>
        <p className="text-[10px] text-[#8A9096]">EPR, collection, recycling, and refurbishment evidence — metadata only, files protected by authorization</p>
      </div>
      {documents.length === 0 ? (
        <DetailRow icon={FileText} label="Documents on file" value="No documents" variant="passport" />
      ) : (
        documents.map((d) => (
          <DetailRow
            key={d.id}
            icon={FileText}
            label={`${valueOr(d.documentType)} · ${valueOr(d.status)}`}
            value={`${valueOr(d.documentName)}${d.documentNumber ? ` — ${d.documentNumber}` : ""}${d.issuedBy ? ` · issued by ${d.issuedBy}` : ""}${d.expiresOn ? ` · expires ${formatDate(d.expiresOn)}` : ""}`}
            variant="passport"
          />
        ))
      )}

      <div className="pt-2 pb-1">
        <p className="text-[10px] font-bold text-[#9A8240] uppercase tracking-wide">
          Recent Compliance Events
        </p>
      </div>
      {events.length === 0 ? (
        <DetailRow icon={ScrollText} label="Activity log" value="No compliance events recorded yet." variant="passport" />
      ) : (
        events.slice(0, 5).map((e) => (
          <DetailRow
            key={e.id}
            icon={ScrollText}
            label={formatDateTime(e.createdAt)}
            value={`${valueOr(e.eventDescription)}${e.createdBy ? ` · by ${e.createdBy}` : ""}`}
            variant="passport"
          />
        ))
      )}

      <div className="mb-4 mt-2 rounded-xl bg-[#FBF1C9] border border-[#F0E6C8] p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-[#B48611] mt-0.5 shrink-0" />
          <p className="text-[11px] text-[#16263A] leading-relaxed">
            Compliance details are maintained by MaxSpace administrators from official CPCB EPR
            registrations and certificates. <span className="font-semibold">Verified in MaxSpace</span>
            means the record was checked within this platform — it does not replace the official CPCB
            registration/certificate issued to the producer.
          </p>
        </div>
      </div>
    </InfoBlock>
  );
}
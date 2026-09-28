/* ============================================================
   FLEET MAP STATS STRIP
   Renders the server-side summary over the full filtered set —
   the backend computes these totals over every matched battery,
   not just the visible page/cluster. When no filters are applied
   the chips collapse to a single honest count.
   ============================================================ */
const Chip = ({ label, value, tone = "bg-[#F5F1E7] text-[#16263A] border-[#E7E1D3]" }) => (
  <div className={`rounded-xl px-3 py-1.5 border ${tone} text-center shrink-0`}>
    <p className="text-sm font-black leading-tight">{value}</p>
    <p className="text-[10px] font-semibold text-[#747B83] uppercase tracking-wide">{label}</p>
  </div>
);

const MapStats = ({ summary, hasFilters }) => {
  if (!summary) return null;
  const byHealth = summary.byHealth || {};
  const byCompliance = summary.byCompliance || {};
  const byLifecycle = summary.byLifecycle || {};
  const byService = summary.byService || {};

  if (!hasFilters) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Chip label="Located" value={summary.total ?? 0} />
        <Chip label="On map" value={summary.plotted ?? 0} />
        <p className="text-[11px] text-[#747B83] font-medium ml-1">
          Apply a filter to see the compliance, health and service breakdown.
        </p>
      </div>
    );
  }

  const regionRows = (rows) => rows?.slice(0, 4) || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Chip label="Located" value={summary.total ?? 0} />
        <Chip label="On map" value={summary.plotted ?? 0} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Chip label="Compliant" value={byCompliance.compliant ?? 0} tone="bg-green-50 text-green-800 border-green-200" />
        <Chip label="Pending / Review" value={(byCompliance.pending ?? 0) + (byCompliance.underReview ?? 0)} tone="bg-amber-50 text-amber-800 border-amber-200" />
        <Chip label="Non-Compliant" value={byCompliance.nonCompliant ?? 0} tone="bg-red-50 text-red-800 border-red-200" />
        <Chip label="Not Tracked" value={byCompliance.notTracked ?? 0} />
        <Chip label="Healthy" value={byHealth.healthy ?? 0} tone="bg-green-50 text-green-800 border-green-200" />
        <Chip label="Warning" value={byHealth.warning ?? 0} tone="bg-amber-50 text-amber-800 border-amber-200" />
        <Chip label="Critical" value={byHealth.critical ?? 0} tone="bg-red-50 text-red-800 border-red-200" />
        <Chip label="In Service" value={byLifecycle.inService ?? 0} tone="bg-blue-50 text-blue-800 border-blue-200" />
        <Chip label="Defect Hold" value={byLifecycle.defectHold ?? 0} tone="bg-orange-50 text-orange-800 border-orange-200" />
        <Chip label="Active Service" value={byService.active ?? 0} tone="bg-orange-50 text-orange-800 border-orange-200" />
      </div>
      {(regionRows(summary.byCountry).length > 0 || regionRows(summary.byState).length > 0) && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-[#747B83]">
          {regionRows(summary.byCountry).length > 0 && (
            <span>
              By country:{" "}
              {regionRows(summary.byCountry)
                .map((r) => `${r.name} (${r.count})`)
                .join(" · ")}
            </span>
          )}
          {regionRows(summary.byState).length > 0 && (
            <span>
              By state:{" "}
              {regionRows(summary.byState)
                .map((r) => `${r.name} (${r.count})`)
                .join(" · ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MapStats;
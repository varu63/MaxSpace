/* ============================================================
   COMPLIANCE EXPIRY / DEADLINE ENGINE
   Every expiry, upcoming-expiry and overdue-deadline decision in
   MaxSpace is computed HERE, on the backend, from configurable
   thresholds held in the compliance_settings table. The React layer
   only renders the values it is given — it never re-derives them, so
   changing a threshold in the database immediately changes every
   summary card, deadline list and passport badge.

   IMPORTANT (requirement: expiry must not change battery state)
     computeComplianceTiming() derives a DISPLAY status. It never
     writes to batteries, and it never overwrites the stored
     compliance_records.status. A model-level certificate that
     expires leaves the batteries that reference it operationally
     untouched; the admin sees the impact count instead.
   ============================================================ */

import { DEFAULT_COMPLIANCE_SETTINGS } from "../constants/complianceManagement.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* Normalize a stored DATE / TIMESTAMPTZ / ISO string to a Date at UTC
   midnight so day arithmetic never drifts with the server timezone.
   The Date branch reads LOCAL date parts on purpose: the PostgreSQL
   driver hands DATE columns back pinned to local midnight, so reading
   them as UTC would shift every date by a day east of Greenwich. */
export const toDateOnly = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const raw = String(value).trim();
  // Bare YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
};

export const toDateString = (value) => {
  const d = toDateOnly(value);
  return d ? d.toISOString().slice(0, 10) : null;
};

/* Whole days from today until `value` (negative when in the past). */
export const daysUntil = (value, now = new Date()) => {
  const target = toDateOnly(value);
  if (!target) return null;
  const today = toDateOnly(now) || toDateOnly(new Date());
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
};

const firstDefined = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
};

/* Merge stored settings over the code defaults so a partial or missing
   settings row can never break the calculation. */
export const resolveSettings = (stored) => {
  const expiryWarningDays = firstDefined(
    stored?.expiryWarningDays,
    stored?.expiry_warning_days,
    DEFAULT_COMPLIANCE_SETTINGS.expiryWarningDays
  );
  const deadlineSoonDays = firstDefined(
    stored?.deadlineSoonDays,
    stored?.deadline_soon_days,
    DEFAULT_COMPLIANCE_SETTINGS.deadlineSoonDays
  );
  const reviewIntervalDays = firstDefined(
    stored?.reviewIntervalDays,
    stored?.review_interval_days,
    DEFAULT_COMPLIANCE_SETTINGS.reviewIntervalDays
  );
  const showDevelopmentData =
    stored?.showDevelopmentData ?? stored?.show_development_data ?? DEFAULT_COMPLIANCE_SETTINGS.showDevelopmentData;
  return {
    expiryWarningDays: expiryWarningDays ?? DEFAULT_COMPLIANCE_SETTINGS.expiryWarningDays,
    deadlineSoonDays: deadlineSoonDays ?? DEFAULT_COMPLIANCE_SETTINGS.deadlineSoonDays,
    reviewIntervalDays: reviewIntervalDays ?? DEFAULT_COMPLIANCE_SETTINGS.reviewIntervalDays,
    showDevelopmentData: Boolean(showDevelopmentData),
  };
};

/* The scope a record applies to, derived from which link columns are set.
   This is the ONLY place that decides company vs model vs battery. */
export const levelOf = (record) => {
  if (record?.batteryId) return "BATTERY";
  if (record?.batteryModelId) return "BATTERY_MODEL";
  return "COMPANY";
};

/* Expiry bucket for one date value. */
export const expiryStateFor = (expiryDate, settings, now = new Date()) => {
  const days = daysUntil(expiryDate, now);
  if (days === null) return { state: "Unknown", daysToExpiry: null, isExpired: false, isUpcoming: false };
  if (days < 0) return { state: "Expired", daysToExpiry: days, isExpired: true, isUpcoming: false };
  if (days <= settings.expiryWarningDays) {
    return { state: "Upcoming", daysToExpiry: days, isExpired: false, isUpcoming: true };
  }
  return { state: "Normal", daysToExpiry: days, isExpired: false, isUpcoming: false };
};

/* Deadline bucket. A deadline is an obligation date (e.g. EPR target
   date), not a certificate expiry, so it has its own threshold. */
export const deadlineStateFor = (deadline, issueDate, settings, now = new Date()) => {
  const days = daysUntil(deadline, now);
  if (days === null) return { state: "None", daysToDeadline: null, isOverdue: false, isUpcoming: false };
  if (days < 0) {
    // A deadline that already passed but was met by an issue date on or
    // before the deadline is recorded as satisfied, not overdue.
    const issued = toDateOnly(issueDate);
    if (issued && issued.getTime() <= toDateOnly(deadline).getTime()) {
      return { state: "Met", daysToDeadline: days, isOverdue: false, isUpcoming: false };
    }
    return { state: "Overdue", daysToDeadline: days, isOverdue: true, isUpcoming: false };
  }
  if (days <= settings.deadlineSoonDays) {
    return { state: "Upcoming", daysToDeadline: days, isOverdue: false, isUpcoming: true };
  }
  return { state: "Upcoming", daysToDeadline: days, isOverdue: false, isUpcoming: true };
};

/* Suggested next review date: the earlier of the expiry date and
   "last verified + review interval", so a record without an expiry is
   still brought back for review. */
export const suggestNextReviewDate = (record, settings, now = new Date()) => {
  const explicit = toDateOnly(record?.nextReviewDate ?? record?.next_review_date);
  if (explicit) return explicit.toISOString().slice(0, 10);
  const base = toDateOnly(record?.lastVerifiedAt ?? record?.last_verified_at) || toDateOnly(now);
  if (!base) return null;
  const expiry = toDateOnly(record?.expiryDate ?? record?.expiry_date);
  const fromInterval = new Date(base.getTime() + settings.reviewIntervalDays * MS_PER_DAY);
  const next = expiry && expiry.getTime() < fromInterval.getTime() ? expiry : fromInterval;
  return next.toISOString().slice(0, 10);
};

/* The single entry point used by every read path.
   Returns the stored status plus the derived timing facts, so the UI
   never has to do date maths itself. */
export const computeComplianceTiming = (record, settings, now = new Date()) => {
  const resolved = resolveSettings(settings);
  const level = levelOf(record);
  const expiry = expiryStateFor(record?.expiryDate ?? record?.expiry_date, resolved, now);
  const deadline = deadlineStateFor(
    record?.complianceDeadline ?? record?.compliance_deadline,
    record?.issueDate ?? record?.issue_date,
    resolved,
    now
  );

  const storedStatus = record?.status || "Pending";
  const applicability = record?.applicability || "Applicable";

  /* Derived status rules, applied ONLY for records that actually apply.
     A Not Applicable record is never dragged into Expired/Attention
     because it has no certificate to expire. */
  let effectiveStatus = storedStatus;
  if (applicability !== "Not Applicable" && storedStatus !== "Pending" && storedStatus !== "Under Review") {
    if (expiry.isExpired) effectiveStatus = "Expired";
    else if (deadline.isOverdue) effectiveStatus = "Attention Required";
    else if (expiry.isUpcoming) effectiveStatus = "Attention Required";
  } else if (applicability === "Not Applicable") {
    effectiveStatus = "Not Applicable";
  } else if (expiry.isExpired && (storedStatus === "Compliant" || storedStatus === "Attention Required")) {
    effectiveStatus = "Expired";
  }

  const needsAttention = effectiveStatus === "Attention Required" || effectiveStatus === "Expired";

  /* A Not Applicable record has no certificate to expire and no deadline to
     meet, so its timing facts are neutralised too. `needsAttention` was
     already false, but the raw isExpired / isDeadlineOverdue / urgency fields
     would otherwise let a UI paint an exempt row as "Expired". */
  const exempt = applicability === "Not Applicable";
  const urgency = exempt
    ? Number.MAX_SAFE_INTEGER
    : deadline.daysToDeadline !== null
      ? deadline.daysToDeadline
      : expiry.daysToExpiry !== null
        ? expiry.daysToExpiry
        : Number.MAX_SAFE_INTEGER;

  return {
    level,
    storedStatus,
    effectiveStatus,
    applicability,
    expiryState: exempt ? "None" : expiry.state,
    daysToExpiry: exempt ? null : expiry.daysToExpiry,
    isExpired: exempt ? false : expiry.isExpired,
    isExpiringSoon: exempt ? false : expiry.isUpcoming,
    deadlineState: exempt ? "None" : deadline.state,
    daysToDeadline: exempt ? null : deadline.daysToDeadline,
    isDeadlineOverdue: exempt ? false : deadline.isOverdue,
    isDeadlineUpcoming: exempt ? false : deadline.isUpcoming,
    needsAttention,
    /* A single number the UI can sort on: most urgent first. */
    urgency,
    suggestedNextReviewDate: exempt ? null : suggestNextReviewDate(record, resolved, now),
    settings: resolved,
  };
};

/* The date a deadline list should order by: compliance_deadline when
   present, otherwise expiry_date. */
export const deadlineDateFor = (record) => {
  const deadline = toDateString(record?.complianceDeadline ?? record?.compliance_deadline);
  return deadline || toDateString(record?.expiryDate ?? record?.expiry_date) || null;
};

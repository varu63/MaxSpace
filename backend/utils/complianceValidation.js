/* ============================================================
   COMPLIANCE VALIDATION HELPERS
   Mirrors backend/utils/serviceValidation.js: the primary key
   vocabulary lives in backend/constants/compliance.js and every
   create/update path validates against it here, so invalid values
   return clean 400 responses in both mock and postgres modes —
   never raw database errors. Unknown fields are silently dropped.

   Contract:
     parse*Payload — full create payloads; required fields throw.
     parse*Patch   — partial updates; ONLY keys present in the body
                     are returned (no defaults applied to absent
                     keys, so PATCH can never clobber a field the
                     caller did not mention).
============================================================ */
import {
  COMPLIANCE_STATUSES,
  PRODUCER_STATUSES,
  PRODUCER_CATEGORIES,
  BATTERY_CATEGORIES,
  COLLECTION_CHANNELS,
  COLLECTION_STATUSES,
  RECYCLING_STATUSES,
  OBLIGATION_STATUSES,
  CREDIT_STATUSES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  COMPLIANCE_EVENT_TYPES,
  COMPLIANCE_FRAMEWORK,
} from "../constants/compliance.js";

const cleanText = (value, max = 4000) =>
  value === undefined || value === null ? null : String(value).trim().slice(0, max);

const requiredText = (value, field, max = 4000) => {
  const s = cleanText(value, max);
  if (!s) throw new Error(`${field} is required`);
  return s;
};

const cleanDate = (value) => {
  if (!value) return null;
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
};

const cleanNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const cleanNullableId = (value) =>
  value === undefined || value === null || value === "" ? null : Number(value) || null;

const pick = (body = {}, fields) => {
  const out = {};
  for (const key of fields) {
    if (key in body) out[key] = body[key];
  }
  return out;
};

const assertInList = (value, list, field) => {
  if (value === undefined || value === null || value === "") return;
  if (!list.includes(value)) {
    throw new Error(
      `${field} "${value}" is not valid. Expected one of: ${list.join(", ")}.`
    );
  }
};

/* Required-first validation helper for PATCH: validates the value
   ONLY when the field was explicitly provided. */
const inList = (value, list, field) => {
  if (value !== undefined) assertInList(value, list, field);
};

/* ---------------- Producers ---------------- */

const PRODUCER_FIELDS = [
  "producerName",
  "registrationNumber",
  "registrationValidUntil",
  "producerCategory",
  "pan",
  "gstin",
  "address",
  "contactEmail",
  "contactPhone",
  "website",
  "status",
  "notes",
];

export const parseProducerPayload = (body = {}) => {
  const { id, producerName, registrationNumber, registrationValidUntil, producerCategory, pan, gstin, address, contactEmail, contactPhone, website, status, notes } = body || {};
  return {
    ...(id ? { id } : {}),
    producerName: requiredText(producerName, "producerName", 200),
    registrationNumber: requiredText(registrationNumber, "registrationNumber", 200),
    registrationValidUntil: cleanDate(registrationValidUntil),
    producerCategory: (() => { inList(producerCategory, PRODUCER_CATEGORIES, "producerCategory"); return cleanText(producerCategory) || "Manufacturer"; })(),
    pan: cleanText(pan, 100),
    gstin: cleanText(gstin, 100),
    address: cleanText(address),
    contactEmail: cleanText(contactEmail, 200),
    contactPhone: cleanText(contactPhone, 100),
    website: cleanText(website, 300),
    status: (() => { inList(status, PRODUCER_STATUSES, "status"); return cleanText(status) || "Active"; })(),
    notes: cleanText(notes),
  };
};

export const parseProducerPatch = (body = {}) => {
  const allowed = pick(body, PRODUCER_FIELDS);
  inList(allowed.producerCategory, PRODUCER_CATEGORIES, "producerCategory");
  inList(allowed.status, PRODUCER_STATUSES, "status");
  /* Reuse the payload cleaner on the safe subset: unknown keys are
     already dropped by pick(), required fields only throw when the
     caller actually supplied them (see requiredText below). */
  const parsed = parseProducerPayload({ ...allowed, producerName: allowed.producerName ?? "_", registrationNumber: allowed.registrationNumber ?? "_" });
  const out = {};
  for (const key of Object.keys(allowed)) {
    const value = parsed[key];
    if (key === "producerName" || key === "registrationNumber") {
      if (value === "_" || value === null) continue; // field was NOT provided
      if (allowed[key] === "" ) throw new Error(`${key} is required`);
      out[key] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
};

/* ---------------- Battery compliance (incl. EOL lifecycle + EPR) ---------------- */

export const parseBatteryCompliancePayload = (body = {}, { requireBatteryId = false } = {}) => {
  const { batteryId, producerId, framework, batteryCategory, collectionChannel, complianceStatus, verifiedInApp, verifiedAt, notes,
    collectionStatus, collectionDate, collectionLocation,
    refurbisherId, refurbisherName, refurbisherDetails,
    recyclerId, recyclerName, recyclerRegistration, recyclingFacility, recyclingDate, recyclingStatus, recyclingCertificate,
    eprReference } = body || {};
  assertInList(complianceStatus, COMPLIANCE_STATUSES, "complianceStatus");
  assertInList(batteryCategory, BATTERY_CATEGORIES, "batteryCategory");
  assertInList(collectionChannel, COLLECTION_CHANNELS, "collectionChannel");
  assertInList(collectionStatus, COLLECTION_STATUSES, "collectionStatus");
  assertInList(recyclingStatus, RECYCLING_STATUSES, "recyclingStatus");
  const out = {
    producerId: cleanNullableId(producerId),
    framework: cleanText(framework) || COMPLIANCE_FRAMEWORK,
    batteryCategory: cleanText(batteryCategory) || null,
    collectionChannel: cleanText(collectionChannel) || null,
    complianceStatus: cleanText(complianceStatus) || "Pending",
    verifiedInApp: Boolean(verifiedInApp),
    verifiedAt: verifiedInApp ? cleanDate(verifiedAt) || new Date().toISOString() : null,
    notes: cleanText(notes),
    collectionStatus: cleanText(collectionStatus) || null,
    collectionDate: cleanDate(collectionDate),
    collectionLocation: cleanText(collectionLocation),
    refurbisherId: cleanNullableId(refurbisherId),
    refurbisherName: cleanText(refurbisherName, 300),
    refurbisherDetails: cleanText(refurbisherDetails),
    recyclerId: cleanNullableId(recyclerId),
    recyclerName: cleanText(recyclerName, 300),
    recyclerRegistration: cleanText(recyclerRegistration, 200),
    recyclingFacility: cleanText(recyclingFacility, 300),
    recyclingDate: cleanDate(recyclingDate),
    recyclingStatus: cleanText(recyclingStatus) || null,
    recyclingCertificate: cleanText(recyclingCertificate, 300),
    eprReference: cleanText(eprReference, 200),
  };
  if (requireBatteryId) out.batteryId = requiredText(batteryId, "batteryId", 200);
  return out;
};

export const parseBatteryCompliancePatch = (body = {}) => {
  const allowed = pick(body, [
    "producerId",
    "framework",
    "batteryCategory",
    "collectionChannel",
    "complianceStatus",
    "verifiedInApp",
    "verifiedAt",
    "notes",
    "collectionStatus",
    "collectionDate",
    "collectionLocation",
    "refurbisherId",
    "refurbisherName",
    "refurbisherDetails",
    "recyclerId",
    "recyclerName",
    "recyclerRegistration",
    "recyclingFacility",
    "recyclingDate",
    "recyclingStatus",
    "recyclingCertificate",
    "eprReference",
  ]);
  inList(allowed.complianceStatus, COMPLIANCE_STATUSES, "complianceStatus");
  inList(allowed.batteryCategory, BATTERY_CATEGORIES, "batteryCategory");
  inList(allowed.collectionChannel, COLLECTION_CHANNELS, "collectionChannel");
  inList(allowed.collectionStatus, COLLECTION_STATUSES, "collectionStatus");
  inList(allowed.recyclingStatus, RECYCLING_STATUSES, "recyclingStatus");
  const out = {};
  if ("producerId" in allowed) out.producerId = cleanNullableId(allowed.producerId);
  if ("framework" in allowed) out.framework = cleanText(allowed.framework) || COMPLIANCE_FRAMEWORK;
  if ("batteryCategory" in allowed) out.batteryCategory = cleanText(allowed.batteryCategory) || null;
  if ("collectionChannel" in allowed) out.collectionChannel = cleanText(allowed.collectionChannel) || null;
  if ("complianceStatus" in allowed) out.complianceStatus = cleanText(allowed.complianceStatus) || "Pending";
  if ("verifiedInApp" in allowed) {
    const on = Boolean(allowed.verifiedInApp);
    out.verifiedInApp = on;
    // Turning verification ON stamps the moment it happened; turning it
    // OFF clears the stamp. verifiedAt is never trusted from the client.
    out.verifiedAt = on ? new Date().toISOString() : null;
  } else if ("verifiedAt" in allowed) {
    out.verifiedAt = cleanDate(allowed.verifiedAt);
  }
  if ("notes" in allowed) out.notes = cleanText(allowed.notes);
  if ("collectionStatus" in allowed) out.collectionStatus = cleanText(allowed.collectionStatus) || null;
  if ("collectionDate" in allowed) out.collectionDate = cleanDate(allowed.collectionDate);
  if ("collectionLocation" in allowed) out.collectionLocation = cleanText(allowed.collectionLocation);
  if ("refurbisherId" in allowed) out.refurbisherId = cleanNullableId(allowed.refurbisherId);
  if ("refurbisherName" in allowed) out.refurbisherName = cleanText(allowed.refurbisherName, 300);
  if ("refurbisherDetails" in allowed) out.refurbisherDetails = cleanText(allowed.refurbisherDetails);
  if ("recyclerId" in allowed) out.recyclerId = cleanNullableId(allowed.recyclerId);
  if ("recyclerName" in allowed) out.recyclerName = cleanText(allowed.recyclerName, 300);
  if ("recyclerRegistration" in allowed) out.recyclerRegistration = cleanText(allowed.recyclerRegistration, 200);
  if ("recyclingFacility" in allowed) out.recyclingFacility = cleanText(allowed.recyclingFacility, 300);
  if ("recyclingDate" in allowed) out.recyclingDate = cleanDate(allowed.recyclingDate);
  if ("recyclingStatus" in allowed) out.recyclingStatus = cleanText(allowed.recyclingStatus) || null;
  if ("recyclingCertificate" in allowed) out.recyclingCertificate = cleanText(allowed.recyclingCertificate, 300);
  if ("eprReference" in allowed) out.eprReference = cleanText(allowed.eprReference, 200);
  return out;
};

/* ---------------- EPR obligations ---------------- */

export const parseObligationPayload = (body = {}) => {
  const { producerId, financialYear, batteryCategory, targetPercent, obligationKg, achievedKg, status, notes } = body || {};
  if (!Number(producerId)) throw new Error("producerId is required");
  if (!cleanText(financialYear)) throw new Error("financialYear is required (e.g. 2024-25)");
  assertInList(batteryCategory, BATTERY_CATEGORIES, "batteryCategory");
  assertInList(status, OBLIGATION_STATUSES, "status");
  const parsed = {
    producerId: Number(producerId),
    financialYear: cleanText(financialYear, 50),
    batteryCategory: cleanText(batteryCategory) || "Medium",
    targetPercent: cleanNumber(targetPercent),
    obligationKg: cleanNumber(obligationKg),
    achievedKg: cleanNumber(achievedKg) ?? 0,
    status: cleanText(status) || "Open",
    notes: cleanText(notes),
  };
  if (parsed.targetPercent !== null && (parsed.targetPercent < 0 || parsed.targetPercent > 100)) {
    throw new Error("targetPercent must be between 0 and 100");
  }
  return parsed;
};

export const parseObligationPatch = (body = {}) => {
  const parsed = parseObligationPayload({
    ...body,
    producerId: body.producerId || 1, // required-field placeholder; picked below
  });
  const out = {};
  for (const key of ["producerId", "financialYear", "batteryCategory", "targetPercent", "obligationKg", "achievedKg", "status", "notes"]) {
    if (key in body) out[key] = parsed[key];
  }
  return out;
};

/* ---------------- EPR credits ---------------- */

export const parseCreditPayload = (body = {}) => {
  const { obligationId, certificateNumber, quantityKg, issueDate, validUntil, status, notes } = body || {};
  if (!Number(obligationId)) throw new Error("obligationId is required");
  if (!cleanText(certificateNumber)) throw new Error("certificateNumber is required");
  assertInList(status, CREDIT_STATUSES, "status");
  return {
    obligationId: Number(obligationId),
    certificateNumber: cleanText(certificateNumber, 200),
    quantityKg: cleanNumber(quantityKg) ?? 0,
    issueDate: cleanDate(issueDate),
    validUntil: cleanDate(validUntil),
    status: cleanText(status) || "Active",
    notes: cleanText(notes),
  };
};

export const parseCreditPatch = (body = {}) => {
  const parsed = parseCreditPayload({ ...body, obligationId: body.obligationId || 1 });
  const out = {};
  for (const key of ["obligationId", "certificateNumber", "quantityKg", "issueDate", "validUntil", "status", "notes"]) {
    if (key in body) out[key] = parsed[key];
  }
  return out;
};

/* ---------------- Documents (metadata-only) ---------------- */

export const parseDocumentPayload = (body = {}) => {
  const { batteryId, producerId, documentType, documentName, documentNumber, issuedBy, issuedOn, expiresOn, status, notes } = body || {};
  if (!cleanText(documentName)) throw new Error("documentName is required");
  assertInList(documentType, DOCUMENT_TYPES, "documentType");
  assertInList(status, DOCUMENT_STATUSES, "status");
  return {
    batteryId: cleanText(batteryId, 200) || null,
    producerId: cleanNullableId(producerId),
    documentType: cleanText(documentType) || "Other",
    documentName: cleanText(documentName, 300),
    documentNumber: cleanText(documentNumber, 200),
    issuedBy: cleanText(issuedBy, 300),
    issuedOn: cleanDate(issuedOn),
    expiresOn: cleanDate(expiresOn),
    status: cleanText(status) || "Pending Review",
    notes: cleanText(notes),
  };
};

export const parseDocumentPatch = (body = {}) => {
  const allowed = pick(body, [
    "batteryId",
    "producerId",
    "documentType",
    "documentName",
    "documentNumber",
    "issuedBy",
    "issuedOn",
    "expiresOn",
    "status",
    "notes",
  ]);
  inList(allowed.documentType, DOCUMENT_TYPES, "documentType");
  inList(allowed.status, DOCUMENT_STATUSES, "status");
  const parsed = parseDocumentPayload({ ...allowed, documentName: allowed.documentName ?? "_" });
  const out = {};
  for (const key of Object.keys(allowed)) {
    if ((key === "documentName") && parsed[key] === "_") continue; // field NOT provided
    out[key] = parsed[key];
  }
  return out;
};

/* ---------------- Events (append-only) ---------------- */

export const parseEventPayload = (body = {}) => {
  const { batteryId, producerId, eventType, eventDescription, createdBy } = body || {};
  assertInList(eventType, COMPLIANCE_EVENT_TYPES, "eventType");
  return {
    batteryId: cleanText(batteryId, 200) || null,
    producerId: cleanNullableId(producerId),
    eventType: cleanText(eventType),
    eventDescription: cleanText(eventDescription),
    createdBy: cleanText(createdBy, 200) || null,
  };
};

/* Build a short human-readable audit line for a compliance event. */
export const describeEvent = (eventType, meta = {}) => {
  const labels = {
    producer_created: "Producer registration was created",
    producer_updated: "Producer registration was updated",
    battery_linked: "Battery linked to a producer",
    battery_compliance_updated: "Battery compliance record was updated",
    status_changed: "Compliance status changed",
    verified: "Compliance record verified in MaxSpace",
    obligation_created: "EPR obligation was created",
    obligation_updated: "EPR obligation was updated",
    obligation_closed: "EPR obligation was closed",
    credit_issued: "EPR credit / certificate was recorded",
    credit_updated: "EPR credit / certificate was updated",
    document_uploaded: "Compliance document reference was added",
    document_updated: "Compliance document reference was updated",
    note_added: "Note added",
  };
  const base = labels[eventType] || "Compliance event";
  const extra = meta && meta.detail ? ` — ${meta.detail}` : "";
  return base + extra;
};
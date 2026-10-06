import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { todayISO, todayMonth } from "../utils/date.js";
import { parsePagination } from "../utils/pagination.js";
import {
  normalizeBatteryIdentifier,
  resolveBatteryByIdentifier,
  isBatteryQrPayload,
  parseBatteryQrPayload,
  getBatteryPayloadIdentifier,
} from "../utils/batteryIdentifier.js";
import { ownerScopeFor } from "../utils/ownerScope.js";
import { MANUFACTURER_LOCKED_FIELDS } from "../utils/lifecycleLedger.js";
import {
  recordBatteryRegistration,
  recordBatteryClaim,
} from "../utils/batteryLifecycleBridge.js";
import { planProvenanceAssertions } from "./batteryLifecycleController.js";

const barcodePrefix = "BATT-GEN";

/* Whether the caller may see full ownership / detailed records for a battery:
   fleet operators (ADMIN/EMPLOYEE) or the battery's linked owner.

   This is an ALLOW-list, deliberately not `role !== "USER"`. A PARTNER
   account is external: it may see the batteries it was assigned through
   /api/partner, and must not learn who owns a battery it happens to have
   an identifier for. Listing the roles that qualify means a role added to
   the `users` table later starts with no owner visibility. */
const canViewOwnerDetails = (req, battery) =>
  Boolean(
    req.user &&
      (req.user.role === "ADMIN" ||
        req.user.role === "EMPLOYEE" ||
        (req.user.role === "USER" && req.user.id === battery.ownerId))
  );

/* Public-facing subset of a battery's service history for non-owners. EU DPP
   passports are publicly scannable, but customer identity, contact details and
   operational notes must not leak through a barcode lookup. */
const publicServiceView = (services) =>
  services.map(
    ({
      id,
      serviceType,
      ticketNumber,
      scheduledDate,
      scheduledTime,
      status,
      center,
      technician,
      cost,
      notes,
    }) => ({
      id,
      serviceType,
      ticketNumber,
      scheduledDate,
      scheduledTime,
      status,
      center,
      technician,
      cost,
      notes,
    })
  );

/* Fields end users may edit on their own battery passport. Identity, ownership,
   QR-linked and audit fields (id, ownerId, barcode, serialNumber, qrCode,
   modalId, hangStatus, overallStatus, serviceCount, createdAt) and the
   health-history ledger are intentionally excluded.

   manufacturer-authoritative fields (manufactureDate / modelName / model) are
   NOT editable here at all — they live in MANUFACTURER_LOCKED_FIELDS. They
   are also guarded by the `batteries_identity_immutable` database trigger, so
   allowing them through this list would turn a bad request into a 500 from
   PostgreSQL instead of a clear 400. Changing one is a deliberate, reasoned
   act that goes through PATCH /:id/manufacturer-correction. */
const EDITABLE_BATTERY_FIELDS = [
  "name",
  "type",
  "manufacturer",
  "chemistry",
  "capacityKwh",
  "capacity",
  "nominalVoltage",
  "voltage",
  "weightKg",
  "dimensionsMm",
  "assemblyLocation",
  "location",
  "cells",
  "stateOfHealth",
  "stateOfCharge",
  "cycleCount",
  "maxRatedCycles",
  "internalResistanceMOhms",
  "operatingTempC",
  "carbonFootprintKgPerKwh",
  "recycledContent",
  "warranty",
  "complianceStandards",
  "dismantlingManual",
  "notes",
];

const pickEditableBatteryFields = (body = {}) => {
  const updates = {};
  for (const key of EDITABLE_BATTERY_FIELDS) {
    if (key in body) updates[key] = body[key];
  }
  return updates;
};

// GET /api/batteries
export const getBatteries = asyncHandler(async (req, res) => {
  const { barcode } = req.query;
  if (barcode) {
    const code = normalizeBatteryIdentifier(barcode);
    const battery = await store.findBatteryByBarcodeOrSerial(code, ownerScopeFor(req));
    return res.json(battery ? [battery] : []);
  }

  const { page, limit } = parsePagination(req.query);
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;
  const ownerId = ownerScopeFor(req);

  const results = await store.listBatteries({
    ownerId,
    search: req.query.search || "",
    page,
    limit,
    sort: req.query.sort,
    order: req.query.order,
  });

  if (paginated) {
    return res.json({ success: true, data: results.data, pagination: results.pagination });
  }
  // Legacy behavior: the caller omitted page/limit → plain array.
  const legacy = await store.getAllBatteries(ownerId);
  res.json(legacy);
});

// GET /api/batteries/:id
export const getBattery = asyncHandler(async (req, res) => {
  const battery = await resolveBatteryByIdentifier(store, req.params.id);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const details =
    typeof store.getBatteryRelatedDetails === "function"
      ? await store.getBatteryRelatedDetails(battery)
      : {};

  const response = { ...battery, ...details };
  // Ownership identity (owner name/email/location) is private to the owner
  // and fleet operators; barcode/passport routes are otherwise public.
  if (!canViewOwnerDetails(req, battery) && response.ownership) {
    response.ownership = null;
  }

  res.json(response);
});

// GET /api/batteries/lookup?barcode=...|serial=...|id=...|code=...
export const lookupBattery = asyncHandler(async (req, res) => {
  const { barcode, serial, id, code } = req.query;
  const rawCode = code || barcode || serial || id;

  const identifier = normalizeBatteryIdentifier(rawCode);
  if (!identifier) {
    return res.status(400).json({ message: "A battery identifier is required" });
  }

  const battery = await resolveBatteryByIdentifier(store, identifier);
  if (!battery) {
    return res.status(404).json({ message: "No battery found for the provided identifier" });
  }

  const details =
    typeof store.getBatteryRelatedDetails === "function"
      ? await store.getBatteryRelatedDetails(battery)
      : {};

  const response = { ...battery, ...details };
  if (!canViewOwnerDetails(req, battery) && response.ownership) {
    response.ownership = null;
  }

  res.json(response);
});

// GET /api/batteries/:id/passport
// Accepts an internal id, a barcode, a serial number, or a full EU DPP
// QR payload URI. Fetches the battery record plus its related service /
// maintenance history and production records from the database and returns a structured passport.
export const getBatteryPassport = asyncHandler(async (req, res) => {
  const identifier = normalizeBatteryIdentifier(req.params.id);
  if (!identifier) {
    res.status(400);
    throw new Error("A battery identifier is required");
  }

  const battery = await resolveBatteryByIdentifier(store, identifier);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }

  // Related records: service & maintenance history for this battery.
  const serviceHistory = await store.getServicesByBatteryId(battery.id);
  const details =
    typeof store.getBatteryRelatedDetails === "function"
      ? await store.getBatteryRelatedDetails(battery)
      : {};

  const fullBattery = {
    ...battery,
    ...details,
  };

  const ownerView = canViewOwnerDetails(req, battery);
  if (!ownerView && fullBattery.ownership) {
    fullBattery.ownership = null;
  }

  /* Lifecycle history. A public barcode scan gets the summary only — the
     stage, how much history exists and whether the chain verifies. Event
     rows carry actor names, notes and metadata, and ownership history
     carries previous owners' names and e-mail addresses, none of which a
     passer-by scanning a label is entitled to. Same reasoning as the
     public service view above.

     The end-of-life assessment is reduced rather than dropped: "grade B,
     second life" is exactly the kind of fact a DPP exists to publish, but
     WHO assessed it, their notes, which partner they work for and the
     internal document id are not. */
  const lifecycle = await store.getPassportLifecycle(battery.id);
  const publicLifecycle = {
    // ownerOrganizationId is omitted for the same reason `ownership` is
    // nulled above: which company holds the battery is owner data.
    summary: lifecycle.summary
      ? (({ ownerOrganizationId, ...publicSummary }) => publicSummary)(lifecycle.summary)
      : lifecycle.summary,
    latestAssessment: lifecycle.latestAssessment
      ? {
          assessedAt: lifecycle.latestAssessment.assessedAt,
          grade: lifecycle.latestAssessment.grade,
          decision: lifecycle.latestAssessment.decision,
          healthPercent: lifecycle.latestAssessment.healthPercent,
          capacityPercent: lifecycle.latestAssessment.capacityPercent,
          safetyPassed: lifecycle.latestAssessment.safetyPassed,
          source: lifecycle.latestAssessment.source,
        }
      : null,
  };

  res.json({
    battery: fullBattery,
    serviceHistory: ownerView ? serviceHistory : publicServiceView(serviceHistory),
    lifecycle: ownerView ? lifecycle : publicLifecycle,
    generatedAt: new Date().toISOString(),
    qrUrl: battery.qrCode || `https://passport.battery-eu.org/passports/${battery.modalId || battery.barcode}`,
  });
});

// GET /api/batteries/:id/health-history
export const getBatteryHealthHistory = asyncHandler(async (req, res) => {
  const battery = await resolveBatteryByIdentifier(store, req.params.id);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  res.json(battery.healthHistory || []);
});

// POST /api/batteries
export const createBattery = asyncHandler(async (req, res) => {
  const data = req.body || {};
  const today = todayISO();

  // Raw multiline QR payloads may be submitted directly (fallback path);
  // normally the scanner extracts these fields before submission.
  const parsed = data.barcode && isBatteryQrPayload(data.barcode)
    ? parseBatteryQrPayload(data.barcode)
    : null;
  const payloadId =
    parsed ? getBatteryPayloadIdentifier(data.barcode) : normalizeBatteryIdentifier(data.barcode);

  const year = new Date().getFullYear();
  const barcode =
    payloadId || data.barcode || `${barcodePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Prevent duplicate registration using the extracted battery identifier.
  if (payloadId) {
    const existing = await store.findBatteryByBarcodeOrSerial(payloadId, ownerScopeFor(req));
    if (existing) {
      res.status(409);
      throw new Error("This battery is already registered. Open its existing passport instead.");
    }
  }

  const newBattery = {
    id: `batt-${Date.now()}`,
    ownerId: req.user.id,
    barcode,
    qrCode: `https://passport.battery-eu.org/passports/${barcode}`,
    modalId: data.modalId || parsed?.modalId || null,
    hangStatus: data.hangStatus || parsed?.hangStatus || null,
    overallStatus: data.overallStatus || parsed?.overallStatus || null,
    name: data.modelName || parsed?.model || "New Battery System",
    modelName: data.modelName || parsed?.model || "New Battery System",
    model: data.modelName || parsed?.model || "New Battery System",
    type: data.type || "Electric Vehicle (EV)",
    manufacturer: data.manufacturer || "EcoVolt Certified Partner",
    serialNumber:
      data.serialNumber ||
      parsed?.serialNumber ||
      `SN-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
    chemistry: data.chemistry || "LFP (Lithium Iron Phosphate)",
    capacityKwh: Number(data.capacityKwh) || 60,
    capacity: `${Number(data.capacityKwh) || 60} kWh`,
    nominalVoltage: data.nominalVoltage || "400 V",
    voltage: data.nominalVoltage || "400 V",
    weightKg: Number(data.weightKg) || 350,
    dimensionsMm: data.dimensionsMm || "1800 x 1200 x 140",
    manufactureDate: data.manufactureDate || today,
    assemblyLocation: data.assemblyLocation || "European Union",
    location: data.location || data.assemblyLocation || "European Union",
    cells: Number(data.cells) || 4,
    stateOfHealth: Number(data.stateOfHealth) || 100,
    stateOfCharge: Number(data.stateOfCharge) || 85,
    cycleCount: Number(data.cycleCount) || 12,
    maxRatedCycles: Number(data.maxRatedCycles) || 3000,
    internalResistanceMOhms: Number(data.internalResistanceMOhms) || 19.5,
    operatingTempC: Number(data.operatingTempC) || 24,
    carbonFootprintKgPerKwh: Number(data.carbonFootprintKgPerKwh) || 62,
    recycledContent: data.recycledContent || {
      cobalt: 20,
      nickel: 15,
      lithium: 14,
      lead: 0,
    },
    serviceCount: 0,
    warranty: data.warranty || {
      status: "Active",
      startDate: data.manufactureDate || today,
      endDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      remainingDays: 3 * 365,
      terms: "3 Years / 60,000 km Guaranteed Health Retention",
      provider: "EcoVolt Global Warranty Direct",
      certificateNumber: `WAR-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
    },
    complianceStandards: data.complianceStandards || [
      "EU Battery Regulation 2023/1542",
      "ISO 26262 ASIL-D",
      "UN 38.3 Transport Certified",
    ],
    dismantlingManual:
      data.dismantlingManual ||
      "Safe discharge to <10V, disconnect HV interlock loop, use non-sparking insulated tooling.",
    healthHistory: [
      {
        date: todayMonth(),
        soh: Number(data.stateOfHealth) || 100,
      },
    ],
  };

  let createdBattery = newBattery;
  try {
    createdBattery = (await store.createBattery(newBattery)) || newBattery;
  } catch (err) {
    if (err && (err.code === "23505" || /unique constraint/i.test(err.message || ""))) {
      res.status(409);
      throw new Error("A battery with this barcode or serial number already exists");
    }
    throw err;
  }
  await store.logActivity(
    req.user.id,
    "Battery Added & Passport Minted",
    `Registered ${createdBattery.modelName} (${createdBattery.barcode})`,
    "passport"
  );

  /* Open the passport ledger. This is the one event we can state as fact at
     registration: the battery has a recorded owner from now on. We do not
     invent a manufacturing or commissioning history here — those belong to
     the manufacturer or the backfill script. */
  await recordBatteryRegistration({
    store,
    battery: createdBattery,
    actorName: req.user?.name || req.user?.email || "Owner",
  });

  res.status(201).json(createdBattery);
});

// POST /api/batteries/:id/claim
// Associate a scanned battery with the currently logged-in user.
// Handled cases:
//   • Battery has no owner        → claim it for the authenticated user.
//   • Battery already claimed by
//     the authenticated user      → idempotent success (no duplicate records).
//   • Battery owned by another
//     real user                   → 409; ownership is never silently transferred.
//   • Battery owned by the
//     production-fleet placeholder
//     (user-maxvolt, assigned by
//     backend/sql/import_maxspace_pro_batteries.sql to factory units that
//     have no customer)           → claim it for the scanning customer.
export const claimBattery = asyncHandler(async (req, res) => {
  const identifier = normalizeBatteryIdentifier(req.params.id);
  if (!identifier) {
    res.status(400);
    throw new Error("A battery identifier is required");
  }

  const battery = await resolveBatteryByIdentifier(store, identifier);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const userId = req.user.id;
  const isProductionFleetOwner =
    battery.ownerId && battery.ownerId === "user-maxvolt";

  // Never transfer ownership of a unit already linked to another real account.
  if (battery.ownerId && !isProductionFleetOwner && battery.ownerId !== userId) {
    res.status(409);
    throw new Error("This battery is already associated with another user.");
  }

  let updated = battery;
  if (battery.ownerId !== userId) {
    updated = await store.claimBattery(battery.id, userId);
    if (!updated) {
      res.status(404);
      throw new Error("Battery not found");
    }
  }

  const details =
    typeof store.getBatteryRelatedDetails === "function"
      ? await store.getBatteryRelatedDetails(updated)
      : {};

  const claimedNow = battery.ownerId !== userId;

  /* Claiming an unowned battery is the moment it gains a first recorded
     owner. Claiming a battery that already carries a passport history is a
     transfer, not a first registration — the ledger decides which, so we do
     not have to guess from the batteries table alone. */
  if (claimedNow) {
    await recordBatteryClaim({
      store,
      battery: updated,
      previousOwnerId: battery.ownerId || null,
      newOwnerId: userId,
      actorName: req.user?.name || req.user?.email || "Owner",
    });
  }

  await store.logActivity(
    userId,
    claimedNow ? "Battery Added to Profile" : "Battery Already in Profile",
    claimedNow
      ? `Claimed ${updated.modelName || updated.barcode || updated.id} via QR scan`
      : `Viewed ${updated.modelName || updated.barcode || updated.id} (already linked to profile)`,
    "passport"
  );

  res.json({
    success: true,
    message: claimedNow
      ? "Battery added to profile successfully"
      : "Battery already added to your profile.",
    alreadyClaimed: !claimedNow,
    battery: { ...updated, ...details },
  });
});

// PUT /api/batteries/:id
export const updateBattery = asyncHandler(async (req, res) => {
  const existing = await store.getBatteryById(req.params.id, ownerScopeFor(req));
  if (!existing) {
    res.status(404);
    throw new Error("Battery not found");
  }

  // Only curated, non-identity fields are accepted; anything else in the body
  // (id, ownerId, barcode, serialNumber, healthHistory, ...) is ignored.
  const updates = pickEditableBatteryFields(req.body);

  // Grade the change against what already asserts these fields BEFORE the row
  // is written, so a refused downgrade never half-applies. An owner replacing
  // a value MaxVolt measured is told why; they are not silently overridden.
  const assertions = await planProvenanceAssertions(existing.batteryId || existing.id, existing, updates, {
    role: req.user?.role || "USER",
  });

  const updated = await store.updateBattery(req.params.id, updates);

  for (const assertion of assertions) {
    await store.assertProvenance({
      batteryId: existing.batteryId || existing.id,
      fieldName: assertion.field,
      classification: assertion.classification,
      source: assertion.source,
      recordedBy: req.user.id,
    });
  }

  // Tell the client which of its submitted fields were refused, rather than
  // returning a success that quietly dropped them.
  const refused = [...MANUFACTURER_LOCKED_FIELDS.filter((field) => field in (req.body || {}))];
  res.json({
    ...updated,
    ...(refused.length > 0
      ? {
          lockedFieldsIgnored: refused,
          message: `These fields are recorded by MaxVolt and cannot be changed here: ${refused.join(", ")}.`,
        }
      : {}),
  });
});

// PATCH /api/batteries/:id/manufacturer-correction
// The only path that changes manufacturer-authoritative fields. Admin only,
// and a reason is mandatory: the correction is written to the lifecycle
// ledger with the previous value, the new value and the stated reason.
export const correctBatteryManufacturerFields = asyncHandler(async (req, res) => {
  const existing = await store.getBatteryById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const body = req.body || {};
  const result = await store.correctManufacturerFields({
    batteryId: existing.batteryId || existing.id,
    modelId: body.modelId || null,
    modelName: body.modelName ?? null,
    manufactureDate: body.manufactureDate || null,
    reason: body.reason,
    actor: { id: req.user.id, name: req.user.name, role: req.user.role },
  });

  await store.logActivity(
    req.user.id,
    "Battery Manufacturer Correction",
    `Corrected ${result.batteryId}: ${result.changes.map((c) => c.field).join(", ")} — ${result.reason}`,
    "general"
  );

  res.json({ ...result, battery: await store.getBatteryById(req.params.id) });
});

// DELETE /api/batteries/:id
export const deleteBattery = asyncHandler(async (req, res) => {
  const existing = await store.getBatteryById(req.params.id, ownerScopeFor(req));
  if (!existing) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const removed = await store.deleteBattery(req.params.id);
  if (!removed) {
    res.status(404);
    throw new Error("Battery not found");
  }

  await store.logActivity(req.user.id, "Battery Removed", `Removed ${removed.modelName || removed.id} from fleet`, "general");
  res.json({ message: "Battery removed successfully", id: req.params.id });
});

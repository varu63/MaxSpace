import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { todayISO, todayMonth } from "../utils/date.js";

const barcodePrefix = "BATT-GEN";

// GET /api/batteries
export const getBatteries = asyncHandler(async (req, res) => {
  const { barcode } = req.query;
  if (barcode) {
    const battery = store.findBatteryByBarcodeOrSerial(barcode);
    return res.json(battery ? [battery] : []);
  }
  res.json(store.getAllBatteries());
});

// GET /api/batteries/:id
export const getBattery = asyncHandler(async (req, res) => {
  const battery = store.getBatteryById(req.params.id);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  res.json(battery);
});

// GET /api/batteries/lookup?barcode=...|serial=...|id=...
export const lookupBattery = asyncHandler(async (req, res) => {
  const { barcode, serial, id } = req.query;
  const code = barcode || serial || id;
  const battery = store.findBatteryByBarcodeOrSerial(code);
  if (!battery) {
    return res.status(404).json({ message: "No battery found for the provided identifier" });
  }
  res.json(battery);
});

// GET /api/batteries/:id/passport
export const getBatteryPassport = asyncHandler(async (req, res) => {
  const battery = store.getBatteryById(req.params.id);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  res.json({
    battery,
    generatedAt: new Date().toISOString(),
    qrUrl: battery.qrCode || `https://passport.battery-eu.org/passports/${battery.barcode}`,
  });
});

// GET /api/batteries/:id/health-history
export const getBatteryHealthHistory = asyncHandler(async (req, res) => {
  const battery = store.getBatteryById(req.params.id);
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
  const barcode =
    data.barcode || `${barcodePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  const year = new Date().getFullYear();

  const newBattery = {
    id: `batt-${Date.now()}`,
    barcode,
    qrCode: `https://passport.battery-eu.org/passports/${barcode}`,
    name: data.modelName || "New Battery System",
    modelName: data.modelName || "New Battery System",
    model: data.modelName || "New Battery System",
    type: data.type || "Electric Vehicle (EV)",
    manufacturer: data.manufacturer || "EcoVolt Certified Partner",
    serialNumber:
      data.serialNumber ||
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
      endDate: new Date(Date.now() + 8 * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      remainingDays: 8 * 365,
      terms: "8 Years / 160,000 km Guaranteed Health Retention",
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

  store.createBattery(newBattery);
  store.logActivity(
    "Battery Added & Passport Minted",
    `Registered ${newBattery.modelName} (${newBattery.barcode})`,
    "passport"
  );

  res.status(201).json(newBattery);
});

// PUT /api/batteries/:id
export const updateBattery = asyncHandler(async (req, res) => {
  const existing = store.getBatteryById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const updated = store.updateBattery(req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/batteries/:id
export const deleteBattery = asyncHandler(async (req, res) => {
  const removed = store.deleteBattery(req.params.id);
  if (!removed) {
    res.status(404);
    throw new Error("Battery not found");
  }

  store.logActivity("Battery Removed", `Removed ${removed.modelName || removed.id} from fleet`, "general");
  res.json({ message: "Battery removed successfully", id: req.params.id });
});

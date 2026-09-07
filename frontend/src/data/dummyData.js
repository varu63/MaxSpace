/* ============================================================
   SHARED DUMMY DATA - Single source of truth for the whole app.
   Home, Service, Analytics, and all other pages MUST read from
   this dataset so totals, IDs, statuses, and dates stay
   consistent everywhere.
 ============================================================ */

/* ------------------------------------------------------------
   BATTERIES
------------------------------------------------------------ */
export const batteries = [
  {
    id: "batt-1",
    barcode: "BATT-EV-9823-LFP",
    qrCode: "https://passport.battery-eu.org/passports/BATT-EV-9823-LFP",
    name: "MaxVolt UltraPack 820",
    modelName: "MaxVolt UltraPack 820",
    model: "MaxVolt UltraPack 820",
    type: "Electric Vehicle (EV)",
    manufacturer: "EcoVolt CellTech GmbH",
    serialNumber: "SN-2024-EV-88390",
    chemistry: "LFP (Lithium Iron Phosphate)",
    capacityKwh: 82.5,
    capacity: "82.5 kWh",
    nominalVoltage: "400 V",
    voltage: "400 V",
    weightKg: 465,
    dimensionsMm: "2150 x 1420 x 145",
    manufactureDate: "2024-03-15",
    assemblyLocation: "Salzgitter, Germany",
    location: "Salzgitter, Germany",
    cells: 4,
    stateOfHealth: 96.8,
    stateOfCharge: 84,
    cycleCount: 342,
    maxRatedCycles: 3500,
    internalResistanceMOhms: 18.2,
    operatingTempC: 24.5,
    carbonFootprintKgPerKwh: 58.4,
    recycledContent: {
      cobalt: 24,
      nickel: 20,
      lithium: 16,
      lead: 0
    },
    warranty: {
      status: "Active",
      startDate: "2024-03-15",
      endDate: "2032-03-15",
      remainingDays: 2020,
      terms: "8 Years / 160,000 km (Guaranteed >=70% SoH)",
      provider: "EcoVolt Global Warranty Direct",
      certificateNumber: "WAR-2024-EV-9941"
    },
    complianceStandards: [
      "EU Battery Regulation 2023/1542",
      "ISO 26262 ASIL-D",
      "UN 38.3 Transport Certified",
      "IEC 62619 / CE Compliant"
    ],
    dismantlingManual: "Safe discharge to <10V, disconnect HV interlock loop, use non-sparking insulated tooling.",
    healthHistory: [
      { date: "2024-03", soh: 100 },
      { date: "2024-09", soh: 99.2 },
      { date: "2025-03", soh: 98.4 },
      { date: "2025-09", soh: 97.6 },
      { date: "2026-03", soh: 96.8 }
    ]
  },
  {
    id: "batt-2",
    barcode: "BATT-ESS-4410-NMC",
    qrCode: "https://passport.battery-eu.org/passports/BATT-ESS-4410-NMC",
    name: "SolarStorage PowerCell 15k",
    modelName: "SolarStorage PowerCell 15k",
    model: "SolarStorage PowerCell 15k",
    type: "Stationary Storage (ESS)",
    manufacturer: "Nordic Volt Energy",
    serialNumber: "SN-2023-ESS-10928",
    chemistry: "NMC 811 (Nickel Manganese Cobalt)",
    capacityKwh: 15.0,
    capacity: "15.0 kWh",
    nominalVoltage: "48 V",
    voltage: "48 V",
    weightKg: 124,
    dimensionsMm: "850 x 520 x 220",
    manufactureDate: "2023-11-20",
    assemblyLocation: "Katowice, Poland",
    location: "Katowice, Poland",
    cells: 4,
    stateOfHealth: 92.4,
    stateOfCharge: 95,
    cycleCount: 610,
    maxRatedCycles: 4500,
    internalResistanceMOhms: 22.8,
    operatingTempC: 22.1,
    carbonFootprintKgPerKwh: 74.2,
    recycledContent: {
      cobalt: 18,
      nickel: 15,
      lithium: 12,
      lead: 0
    },
    warranty: {
      status: "Active",
      startDate: "2023-11-20",
      endDate: "2033-11-20",
      remainingDays: 2635,
      terms: "10 Years Unlimited Cycles (Guaranteed >=65% SoH)",
      provider: "Nordic Volt Residential Care",
      certificateNumber: "WAR-2023-ESS-4412"
    },
    complianceStandards: [
      "EU Battery Regulation 2023/1542",
      "VDE-AR-E 2510-50",
      "UL 9540A Fire Safety",
      "CE / EN 62477-1"
    ],
    dismantlingManual: "De-energize main DC breaker, isolate rack modules, recyclable by certified hydro-metallurgical facilities.",
    healthHistory: [
      { date: "2023-11", soh: 100 },
      { date: "2024-05", soh: 97.5 },
      { date: "2024-11", soh: 95.8 },
      { date: "2025-05", soh: 94.0 },
      { date: "2025-11", soh: 93.1 },
      { date: "2026-05", soh: 92.4 }
    ]
  },
  {
    id: "batt-3",
    barcode: "BATT-EBIKE-201-LIFEPO4",
    qrCode: "https://passport.battery-eu.org/passports/BATT-EBIKE-201-LIFEPO4",
    name: "UrbanMoto Sprint Pack 3.2",
    modelName: "UrbanMoto Sprint Pack 3.2",
    model: "UrbanMoto Sprint Pack 3.2",
    type: "Light Electric Vehicle (LEV)",
    manufacturer: "AmpereDrive Systems",
    serialNumber: "SN-2024-LEV-44912",
    chemistry: "LiFePO4",
    capacityKwh: 3.2,
    capacity: "3.2 kWh",
    nominalVoltage: "52 V",
    voltage: "52 V",
    weightKg: 14.8,
    dimensionsMm: "380 x 140 x 95",
    manufactureDate: "2024-06-02",
    assemblyLocation: "Lyon, France",
    location: "Lyon, France",
    cells: 4,
    stateOfHealth: 88.5,
    stateOfCharge: 62,
    cycleCount: 890,
    maxRatedCycles: 2000,
    internalResistanceMOhms: 31.5,
    operatingTempC: 28.4,
    carbonFootprintKgPerKwh: 64.0,
    recycledContent: {
      cobalt: 10,
      nickel: 12,
      lithium: 15,
      lead: 0
    },
    warranty: {
      status: "Expiring Soon",
      startDate: "2024-06-02",
      endDate: "2026-10-02",
      remainingDays: 29,
      terms: "2 Years / 15,000 km standard warranty",
      provider: "AmpereDrive Urban Assurance",
      certificateNumber: "WAR-2024-LEV-3011"
    },
    complianceStandards: [
      "EU Battery Regulation 2023/1542",
      "EN 15194 EPAC Standards",
      "UN 38.3 Safe Transport"
    ],
    dismantlingManual: "Quick-release casing, separate BMS circuit board from cell brick for modular second-life repurposing.",
    healthHistory: [
      { date: "2024-06", soh: 100 },
      { date: "2024-12", soh: 96.0 },
      { date: "2025-06", soh: 92.5 },
      { date: "2025-12", soh: 90.0 },
      { date: "2026-06", soh: 88.5 }
    ]
  },
  {
    id: "batt-4",
    barcode: "BATT-FLEET-500-NCA",
    qrCode: "https://passport.battery-eu.org/passports/BATT-FLEET-500-NCA",
    name: "FleetHauler HeavyPack 120",
    modelName: "FleetHauler HeavyPack 120",
    model: "FleetHauler HeavyPack 120",
    type: "Commercial Transport",
    manufacturer: "Apex Battery Solutions",
    serialNumber: "SN-2022-FLEET-00431",
    chemistry: "NCA (Nickel Cobalt Aluminum)",
    capacityKwh: 120.0,
    capacity: "120.0 kWh",
    nominalVoltage: "800 V",
    voltage: "800 V",
    weightKg: 785,
    dimensionsMm: "2400 x 1600 x 210",
    manufactureDate: "2022-09-10",
    assemblyLocation: "Gothenburg, Sweden",
    location: "Gothenburg, Sweden",
    cells: 4,
    stateOfHealth: 76.2,
    stateOfCharge: 45,
    cycleCount: 1420,
    maxRatedCycles: 2200,
    internalResistanceMOhms: 42.1,
    operatingTempC: 33.2,
    carbonFootprintKgPerKwh: 86.5,
    recycledContent: {
      cobalt: 15,
      nickel: 18,
      lithium: 10,
      lead: 0
    },
    warranty: {
      status: "Expired",
      startDate: "2022-09-10",
      endDate: "2025-09-10",
      remainingDays: 0,
      terms: "3 Years Heavy Duty Commercial Coverage",
      provider: "Apex Industrial Fleet Services",
      certificateNumber: "WAR-2022-FLEET-1002"
    },
    complianceStandards: [
      "EU Battery Regulation 2023/1542",
      "ECE R100 Rev 3",
      "ISO 6469 Electric Safety"
    ],
    dismantlingManual: "Requires heavy duty crane hook, high voltage safety lockout, targeted for grid stationary 2nd life.",
    healthHistory: [
      { date: "2022-09", soh: 100 },
      { date: "2023-09", soh: 91.0 },
      { date: "2024-09", soh: 84.0 },
      { date: "2025-09", soh: 78.5 },
      { date: "2026-06", soh: 76.2 }
    ]
  }
];

/* ------------------------------------------------------------
   SERVICES
------------------------------------------------------------ */
export const services = [
  {
    id: "srv-101",
    ticketNumber: "SRV-2026-9012",
    batteryId: "batt-1",
    batteryName: "MaxVolt UltraPack 820",
    serviceType: "Periodic Health Diagnostic & BMS Firmware Update",
    center: "EcoVolt Certified Hub - Central Berlin",
    scheduledDate: "2026-09-12",
    scheduledTime: "10:30 AM",
    status: "Confirmed",
    priority: "Normal",
    technician: "Markus Vance (Cert #8812)",
    notes: "Regular 30,000 km health validation and BMS thermal map optimization.",
    cost: "$0.00 (Warranty Covered)",
    createdAt: "2026-08-25"
  },
  {
    id: "srv-102",
    ticketNumber: "SRV-2026-8845",
    batteryId: "batt-3",
    batteryName: "UrbanMoto Sprint Pack 3.2",
    serviceType: "Cell Balancing & Connector Reseating",
    center: "Ampere Mobility Care - Paris/Lyon",
    scheduledDate: "2026-09-08",
    scheduledTime: "02:00 PM",
    status: "In Progress",
    priority: "High",
    technician: "Elena Rostova (BMS Specialist)",
    notes: "Customer reported minor voltage delta across block #3 during fast charge.",
    cost: "$45.00",
    createdAt: "2026-08-29"
  },
  {
    id: "srv-103",
    ticketNumber: "SRV-2026-7721",
    batteryId: "batt-4",
    batteryName: "FleetHauler HeavyPack 120",
    serviceType: "Second-Life Stationary Storage Repurposing Assessment",
    center: "Nordic Circular Energy Labs - Gothenburg",
    scheduledDate: "2026-08-10",
    scheduledTime: "11:00 AM",
    status: "Completed",
    priority: "Normal",
    technician: "Dr. Soren Lindqvist",
    notes: "Health assessed at 76.2%. Approved for second-life 48V microgrid buffer deployment.",
    cost: "$350.00",
    createdAt: "2026-08-01"
  },
  {
    id: "srv-104",
    ticketNumber: "SRV-2026-6410",
    batteryId: "batt-2",
    batteryName: "SolarStorage PowerCell 15k",
    serviceType: "Annual Thermal System Inspection",
    center: "EcoVolt Certified Hub - Central Berlin",
    scheduledDate: "2026-05-18",
    scheduledTime: "09:00 AM",
    status: "Completed",
    priority: "Low",
    technician: "Sarah Chen (Energy Systems)",
    notes: "Thermal paste checked, coolant flow nominal, zero degradation anomalies.",
    cost: "$0.00 (Warranty Covered)",
    createdAt: "2026-05-10"
  }
];

/* ------------------------------------------------------------
   SERVICE STATUSES (used by filters + derived per-battery status)
------------------------------------------------------------ */
export const serviceStatuses = [
  "Confirmed",
  "In Progress",
  "Completed",
  "Cancelled",
];

/* ------------------------------------------------------------
   LOCATIONS (assembly + service centers, derived from data)
------------------------------------------------------------ */
export const locations = [
  "Salzgitter, Germany",
  "Katowice, Poland",
  "Lyon, France",
  "Gothenburg, Sweden",
  "EcoVolt Certified Hub - Central Berlin",
  "Ampere Mobility Care - Paris/Lyon",
  "Nordic Circular Energy Labs - Gothenburg",
];

/* ------------------------------------------------------------
   USER PROFILE
------------------------------------------------------------ */
export const initialUserProfile = {
  name: "Alex Rivera",
  title: "Clean Mobility & Energy Fleet Director",
  email: "alex.rivera@maxspace-energy.com",
  phone: "+49 (30) 8492-4910",
  company: "MaxSpace Energy & Green Logistics",
  location: "Berlin, Germany / Austin, TX",
  memberSince: "January 2024",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
  fleetType: "EVs, Micro-Mobility & Solar ESS Assets",
  totalCapacityKwh: 220.7,
  euOperatorId: "EU-BATT-OP-2026-88914",
  notificationSettings: {
    warrantyAlerts: true,
    healthThresholdAlerts: true,
    serviceReminders: true,
    euComplianceUpdates: true,
    smsAlerts: false
  },
  activityLogs: [
    {
      id: "act-1",
      action: "Battery Passport Inspected",
      details: "Viewed compliance passport for MaxVolt UltraPack 820",
      timestamp: "Today at 04:12 PM",
      type: "passport"
    },
    {
      id: "act-2",
      action: "Service Booked",
      details: "Scheduled Diagnostic ticket #SRV-2026-9012",
      timestamp: "Yesterday at 11:30 AM",
      type: "service"
    },
    {
      id: "act-3",
      action: "QR Barcode Scanned",
      details: "Quick scanned BATT-EV-9823-LFP via Header Scanner",
      timestamp: "2 days ago",
      type: "scan"
    },
    {
      id: "act-4",
      action: "Warranty Certificate Downloaded",
      details: "Downloaded certificate WAR-2024-EV-9941 (PDF)",
      timestamp: "5 days ago",
      type: "warranty"
    }
  ]
};

/* ------------------------------------------------------------
   PRESET BARCODES (used by QR scanner presets)
------------------------------------------------------------ */
export const samplePresetBarcodes = [
  {
    code: "BATT-EV-9823-LFP",
    name: "MaxVolt UltraPack 820 (Registered)",
    model: "MaxVolt 82.5 kWh",
    badge: "Existing in Fleet"
  },
  {
    code: "BATT-ESS-4410-NMC",
    name: "SolarStorage PowerCell 15k (Registered)",
    model: "PowerCell 15 kWh",
    badge: "Existing in Fleet"
  },
  {
    code: "BATT-CATL-LFP-9901",
    name: "CATL Shenxing Supercharge (New Demo)",
    model: "100.0 kWh 4C Fast Charging",
    badge: "New Battery Discovery"
  },
  {
    code: "BATT-PANASONIC-2170-EV",
    name: "Panasonic GigaPack Gen-5 (New Demo)",
    model: "75.0 kWh High-Density",
    badge: "New Battery Discovery"
  },
  {
    code: "BATT-BYD-BLADE-882",
    name: "BYD Blade Cell Pack (New Demo)",
    model: "60.0 kWh Structural LFP",
    badge: "New Battery Discovery"
  }
];

/* ------------------------------------------------------------
   DERIVED DATA UTILITIES
   These helper functions keep totals/statuses consistent across
   Home, Service, and Analytics regardless of which page reads them.
------------------------------------------------------------ */

/* Return the effective service status for a battery based on its
   service records. Priority: In Progress > Confirmed > (none).
   Values are normalized to the set used across Home / Service /
   Analytics: "Pending" | "Active" | "Booked" | "Completed". */
export const getBatteryServiceStatus = (
  battery,
  serviceRecords = services
) => {
  const batteryId = battery?.id || battery?.batteryId;

  const records = serviceRecords.filter(
    (service) =>
      service.batteryId === batteryId &&
      service.status !== "Cancelled"
  );

  if (records.length === 0) {
    return "Pending";
  }

  if (records.some((s) => s.status === "In Progress")) {
    return "Active";
  }

  if (records.some((s) => s.status === "Confirmed")) {
    return "Booked";
  }

  return "Completed";
};

/* Map a raw service record into the booking shape used by the
   Service / Analytics views. "Confirmed" is shown as "Booked". */
export const serviceToBooking = (service) => ({
  id: service.id,
  ticketNumber: service.ticketNumber,
  batteryId: service.batteryId,
  batteryName: service.batteryName,
  serviceType: service.serviceType,
  center: service.center,
date: service.scheduledDate,
  time: service.scheduledTime,
  mobileNumber: service.mobileNumber,
  notes: service.notes,
  cost: service.cost,
  priority: service.priority,
  technician: service.technician,
  status:
    service.status === "Confirmed"
      ? "Booked"
      : service.status === "In Progress"
        ? "In Progress"
        : service.status,
});

/* Convert a list of service records to booking records. */
export const bookingsFromServices = (
  serviceRecords = services
) => serviceRecords.map(serviceToBooking);

/* Number of non-cancelled services for a given battery. */
export const getBatteryServiceCount = (
  battery,
  serviceRecords = services
) => {
  const batteryId = battery?.id || battery?.batteryId;

  return serviceRecords.filter(
    (service) =>
      service.batteryId === batteryId &&
      service.status !== "Cancelled"
  ).length;
};

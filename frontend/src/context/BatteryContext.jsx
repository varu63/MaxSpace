import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import confetti from "canvas-confetti";

import {
  initialBatteries,
  initialServices,
  initialUserProfile,
} from "../data/mockData";

const BatteryContext = createContext(null);

/* =========================================================
   STORAGE HELPERS
========================================================= */

const loadFromStorage = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);

    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(`Failed to load ${key}`, error);
  }

  return fallback;
};

/* =========================================================
   PROVIDER
========================================================= */

export const BatteryProvider = ({ children }) => {
  /* =======================================================
     MAIN DATA
  ======================================================= */

  const [batteries, setBatteries] = useState(() =>
    loadFromStorage("maxspace_batteries", initialBatteries)
  );

  const [services, setServices] = useState(() =>
    loadFromStorage("maxspace_services", initialServices)
  );

  const [userProfile, setUserProfile] = useState(() =>
    loadFromStorage(
      "maxspace_user_profile",
      initialUserProfile
    )
  );

  /* =======================================================
     SIDEBAR
  ======================================================= */

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((previous) => !previous);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  /* =======================================================
     TOASTS
  ======================================================= */

  const [toasts, setToasts] = useState([]);

  const addToast = (
    title,
    message,
    type = "success"
  ) => {
    const id = `${Date.now()}-${Math.random()}`;

    const newToast = {
      id,
      title,
      message,
      type,
    };

    setToasts((previous) => [
      ...previous,
      newToast,
    ]);

    setTimeout(() => {
      setToasts((previous) =>
        previous.filter(
          (toast) => toast.id !== id
        )
      );
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((previous) =>
      previous.filter(
        (toast) => toast.id !== id
      )
    );
  };

  /* =======================================================
     SCANNER MODAL
  ======================================================= */

  const [isScannerOpen, setIsScannerOpen] =
    useState(false);

  const [scannerPrefillCode, setScannerPrefillCode] =
    useState("");

  const openScanner = (prefill = "") => {
    setScannerPrefillCode(prefill);
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerPrefillCode("");
  };

  /* =======================================================
     BATTERY PASSPORT MODAL
  ======================================================= */

  const [selectedPassportBattery, setSelectedPassportBattery] =
    useState(null);

  const openPassport = (battery) => {
    setSelectedPassportBattery(battery);

    logActivity(
      "Passport Inspected",
      `Viewed passport for ${
        battery?.modelName || "battery"
      }`,
      "passport"
    );
  };

  const closePassport = () => {
    setSelectedPassportBattery(null);
  };

  /* =======================================================
     ADD BATTERY MODAL
  ======================================================= */

  const [isAddBatteryOpen, setIsAddBatteryOpen] =
    useState(false);

  const [addBatteryPrefill, setAddBatteryPrefill] =
    useState(null);

  const openAddBattery = (prefillData = null) => {
    setAddBatteryPrefill(prefillData);
    setIsAddBatteryOpen(true);
  };

  const closeAddBattery = () => {
    setIsAddBatteryOpen(false);
    setAddBatteryPrefill(null);
  };

  /* =======================================================
     ACTIVITY LOG
  ======================================================= */

  const logActivity = (
    action,
    details,
    type = "general"
  ) => {
    const newActivity = {
      id: `act-${Date.now()}`,
      action,
      details,
      timestamp: "Just now",
      type,
    };

    setUserProfile((previous) => ({
      ...previous,
      activityLogs: [
        newActivity,
        ...(previous.activityLogs || []),
      ].slice(0, 20),
    }));
  };

  /* =======================================================
     BATTERY OPERATIONS
  ======================================================= */

  const addBattery = (batteryData = {}) => {
    const today = new Date()
      .toISOString()
      .split("T")[0];

    const barcode =
      batteryData.barcode ||
      `BATT-GEN-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    const newBattery = {
      id: `batt-${Date.now()}`,

      barcode,

      qrCode: `https://passport.battery-eu.org/passports/${barcode}`,

      modelName:
        batteryData.modelName ||
        "New Battery System",

      type:
        batteryData.type ||
        "Electric Vehicle (EV)",

      manufacturer:
        batteryData.manufacturer ||
        "EcoVolt Certified Partner",

      serialNumber:
        batteryData.serialNumber ||
        `SN-${new Date().getFullYear()}-${Math.floor(
          10000 + Math.random() * 90000
        )}`,

      chemistry:
        batteryData.chemistry ||
        "LFP (Lithium Iron Phosphate)",

      capacityKwh:
        Number(batteryData.capacityKwh) || 60,

      nominalVoltage:
        batteryData.nominalVoltage || "400 V",

      weightKg:
        Number(batteryData.weightKg) || 350,

      dimensionsMm:
        batteryData.dimensionsMm ||
        "1800 x 1200 x 140",

      manufactureDate:
        batteryData.manufactureDate || today,

      assemblyLocation:
        batteryData.assemblyLocation ||
        "European Union",

      stateOfHealth:
        Number(batteryData.stateOfHealth) || 100,

      stateOfCharge:
        Number(batteryData.stateOfCharge) || 85,

      cycleCount:
        Number(batteryData.cycleCount) || 12,

      maxRatedCycles:
        Number(batteryData.maxRatedCycles) || 3000,

      internalResistanceMOhms:
        Number(
          batteryData.internalResistanceMOhms
        ) || 19.5,

      operatingTempC:
        Number(batteryData.operatingTempC) || 24,

      carbonFootprintKgPerKwh:
        Number(
          batteryData.carbonFootprintKgPerKwh
        ) || 62,

      recycledContent:
        batteryData.recycledContent || {
          cobalt: 20,
          nickel: 15,
          lithium: 14,
          lead: 0,
        },

      serviceCount: 0,

      warranty: {
        status: "Active",
        startDate:
          batteryData.manufactureDate || today,

        endDate: new Date(
          Date.now() +
            8 * 365 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0],

        remainingDays: 8 * 365,

        terms:
          "8 Years / 160,000 km Guaranteed Health Retention",

        provider:
          "EcoVolt Global Warranty Direct",

        certificateNumber: `WAR-${new Date().getFullYear()}-${Math.floor(
          1000 + Math.random() * 9000
        )}`,
      },

      complianceStandards: [
        "EU Battery Regulation 2023/1542",
        "ISO 26262 ASIL-D",
        "UN 38.3 Transport Certified",
      ],

      dismantlingManual:
        "Safe discharge to <10V, disconnect HV interlock loop, use non-sparking insulated tooling.",

      healthHistory: [
        {
          date: new Date()
            .toISOString()
            .slice(0, 7),
          soh:
            Number(
              batteryData.stateOfHealth
            ) || 100,
        },
      ],
    };

    setBatteries((previous) => [
      newBattery,
      ...previous,
    ]);

    logActivity(
      "Battery Added & Passport Minted",
      `Registered ${newBattery.modelName} (${newBattery.barcode})`,
      "passport"
    );

    addToast(
      "Battery Passport Created!",
      `${newBattery.modelName} is now registered with EU DPP compliance.`
    );

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: {
          y: 0.6,
        },
      });
    } catch {
      // Ignore confetti errors
    }

    return newBattery;
  };

  const updateBattery = (
    batteryId,
    updatedFields
  ) => {
    setBatteries((previous) =>
      previous.map((battery) =>
        battery.id === batteryId
          ? {
              ...battery,
              ...updatedFields,
            }
          : battery
      )
    );

    addToast(
      "Battery Updated",
      "Passport records synchronized successfully."
    );
  };

  const deleteBattery = (batteryId) => {
    const battery = batteries.find(
      (item) => item.id === batteryId
    );

    setBatteries((previous) =>
      previous.filter(
        (item) => item.id !== batteryId
      )
    );

    logActivity(
      "Battery Removed",
      `Removed ${
        battery?.modelName || batteryId
      } from fleet`,
      "general"
    );

    addToast(
      "Battery Removed",
      "Battery has been unlinked from your account.",
      "info"
    );
  };

  const findBatteryByBarcode = (code) => {
    if (!code) return null;

    const cleanCode = code
      .trim()
      .toUpperCase();

    return batteries.find((battery) => {
      const barcode =
        battery.barcode?.toUpperCase();

      const serial =
        battery.serialNumber?.toUpperCase();

      const id =
        battery.id?.toUpperCase();

      return (
        barcode === cleanCode ||
        serial === cleanCode ||
        id === cleanCode
      );
    });
  };

  /* =======================================================
     SERVICE OPERATIONS
  ======================================================= */

  const bookService = (bookingData = {}) => {
    const battery = batteries.find(
      (item) =>
        item.id === bookingData.batteryId
    );

    const newService = {
      id: `srv-${Date.now()}`,

      ticketNumber: `SRV-${new Date().getFullYear()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`,

      batteryId:
        bookingData.batteryId,

      batteryName:
        battery?.modelName ||
        bookingData.batteryName ||
        "Unknown Battery",

      serviceType:
        bookingData.serviceType ||
        "Battery Inspection",

      center:
        bookingData.center ||
        "MaxSpace Service Center",

      scheduledDate:
        bookingData.scheduledDate,

      scheduledTime:
        bookingData.scheduledTime,

      status: "Confirmed",

      priority:
        bookingData.priority ||
        "Normal",

      technician:
        bookingData.technician ||
        "Certified Battery Diagnostic Tech",

      notes:
        bookingData.notes ||
        "Routine check requested by owner.",

      cost:
        bookingData.cost ||
        "$0.00 (Warranty Covered)",

      createdAt: new Date()
        .toISOString()
        .split("T")[0],
    };

    setServices((previous) => [
      newService,
      ...previous,
    ]);

    logActivity(
      "Service Booked",
      `Ticket #${newService.ticketNumber} for ${newService.batteryName}`,
      "service"
    );

    addToast(
      "Service Confirmed!",
      `Appointment scheduled on ${newService.scheduledDate} at ${newService.scheduledTime}`
    );

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: {
          y: 0.6,
        },
      });
    } catch {
      // Ignore confetti errors
    }

    return newService;
  };

  /* =======================================================
     PROFILE
  ======================================================= */

  const updateProfile = (
    updatedProfile
  ) => {
    setUserProfile((previous) => ({
      ...previous,
      ...updatedProfile,
    }));

    addToast(
      "Profile Updated",
      "Your profile details and preferences have been saved."
    );
  };

  /* =======================================================
     ANALYTICS / COMPUTED STATS
  ======================================================= */

  const stats = useMemo(() => {
    const totalBatteries =
      batteries.length;

    const optimalBatteries =
      batteries.filter(
        (battery) =>
          Number(
            battery.stateOfHealth
          ) >= 90
      ).length;

    const goodBatteries =
      batteries.filter((battery) => {
        const health = Number(
          battery.stateOfHealth
        );

        return (
          health >= 80 &&
          health < 90
        );
      }).length;

    const attentionBatteries =
      batteries.filter(
        (battery) =>
          Number(
            battery.stateOfHealth
          ) < 80
      ).length;

    const totalCapacityKwh =
      batteries.reduce(
        (total, battery) =>
          total +
          (Number(
            battery.capacityKwh
          ) || 0),
        0
      );

    const avgHealth =
      totalBatteries > 0
        ? batteries.reduce(
            (total, battery) =>
              total +
              Number(
                battery.stateOfHealth
              ),
            0
          ) / totalBatteries
        : 0;

    const totalServices =
      services.length;

    const upcomingServices =
      services.filter(
        (service) =>
          service.status ===
          "Confirmed"
      ).length;

    const inProgressServices =
      services.filter(
        (service) =>
          service.status ===
          "In Progress"
      ).length;

    const completedServices =
      services.filter(
        (service) =>
          service.status ===
          "Completed"
      ).length;

    const cancelledServices =
      services.filter(
        (service) =>
          service.status ===
          "Cancelled"
      ).length;

    const totalWarranties =
      batteries.length;

    const activeWarranties =
      batteries.filter(
        (battery) =>
          battery.warranty?.status ===
          "Active"
      ).length;

    const expiringWarranties =
      batteries.filter(
        (battery) =>
          battery.warranty?.status ===
          "Expiring Soon"
      ).length;

    const expiredWarranties =
      batteries.filter(
        (battery) =>
          battery.warranty?.status ===
          "Expired"
      ).length;

    return {
      /* Battery */
      totalBatteries,
      optimalBatteries,
      goodBatteries,
      attentionBatteries,
      totalCapacityKwh:
        totalCapacityKwh.toFixed(1),
      avgHealth:
        Number(avgHealth).toFixed(1),

      /* Services */
      totalServices,
      upcomingServices,
      inProgressServices,
      completedServices,
      cancelledServices,

      /* Warranty */
      totalWarranties,
      activeWarranties,
      expiringWarranties,
      expiredWarranties,
    };
  }, [batteries, services]);

  /* =======================================================
     RESET DATA
  ======================================================= */

  const resetToSampleData = () => {
    setBatteries(initialBatteries);
    setServices(initialServices);
    setUserProfile(initialUserProfile);

    addToast(
      "Sample Data Restored",
      "Reset all records to initial EU DPP sample dataset.",
      "info"
    );
  };

  /* =======================================================
     LOCAL STORAGE
  ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        "maxspace_batteries",
        JSON.stringify(batteries)
      );
    } catch (error) {
      console.error(
        "Failed to save batteries",
        error
      );
    }
  }, [batteries]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "maxspace_services",
        JSON.stringify(services)
      );
    } catch (error) {
      console.error(
        "Failed to save services",
        error
      );
    }
  }, [services]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "maxspace_user_profile",
        JSON.stringify(userProfile)
      );
    } catch (error) {
      console.error(
        "Failed to save user profile",
        error
      );
    }
  }, [userProfile]);

  /* =======================================================
     CONTEXT VALUE
  ======================================================= */

  const contextValue = useMemo(
    () => ({
      /* Navigation */

      /* Main Data */
      batteries,
      setBatteries,

      services,
      setServices,

      userProfile,
      setUserProfile,

      stats,

      /* Toast */
      toasts,
      addToast,
      removeToast,

      /* Battery */
      addBattery,
      updateBattery,
      deleteBattery,
      findBatteryByBarcode,

      /* Services */
      bookService,

      /* Profile */
      updateProfile,

      /* Scanner */
      isScannerOpen,
      scannerPrefillCode,
      openScanner,
      closeScanner,

      /* Passport */
      selectedPassportBattery,
      openPassport,
      closePassport,

      /* Add Battery */
      isAddBatteryOpen,
      addBatteryPrefill,
      openAddBattery,
      closeAddBattery,

      /* Sidebar */
      isSidebarOpen,
      setIsSidebarOpen,
      toggleSidebar,
      closeSidebar,

      /* Reset */
      resetToSampleData,
    }),
    [
      batteries,
      services,
      userProfile,
      stats,
      toasts,
      isScannerOpen,
      scannerPrefillCode,
      selectedPassportBattery,
      isAddBatteryOpen,
      addBatteryPrefill,
      isSidebarOpen,
    ]
  );

  return (
    <BatteryContext.Provider
      value={contextValue}
    >
      {children}
    </BatteryContext.Provider>
  );
};

/* =========================================================
   HOOK
========================================================= */

export const useBattery = () => {
  const context = useContext(
    BatteryContext
  );

  if (!context) {
    throw new Error(
      "useBattery must be used inside BatteryProvider"
    );
  }

  return context;
};
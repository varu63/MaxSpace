import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import confetti from "canvas-confetti";

import {
  batteries as initialBatteries,
  services as initialServices,
  initialUserProfile,
  getBatteryServiceStatus,
  getBatteryServiceCount,
} from "../data/dummyData";

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
    loadFromStorage("maxspace_user_profile", initialUserProfile)
  );

  /* =======================================================
     AUTH
  ======================================================= */

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => loadFromStorage("maxspace_auth", null) === "authenticated"
  );

  const signIn = useCallback((credentials = {}) => {
    const profile = loadFromStorage("maxspace_user_profile", initialUserProfile);

    if (credentials && credentials.name) {
      setUserProfile((prev) => ({
        ...(prev || profile || {}),
        name: credentials.name,
        email: credentials.email || prev?.email || profile?.email || "",
      }));
    }

    setIsAuthenticated(true);
    localStorage.setItem("maxspace_auth", "authenticated");
    return true;
  }, [setIsAuthenticated, setUserProfile]);

  const signUp = useCallback((credentials = {}) => {
    setUserProfile((previous) => ({
      ...(previous || {}),
      name: credentials.name || previous?.name || "",
      email: credentials.email || previous?.email || "",
      company: credentials.company || previous?.company || "",
    }));

    setIsAuthenticated(true);
    localStorage.setItem("maxspace_auth", "authenticated");
    return true;
  }, [setIsAuthenticated, setUserProfile]);

  const signOut = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem("maxspace_auth");
  }, [setIsAuthenticated]);

  /* =======================================================
     SIDEBAR
  ======================================================= */

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((previous) => !previous);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  /* =======================================================
     TOASTS
  ======================================================= */

  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id]);
      delete toastTimers.current[id];
    }
  }, []);

  const addToast = useCallback(
    (title, message, type = "success") => {
      const id = `${Date.now()}-${Math.random()}`;

      setToasts((previous) => [...previous, { id, title, message, type }]);

      toastTimers.current[id] = setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  /* =======================================================
     SCANNER MODAL
  ======================================================= */

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerPrefillCode, setScannerPrefillCode] = useState("");

  const openScanner = useCallback((prefill = "") => {
    setScannerPrefillCode(prefill);
    setIsScannerOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
    setScannerPrefillCode("");
  }, []);

  /* =======================================================
     BATTERY PASSPORT MODAL
  ======================================================= */

  const [selectedPassportBattery, setSelectedPassportBattery] = useState(null);

  const logActivity = useCallback((action, details, type = "general") => {
    const newActivity = {
      id: `act-${Date.now()}`,
      action,
      details,
      timestamp: "Just now",
      type,
    };

    setUserProfile((previous) => ({
      ...previous,
      activityLogs: [newActivity, ...(previous?.activityLogs || [])].slice(0, 20),
    }));
  }, [setUserProfile]);

  const openPassport = useCallback(
    (battery) => {
      setSelectedPassportBattery(battery);
      logActivity("Passport Inspected", `Viewed passport for ${battery?.modelName || "battery"}`, "passport");
    },
    [logActivity]
  );

  const closePassport = useCallback(() => {
    setSelectedPassportBattery(null);
  }, []);

  /* =======================================================
     ADD BATTERY MODAL
  ======================================================= */

  const [isAddBatteryOpen, setIsAddBatteryOpen] = useState(false);
  const [addBatteryPrefill, setAddBatteryPrefill] = useState(null);

  const openAddBattery = useCallback((prefillData = null) => {
    setAddBatteryPrefill(prefillData);
    setIsAddBatteryOpen(true);
  }, []);

  const closeAddBattery = useCallback(() => {
    setIsAddBatteryOpen(false);
    setAddBatteryPrefill(null);
  }, []);

  /* =======================================================
     BATTERY OPERATIONS
  ======================================================= */

  const addBattery = useCallback(
    (batteryData = {}) => {
      const today = new Date().toISOString().split("T")[0];

      const barcode = batteryData.barcode || `BATT-GEN-${Math.floor(1000 + Math.random() * 9000)}`;

      const newBattery = {
        id: `batt-${Date.now()}`,
        barcode,
        qrCode: `https://passport.battery-eu.org/passports/${barcode}`,
        modelName: batteryData.modelName || "New Battery System",
        type: batteryData.type || "Electric Vehicle (EV)",
        manufacturer: batteryData.manufacturer || "EcoVolt Certified Partner",
        serialNumber: batteryData.serialNumber || `SN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        chemistry: batteryData.chemistry || "LFP (Lithium Iron Phosphate)",
        capacityKwh: Number(batteryData.capacityKwh) || 60,
        nominalVoltage: batteryData.nominalVoltage || "400 V",
        weightKg: Number(batteryData.weightKg) || 350,
        dimensionsMm: batteryData.dimensionsMm || "1800 x 1200 x 140",
        manufactureDate: batteryData.manufactureDate || today,
        assemblyLocation: batteryData.assemblyLocation || "European Union",
        stateOfHealth: Number(batteryData.stateOfHealth) || 100,
        stateOfCharge: Number(batteryData.stateOfCharge) || 85,
        cycleCount: Number(batteryData.cycleCount) || 12,
        maxRatedCycles: Number(batteryData.maxRatedCycles) || 3000,
        internalResistanceMOhms: Number(batteryData.internalResistanceMOhms) || 19.5,
        operatingTempC: Number(batteryData.operatingTempC) || 24,
        carbonFootprintKgPerKwh: Number(batteryData.carbonFootprintKgPerKwh) || 62,
        recycledContent: batteryData.recycledContent || {
          cobalt: 20, nickel: 15, lithium: 14, lead: 0,
        },
        serviceCount: 0,
        warranty: {
          status: "Active",
          startDate: batteryData.manufactureDate || today,
          endDate: new Date(Date.now() + 8 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          remainingDays: 8 * 365,
          terms: "8 Years / 160,000 km Guaranteed Health Retention",
          provider: "EcoVolt Global Warranty Direct",
          certificateNumber: `WAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        },
        complianceStandards: [
          "EU Battery Regulation 2023/1542",
          "ISO 26262 ASIL-D",
          "UN 38.3 Transport Certified",
        ],
        dismantlingManual:
          "Safe discharge to <10V, disconnect HV interlock loop, use non-sparking insulated tooling.",
        healthHistory: [
          { date: new Date().toISOString().slice(0, 7), soh: Number(batteryData.stateOfHealth) || 100 },
        ],
      };

      setBatteries((previous) => [newBattery, ...previous]);
      logActivity("Battery Added & Passport Minted", `Registered ${newBattery.modelName} (${newBattery.barcode})`, "passport");
      addToast("Battery Passport Created!", `${newBattery.modelName} is now registered with EU DPP compliance.`);

      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {
        // Ignore confetti errors
      }

      return newBattery;
    },
    [addToast, logActivity]
  );

  const updateBattery = useCallback(
    (batteryId, updatedFields) => {
      setBatteries((previous) =>
        previous.map((battery) =>
          battery.id === batteryId ? { ...battery, ...updatedFields } : battery
        )
      );
      addToast("Battery Updated", "Passport records synchronized successfully.");
    },
    [addToast]
  );

  const deleteBattery = useCallback(
    (batteryId) => {
      setBatteries((previous) => {
        const battery = previous.find((item) => item.id === batteryId);
        if (battery) {
          logActivity("Battery Removed", `Removed ${battery.modelName || batteryId} from fleet`, "general");
        }
        return previous.filter((item) => item.id !== batteryId);
      });

      addToast("Battery Removed", "Battery has been unlinked from your account.", "info");
    },
    [addToast, logActivity]
  );

  const findBatteryByBarcode = useCallback((code) => {
    if (!code) return null;

    const cleanCode = code.trim().toUpperCase();

    return batteries.find((battery) => {
      const barcode = battery.barcode?.toUpperCase();
      const serial = battery.serialNumber?.toUpperCase();
      const id = battery.id?.toUpperCase();
      return barcode === cleanCode || serial === cleanCode || id === cleanCode;
    });
  }, [batteries]);

  /* =======================================================
     SERVICE OPERATIONS
  ======================================================= */

  const bookService = useCallback(
    (bookingData = {}) => {
      const battery = batteries.find((item) => item.id === bookingData.batteryId);

      const newService = {
        id: `srv-${Date.now()}`,
        ticketNumber: `SRV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        batteryId: bookingData.batteryId,
        batteryName: battery?.modelName || bookingData.batteryName || "Unknown Battery",
        serviceType: bookingData.serviceType || "Battery Inspection",
        center: bookingData.center || "MaxSpace Service Center",
        scheduledDate: bookingData.scheduledDate,
        scheduledTime: bookingData.scheduledTime,
        mobileNumber: bookingData.mobileNumber || "",
        status: "Confirmed",
        priority: bookingData.priority || "Normal",
        technician: bookingData.technician || "Certified Battery Diagnostic Tech",
        notes: bookingData.notes || "Routine check requested by owner.",
        cost: bookingData.cost || "$0.00 (Warranty Covered)",
        createdAt: new Date().toISOString().split("T")[0],
      };

      setServices((previous) => [newService, ...previous]);
      logActivity("Service Booked", `Ticket #${newService.ticketNumber} for ${newService.batteryName}`, "service");
      addToast("Service Confirmed!", `Appointment scheduled on ${newService.scheduledDate} at ${newService.scheduledTime}`);

      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {
        // Ignore confetti errors
      }

      return newService;
    },
    [addToast, batteries, logActivity]
  );

  /* =======================================================
     PROFILE
  ======================================================= */

  const updateProfile = useCallback(
    (updatedProfile) => {
      setUserProfile((previous) => ({ ...previous, ...updatedProfile }));
      addToast("Profile Updated", "Your profile details and preferences have been saved.");
    },
    [addToast, setUserProfile]
  );

  /* =======================================================
     ANALYTICS / COMPUTED STATS
  ======================================================= */

  const stats = useMemo(() => {
    const totalBatteries = batteries.length;

    const optimalBatteries = batteries.filter((battery) => Number(battery.stateOfHealth) >= 90).length;
    const goodBatteries = batteries.filter((battery) => {
      const health = Number(battery.stateOfHealth);
      return health >= 80 && health < 90;
    }).length;
    const attentionBatteries = batteries.filter((battery) => Number(battery.stateOfHealth) < 80).length;

    const totalCapacityKwh = batteries.reduce(
      (total, battery) => total + (Number(battery.capacityKwh) || 0),
      0
    );

    const avgHealth =
      totalBatteries > 0
        ? batteries.reduce((total, battery) => total + Number(battery.stateOfHealth), 0) / totalBatteries
        : 0;

    const totalServices = services.length;
    const upcomingServices = services.filter((service) => service.status === "Confirmed").length;
    const inProgressServices = services.filter((service) => service.status === "In Progress").length;
    const completedServices = services.filter((service) => service.status === "Completed").length;
    const cancelledServices = services.filter((service) => service.status === "Cancelled").length;

    const totalWarranties = batteries.length;
    const activeWarranties = batteries.filter((battery) => battery.warranty?.status === "Active").length;
    const expiringWarranties = batteries.filter((battery) => battery.warranty?.status === "Expiring Soon").length;
    const expiredWarranties = batteries.filter((battery) => battery.warranty?.status === "Expired").length;

    return {
      totalBatteries,
      optimalBatteries,
      goodBatteries,
      attentionBatteries,
      totalCapacityKwh: totalCapacityKwh.toFixed(1),
      avgHealth: Number(avgHealth).toFixed(1),
      totalServices,
      upcomingServices,
      inProgressServices,
      completedServices,
      cancelledServices,
      totalWarranties,
      activeWarranties,
      expiringWarranties,
      expiredWarranties,
    };
  }, [batteries, services]);

  /* =======================================================
     RESET DATA
  ======================================================= */

  const resetToSampleData = useCallback(() => {
    setBatteries(initialBatteries);
    setServices(initialServices);
    setUserProfile(initialUserProfile);
    addToast("Sample Data Restored", "Reset all records to initial EU DPP sample dataset.", "info");
  }, [addToast, setUserProfile]);

  /* =======================================================
     LOCAL STORAGE
  ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem("maxspace_batteries", JSON.stringify(batteries));
    } catch (error) {
      console.error("Failed to save batteries", error);
    }
  }, [batteries]);

  useEffect(() => {
    try {
      localStorage.setItem("maxspace_services", JSON.stringify(services));
    } catch (error) {
      console.error("Failed to save services", error);
    }
  }, [services]);

  useEffect(() => {
    try {
      localStorage.setItem("maxspace_user_profile", JSON.stringify(userProfile));
    } catch (error) {
      console.error("Failed to save user profile", error);
    }
  }, [userProfile]);

  /* =======================================================
     CONTEXT VALUE
  ======================================================= */

  const getBatteryServiceStatusFn = useCallback(
    (battery) => getBatteryServiceStatus(battery, services),
    [services]
  );

  const getBatteryServiceCountFn = useCallback(
    (battery) => getBatteryServiceCount(battery, services),
    [services]
  );

  const contextValue = useMemo(
    () => ({
      isAuthenticated,
      signIn,
      signUp,
      signOut,

      batteries,
      setBatteries,
      services,
      setServices,
      userProfile,
      setUserProfile,
      stats,

      toasts,
      addToast,
      removeToast,

      addBattery,
      updateBattery,
      deleteBattery,
      findBatteryByBarcode,

      bookService,
      getBatteryServiceStatus: getBatteryServiceStatusFn,
      getBatteryServiceCount: getBatteryServiceCountFn,

      updateProfile,

      isScannerOpen,
      scannerPrefillCode,
      openScanner,
      closeScanner,

      selectedPassportBattery,
      openPassport,
      closePassport,

      isAddBatteryOpen,
      addBatteryPrefill,
      openAddBattery,
      closeAddBattery,

      isSidebarOpen,
      setIsSidebarOpen,
      toggleSidebar,
      closeSidebar,

      resetToSampleData,
    }),
    [
      isAuthenticated,
      signIn,
      signUp,
      signOut,
      batteries,
      services,
      userProfile,
      stats,
      toasts,
      addToast,
      removeToast,
      addBattery,
      updateBattery,
      deleteBattery,
      findBatteryByBarcode,
      bookService,
      getBatteryServiceStatusFn,
      getBatteryServiceCountFn,
      updateProfile,
      isScannerOpen,
      scannerPrefillCode,
      openScanner,
      closeScanner,
      selectedPassportBattery,
      openPassport,
      closePassport,
      isAddBatteryOpen,
      addBatteryPrefill,
      openAddBattery,
      closeAddBattery,
      isSidebarOpen,
      setIsSidebarOpen,
      toggleSidebar,
      closeSidebar,
      resetToSampleData,
    ]
  );

  return <BatteryContext.Provider value={contextValue}>{children}</BatteryContext.Provider>;
};

/* =========================================================
   HOOK
========================================================= */

export const useBattery = () => {
  const context = useContext(BatteryContext);

  if (!context) {
    throw new Error("useBattery must be used inside BatteryProvider");
  }

  return context;
};

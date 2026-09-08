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

import { initialUserProfile, getBatteryServiceStatus, getBatteryServiceCount } from "../data/dummyData";
import * as api from "../services/api";

const BatteryContext = createContext(null);

/* =========================================================
   PROVIDER
======================================================== */

export const BatteryProvider = ({ children }) => {
  /* =======================================================
     MAIN DATA (loaded from the backend API)
  ======================================================= */

  const [batteries, setBatteries] = useState([]);
  const [services, setServices] = useState([]);
  const [userProfile, setUserProfile] = useState(() =>
    // Prefill from a stored copy so auth pages render instantly,
    // then sync with the server once loaded.
    api.getToken() ? (loadProfileFromStorage() || initialUserProfile) : initialUserProfile
  );
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(api.getToken()));
  const [loading, setLoading] = useState(false);

  /* =======================================================
     AUTH
  ======================================================= */

  const signIn = useCallback(async (credentials = {}) => {
    // Authenticate with the backend and store the JWT
    const data = await api.signIn(credentials);
    api.setToken(data.token);
    setUserProfile(data.user || {});
    setIsAuthenticated(true);
    return data.user;
  }, []);

  const signUp = useCallback(async (credentials = {}) => {
    const data = await api.signUp(credentials);
    api.setToken(data.token);
    setUserProfile(data.user || {});
    setIsAuthenticated(true);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    setIsAuthenticated(false);
    api.setToken(null);
    try {
      await api.logout();
    } catch {
      // Stateless JWT — the server call is best-effort
    }
    setUserProfile(initialUserProfile);
    setBatteries([]);
    setServices([]);
    clearProfileFromStorage();
  }, []);

  /* =======================================================
     DATA LOADING (on mount + on auth change)
  ======================================================= */

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [batts, servs, prof] = await Promise.all([
        api.fetchBatteries(),
        api.fetchServices(),
        api.fetchProfile(),
      ]);
      setBatteries(batts || []);
      setServices(servs || []);
      setUserProfile(prof?.profile || initialUserProfile);
      saveProfileToStorage(prof?.profile || initialUserProfile);
    } catch (error) {
      // Invalid/expired token — drop back to unauthenticated
      if (isAuthError(error)) {
        api.setToken(null);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch fresh data when the user (re)authenticates
  useEffect(() => {
    if (isAuthenticated && api.getToken()) {
      loadAllData();
    }
  }, [isAuthenticated, loadAllData]);

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
     ACTIVITY LOG (local UI tracker)
  ======================================================= */

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
  }, []);

  /* =======================================================
     SIDEBAR / SCANNER / PASSPORT / ADD BATTERY MODALS
  ======================================================= */

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((pv) => !pv), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

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

  const [selectedPassportBattery, setSelectedPassportBattery] = useState(null);
  const openPassport = useCallback(
    (battery) => {
      setSelectedPassportBattery(battery);
      logActivity("Passport Inspected", `Viewed passport for ${battery?.modelName || "battery"}`, "passport");
    },
    [logActivity]
  );
  const closePassport = useCallback(() => setSelectedPassportBattery(null), []);

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
    async (batteryData = {}) => {
      try {
        const newBattery = await api.createBattery(batteryData);
        setBatteries((previous) => [newBattery, ...previous]);
        addToast("Battery Passport Created!", `${newBattery.modelName} is now registered with EU DPP compliance.`);
        try {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } catch {
          // Ignore confetti errors
        }
        return newBattery;
      } catch (error) {
        addToast("Could Not Add Battery", api.getErrorMessage(error), "error");
        return null;
      }
    },
    [addToast]
  );

  const updateBattery = useCallback(
    async (batteryId, updatedFields) => {
      try {
        const updated = await api.updateBattery(batteryId, updatedFields);
        setBatteries((previous) =>
          previous.map((battery) => (battery.id === batteryId ? { ...battery, ...updated } : battery))
        );
        addToast("Battery Updated", "Passport records synchronized successfully.");
        return updated;
      } catch (error) {
        addToast("Update Failed", api.getErrorMessage(error), "error");
        return null;
      }
    },
    [addToast]
  );

  const deleteBattery = useCallback(
    async (batteryId) => {
      try {
        await api.deleteBattery(batteryId);
        const battery = batteries.find((item) => item.id === batteryId);
        setBatteries((previous) => previous.filter((item) => item.id !== batteryId));
        if (battery) {
          logActivity("Battery Removed", `Removed ${battery.modelName || batteryId} from fleet`, "general");
        }
        addToast("Battery Removed", "Battery has been unlinked from your account.", "info");
      } catch (error) {
        addToast("Could Not Remove Battery", api.getErrorMessage(error), "error");
      }
    },
    [addToast, logActivity, batteries]
  );

  const findBatteryByBarcode = useCallback(async (code) => {
    if (!code) return null;
    try {
      const battery = await api.lookupBattery(code);
      return battery || null;
    } catch {
      return null;
    }
  }, []);

  /* =======================================================
     SERVICE OPERATIONS
  ======================================================= */

  const bookService = useCallback(
    async (bookingData = {}) => {
      try {
        const newService = await api.createService(bookingData);
        setServices((previous) => [newService, ...previous]);
        addToast("Service Confirmed!", `Appointment scheduled on ${newService.scheduledDate} at ${newService.scheduledTime}`);
        try {
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        } catch {
          // Ignore confetti errors
        }
        return newService;
      } catch (error) {
        addToast("Booking Failed", api.getErrorMessage(error), "error");
        return null;
      }
    },
    [addToast]
  );

  // Complete / cancel / update a service record on the backend
  const updateServiceStatus = useCallback(
    async (serviceId, newStatus) => {
      try {
        const updated = await api.updateService(serviceId, { status: newStatus });
        setServices((previous) =>
          previous.map((service) => (service.id === serviceId ? { ...service, ...updated } : service))
        );
        addToast("Service Updated", `Service ticket ${newStatus}.`);
        return updated;
      } catch (error) {
        addToast("Update Failed", api.getErrorMessage(error), "error");
        return null;
      }
    },
    [addToast]
  );

  /* =======================================================
     PROFILE
  ======================================================= */

  const updateProfile = useCallback(
    async (updatedProfile) => {
      try {
        const data = await api.updateProfile(updatedProfile);
        setUserProfile(data?.profile || {});
        saveProfileToStorage(data?.profile || {});
        addToast("Profile Updated", "Your profile details and preferences have been saved.");
        return data?.profile;
      } catch (error) {
        addToast("Could Not Update Profile", api.getErrorMessage(error), "error");
        return null;
      }
    },
    [addToast]
  );

  const updateNotifications = useCallback(
    async (settings) => {
      const data = await api.updateNotifications(settings);
      setUserProfile(data?.profile || {});
      return data?.profile;
    },
    []
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

  const resetToSampleData = useCallback(async () => {
    try {
      await api.resetData();
      await loadAllData();
      addToast("Sample Data Restored", "Reset all records to initial EU DPP sample dataset.", "info");
    } catch (error) {
      addToast("Reset Failed", api.getErrorMessage(error), "error");
    }
  }, [loadAllData, addToast]);

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
      loading,
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
      updateServiceStatus,
      getBatteryServiceStatus: getBatteryServiceStatusFn,
      getBatteryServiceCount: getBatteryServiceCountFn,

      updateProfile,
      updateNotifications,

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
      loading,
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
      updateServiceStatus,
      getBatteryServiceStatusFn,
      getBatteryServiceCountFn,
      updateProfile,
      updateNotifications,
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
   HELPERS
======================================================== */

// Save/load the profile locally so auth pages show data immediately.
const PROFILE_STORAGE_KEY = "maxspace_user_profile";

const loadProfileFromStorage = () => {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveProfileToStorage = (profile) => {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
};

const clearProfileFromStorage = () => {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};

// Detect 401-style auth failures so we can log the user out.
const isAuthError = (error) => /401|not authorized|no token|token/i.test(error?.message || "");

/* =========================================================
   HOOK
======================================================== */

export const useBattery = () => {
  const context = useContext(BatteryContext);
  if (!context) {
    throw new Error("useBattery must be used inside BatteryProvider");
  }
  return context;
};

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as batteryTechnicianApi from "../services/batteryTechnicianApi";

const BatteryTechnicianContext = createContext(null);

const isAuthError = (error) =>
  /401|403|not authorized|no token|token|denied/i.test(error?.message || "");

export const BatteryTechnicianProvider = ({ children }) => {
  const [batteryTechnicianUser, setBatteryTechnicianUser] = useState(() =>
    batteryTechnicianApi.getBatteryTechnicianToken()
      ? batteryTechnicianApi.getBatteryTechnicianProfile()
      : null
  );
  const [isBatteryTechnicianAuthenticated, setIsBatteryTechnicianAuthenticated] = useState(
    () => Boolean(batteryTechnicianApi.getBatteryTechnicianToken())
  );

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /* =======================================================
     AUTH
  ======================================================= */

  const batteryTechnicianLogin = useCallback(async (credentials = {}) => {
    const data = await batteryTechnicianApi.batteryTechnicianSignIn(credentials);
    batteryTechnicianApi.setBatteryTechnicianToken(data.token);
    batteryTechnicianApi.setBatteryTechnicianProfile(data.user);
    setBatteryTechnicianUser(data.user || null);
    setIsBatteryTechnicianAuthenticated(true);
    return data.user;
  }, []);

  const batteryTechnicianLogout = useCallback(async () => {
    setIsBatteryTechnicianAuthenticated(false);
    setBatteryTechnicianUser(null);
    batteryTechnicianApi.setBatteryTechnicianToken(null);
    batteryTechnicianApi.setBatteryTechnicianProfile(null);
    try {
      await batteryTechnicianApi.batteryTechnicianLogoutApi();
    } catch {
      // Best-effort — JWT is stateless
    }
    setServices([]);
  }, []);

  // On mount, verify the stored token against the backend.
  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      if (!batteryTechnicianApi.getBatteryTechnicianToken()) return;
      setVerifying(true);
      try {
        const data = await batteryTechnicianApi.fetchBatteryTechnicianMe();
        if (!cancelled) {
          setBatteryTechnicianUser(data.user);
          setIsBatteryTechnicianAuthenticated(true);
          batteryTechnicianApi.setBatteryTechnicianProfile(data.user);
        }
      } catch (error) {
        if (!cancelled && isAuthError(error)) {
          batteryTechnicianApi.setBatteryTechnicianToken(null);
          batteryTechnicianApi.setBatteryTechnicianProfile(null);
          setIsBatteryTechnicianAuthenticated(false);
          setBatteryTechnicianUser(null);
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    verifySession();
    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     DATA LOADING
  ======================================================= */

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const svcs = await batteryTechnicianApi.fetchAssignedServices();
      setServices(svcs || []);
    } catch (error) {
      if (isAuthError(error)) {
        batteryTechnicianApi.setBatteryTechnicianToken(null);
        setIsBatteryTechnicianAuthenticated(false);
        setBatteryTechnicianUser(null);
        batteryTechnicianApi.setBatteryTechnicianProfile(null);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isBatteryTechnicianAuthenticated && batteryTechnicianApi.getBatteryTechnicianToken()) {
      loadServices().catch(() => {});
    }
  }, [isBatteryTechnicianAuthenticated, loadServices]);

  /* =======================================================
     SERVICE ACTIONS
  ======================================================= */

  const updateServiceStatus = useCallback(async (serviceId, status) => {
    const updated = await batteryTechnicianApi.updateBatteryTechnicianStatus(serviceId, status);
    setServices((previous) =>
      previous.map((s) => (s.id === serviceId ? { ...s, ...updated } : s))
    );
    return updated;
  }, []);

  const refreshServices = useCallback(async () => {
    const svcs = await batteryTechnicianApi.fetchAssignedServices();
    setServices(svcs || []);
  }, []);

  /* =======================================================
     COMPUTED STATS
  ======================================================= */

  const stats = useMemo(() => {
    const total = services.length;
    const pending = services.filter((s) => s.status === "Assigned").length;
    const accepted = services.filter((s) => s.status === "Accepted").length;
    const onTheWay = services.filter((s) => s.status === "On The Way").length;
    const inProgress = services.filter((s) => s.status === "In Progress").length;
    const waitingApproval = services.filter((s) => s.status === "Waiting for Admin Approval").length;
    const completed = services.filter((s) => s.status === "Completed").length;
    const cancelled = services.filter((s) => s.status === "Cancelled").length;
    return { total, pending, accepted, onTheWay, inProgress, waitingApproval, completed, cancelled };
  }, [services]);

  /* =======================================================
     CONTEXT VALUE
  ======================================================= */

  const contextValue = useMemo(
    () => ({
      batteryTechnicianUser,
      isBatteryTechnicianAuthenticated,
      verifying,
      loading,
      services,
      stats,
      isSidebarOpen,
      setIsSidebarOpen,
      batteryTechnicianLogin,
      batteryTechnicianLogout,
      loadServices,
      refreshServices,
      updateServiceStatus,
    }),
    [
      batteryTechnicianUser,
      isBatteryTechnicianAuthenticated,
      verifying,
      loading,
      services,
      stats,
      isSidebarOpen,
      setIsSidebarOpen,
      batteryTechnicianLogin,
      batteryTechnicianLogout,
      loadServices,
      refreshServices,
      updateServiceStatus,
    ]
  );

  return (
    <BatteryTechnicianContext.Provider value={contextValue}>
      {children}
    </BatteryTechnicianContext.Provider>
  );
};

export const useBatteryTechnician = () => {
  const context = useContext(BatteryTechnicianContext);
  if (!context) {
    throw new Error("useBatteryTechnician must be used inside BatteryTechnicianProvider");
  }
  return context;
};

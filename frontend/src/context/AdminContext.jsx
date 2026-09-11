import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as adminApi from "../services/adminApi";

const AdminContext = createContext(null);

const ADMIN_PROFILE_KEY = "maxspace_admin_profile";

const loadAdminProfileFromStorage = () => {
  try {
    const saved = localStorage.getItem(ADMIN_PROFILE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveAdminProfileToStorage = (profile) => {
  try {
    localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors
  }
};

const clearAdminProfileFromStorage = () => {
  try {
    localStorage.removeItem(ADMIN_PROFILE_KEY);
  } catch {
    // Ignore storage errors
  }
};

const isAuthError = (error) => /401|403|not authorized|no token|token|denied/i.test(error?.message || "");

export const AdminProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(() =>
    adminApi.getAdminToken() ? loadAdminProfileFromStorage() : null
  );
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() =>
    Boolean(adminApi.getAdminToken())
  );

  const [services, setServices] = useState([]);
  const [servicePersons, setServicePersons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const adminLogin = useCallback(async (credentials = {}) => {
    const data = await adminApi.adminSignIn(credentials);
    adminApi.setAdminToken(data.token);
    setAdminUser(data.user || null);
    setIsAdminAuthenticated(true);
    saveAdminProfileToStorage(data.user);
    return data.user;
  }, []);

  const adminLogout = useCallback(async () => {
    setIsAdminAuthenticated(false);
    setAdminUser(null);
    clearAdminProfileFromStorage();
    try {
      await adminApi.adminLogout();
    } catch {
      // Best-effort — JWT is stateless
    }
    setServices([]);
    setServicePersons([]);
    setCustomers([]);
    setAnalytics(null);
  }, []);

  // On mount, verify the stored admin token against the backend.
  useEffect(() => {
    let cancelled = false;

    const verifyAdminSession = async () => {
      if (!adminApi.getAdminToken()) return;
      setVerifying(true);
      try {
        const data = await adminApi.fetchAdminMe();
        if (!cancelled) {
          setAdminUser(data.user);
          setIsAdminAuthenticated(true);
          saveAdminProfileToStorage(data.user);
        }
      } catch (error) {
        if (!cancelled && isAuthError(error)) {
          adminApi.setAdminToken(null);
          clearAdminProfileFromStorage();
          setIsAdminAuthenticated(false);
          setAdminUser(null);
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    verifyAdminSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [svcs, sps, custs, ana] = await Promise.all([
        adminApi.fetchAdminServices(),
        adminApi.fetchAdminServicePersons(),
        adminApi.fetchAdminCustomers(),
        adminApi.fetchAdminAnalytics(),
      ]);
      setServices(svcs || []);
      setServicePersons(sps || []);
      setCustomers(custs || []);
      setAnalytics(ana || null);
    } catch (error) {
      if (isAuthError(error)) {
        adminApi.setAdminToken(null);
        setIsAdminAuthenticated(false);
        setAdminUser(null);
        clearAdminProfileFromStorage();
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated && adminApi.getAdminToken()) {
      loadAdminData().catch(() => {});
    }
  }, [isAdminAuthenticated, loadAdminData]);

  /* ============================================================
     SERVICE ACTIONS
  ============================================================ */

  const acceptService = useCallback(async (serviceId) => {
    const updated = await adminApi.acceptAdminService(serviceId);
    setServices((previous) =>
      previous.map((s) => (s.id === serviceId ? { ...s, ...updated } : s))
    );
    return updated;
  }, []);

  const assignServicePerson = useCallback(async (serviceId, servicePersonId) => {
    const updated = await adminApi.assignAdminService(serviceId, servicePersonId);
    setServices((previous) =>
      previous.map((s) => (s.id === serviceId ? { ...s, ...updated } : s))
    );
    setServicePersons((previous) =>
      previous.map((sp) =>
        sp.id === servicePersonId
          ? {
              ...sp,
              assignedServices: [...(sp.assignedServices || []), serviceId],
              assignedServiceCount: (sp.assignedServiceCount || 0) + 1,
            }
          : sp
      )
    );
    return updated;
  }, []);

  const updateServiceStatus = useCallback(async (serviceId, status) => {
    const updated = await adminApi.updateAdminServiceStatus(serviceId, status);
    setServices((previous) =>
      previous.map((s) => (s.id === serviceId ? { ...s, ...updated } : s))
    );
    return updated;
  }, []);

  const approveServiceCompletion = useCallback(async (serviceId) => {
    const updated = await adminApi.approveAdminService(serviceId);
    setServices((previous) =>
      previous.map((s) => (s.id === serviceId ? { ...s, ...updated } : s))
    );
    return updated;
  }, []);

  /* ============================================================
     BATTERY TECHNICIAN ACTIONS
  ============================================================ */

  const createServicePerson = useCallback(async (person) => {
    const created = await adminApi.createAdminServicePerson(person);
    setServicePersons((previous) => [created, ...previous]);
    return created;
  }, []);

  const createTechnician = useCallback(async (data) => {
    const created = await adminApi.createAdminTechnician(data);
    if (created?.servicePerson) {
      setServicePersons((previous) => [created.servicePerson, ...previous]);
    }
    return created;
  }, []);

  const updateServicePerson = useCallback(async (id, fields) => {
    const updated = await adminApi.updateAdminServicePerson(id, fields);
    setServicePersons((previous) =>
      previous.map((sp) => (sp.id === id ? { ...sp, ...updated } : sp))
    );
    return updated;
  }, []);

  const toggleServicePersonStatus = useCallback(
    async (id) => {
      const person = servicePersons.find((sp) => sp.id === id);
      if (!person) return null;
      const nextStatus = person.status === "active" ? "inactive" : "active";
      return updateServicePerson(id, { status: nextStatus });
    },
    [servicePersons, updateServicePerson]
  );

  const refreshTechnicians = useCallback(async () => {
    const techs = await adminApi.fetchAdminTechnicians();
    setServicePersons(techs || []);
  }, []);

  const fetchTechnician = useCallback(async (id) => {
    return adminApi.fetchAdminTechnician(id);
  }, []);

  const updateTechnician = useCallback(async (id, fields) => {
    const updated = await adminApi.updateAdminTechnician(id, fields);
    setServicePersons((previous) =>
      previous.map((sp) => (sp.id === id ? { ...sp, ...updated } : sp))
    );
    return updated;
  }, []);

  const toggleTechnicianStatus = useCallback(
    async (id) => {
      const person = servicePersons.find((sp) => sp.id === id);
      if (!person) return null;
      const nextStatus = person.status === "active" ? "inactive" : "active";
      return updateTechnician(id, { status: nextStatus });
    },
    [servicePersons, updateTechnician]
  );

  const resetTechnicianPassword = useCallback(async (id, data) => {
    return adminApi.resetAdminTechnicianPassword(id, data);
  }, []);

  const refreshServices = useCallback(async () => {
    const svcs = await adminApi.fetchAdminServices();
    setServices(svcs || []);
  }, []);

  const refreshAnalytics = useCallback(async () => {
    const ana = await adminApi.fetchAdminAnalytics();
    setAnalytics(ana);
  }, []);

  const contextValue = useMemo(
    () => ({
      adminUser,
      isAdminAuthenticated,
      verifying,
      loading,
      services,
      servicePersons,
      customers,
      analytics,
      isSidebarOpen,
      setIsSidebarOpen,
      adminLogin,
      adminLogout,
      loadAdminData,
      refreshServices,
      refreshAnalytics,
      acceptService,
      assignServicePerson,
      updateServiceStatus,
      approveServiceCompletion,
      createServicePerson,
      createTechnician,
      updateServicePerson,
      toggleServicePersonStatus,
      refreshTechnicians,
      fetchTechnician,
      updateTechnician,
      toggleTechnicianStatus,
      resetTechnicianPassword,
    }),
    [
      adminUser,
      isAdminAuthenticated,
      verifying,
      loading,
      services,
      servicePersons,
      customers,
      analytics,
      isSidebarOpen,
      setIsSidebarOpen,
      adminLogin,
      adminLogout,
      loadAdminData,
      refreshServices,
      refreshAnalytics,
      acceptService,
      assignServicePerson,
      updateServiceStatus,
      approveServiceCompletion,
      createServicePerson,
      createTechnician,
      updateServicePerson,
      toggleServicePersonStatus,
      refreshTechnicians,
      fetchTechnician,
      updateTechnician,
      toggleTechnicianStatus,
      resetTechnicianPassword,
    ]
  );

  return <AdminContext.Provider value={contextValue}>{children}</AdminContext.Provider>;
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used inside AdminProvider");
  }
  return context;
};
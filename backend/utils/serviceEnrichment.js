/* ============================================================
   SERVICE ENRICHMENT HELPERS
   Used by the admin and battery-technician list endpoints to
   attach battery / customer / technician summaries to service
   records. These rely on BATCH lookups (get*ByIds) instead of
   per-record queries to keep list endpoints O(1) queries rather
   than N+1.
============================================================ */

export const enrichServiceSummaries = async (store, services) => {
  if (!services.length) return [];

  const batteryIds = [...new Set(services.map((s) => s.batteryId).filter(Boolean))];
  const customerIds = [...new Set(services.map((s) => s.customerId).filter(Boolean))];
  const techIds = [
    ...new Set(services.map((s) => s.assignedServicePersonId).filter(Boolean)),
  ];

  const [batteries, users, servicePersons] = await Promise.all([
    store.getBatteriesByIds(batteryIds),
    store.getUsersByIds(customerIds),
    store.getServicePersonsByIds(techIds),
  ]);

  const batteryMap = new Map(batteries.map((b) => [b.id, b]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const personMap = new Map(servicePersons.map((p) => [p.id, p]));

  // Customer phone/location live on their own profile; batch-load them once.
  const customerProfiles = {};
  const profileIds = users.filter((u) => u.role === "USER").map((u) => u.id);
  if (profileIds.length) {
    const profiles = await store.getProfilesByIds(profileIds);
    for (const p of profiles) customerProfiles[p.userId || p.id] = p;
  }

  const batterySummary = (b) =>
    b
      ? {
          id: b.id,
          name: b.name,
          modelName: b.modelName,
          chemistry: b.chemistry,
          type: b.type,
          serialNumber: b.serialNumber,
          barcode: b.barcode,
          manufacturer: b.manufacturer,
          location: b.location,
          warranty: b.warranty || null,
        }
      : null;

  const customerSummary = (c) => {
    if (!c) return null;
    const profile = customerProfiles[c.id];
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone || (profile && profile.phone) || "",
      location: c.location || (profile && profile.location) || "",
    };
  };

  const techSummary = (p) =>
    p
      ? {
          id: p.id,
          technicianId: p.technicianId,
          name: p.name,
          phone: p.phone || "",
          email: p.email,
          certification: p.certification,
          specialization: p.specialization,
        }
      : null;

  // Fallback: an assigned technician may be recorded by id in the service
  // assignedServices JSON list rather than via assignedServicePersonId.
  const resolveTech = (s) => {
    let person = s.assignedServicePersonId
      ? personMap.get(s.assignedServicePersonId)
      : null;
    if (!person) {
      person = [...personMap.values()].find((p) =>
        (p.assignedServices || []).includes(s.id)
      );
    }
    return person;
  };

  return services.map((s) => ({
    ...s,
    battery: batterySummary(batteryMap.get(s.batteryId)),
    customer: customerSummary(userMap.get(s.customerId)),
    technician: techSummary(resolveTech(s)),
  }));
};

/* Small detail-level enrichment used by single-service endpoints. */
export const enrichServiceDetail = async (store, service) => {
  const [battery, users, schedule] = await Promise.all([
    service.batteryId ? store.getBatteryById(service.batteryId) : Promise.resolve(null),
    store.getCustomers(),
    // The schedule lookup may resolve to null (no row exists) and some stores
    // implement it synchronously (mock) while others are async (postgres).
    // Promise.resolve normalizes both so .catch never fails on null/undefined.
    service.id
      ? Promise.resolve(store.getServiceSchedule(service.id)).catch(() => null)
      : Promise.resolve(null),
  ]);
  const customer = users.find((u) => u.id === service.customerId);
  const batterySummary = battery
    ? {
        id: battery.id,
        modelName: battery.modelName,
        chemistry: battery.chemistry,
        type: battery.type,
        serialNumber: battery.serialNumber,
        barcode: battery.barcode,
        capacityKwh: battery.capacityKwh,
        stateOfHealth: battery.stateOfHealth,
        location: battery.location,
        manufacturer: battery.manufacturer,
      }
    : null;
  return {
    ...service,
    battery: batterySummary,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "",
          location: customer.location || "",
        }
      : null,
    schedule: schedule || null,
  };
};
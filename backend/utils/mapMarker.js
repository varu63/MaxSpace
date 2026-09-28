/* ============================================================
   MAP MARKER BUILDER
   Shared by the mock and postgres stores so a marker looks identical
   regardless of DATA_SOURCE. Takes a mapped battery object (both
   stores already map rows into the same camelCase shape via
   mapBatteryRow / the in-memory battery objects) plus the linked
   location, compliance record, producer name, services and owner.

   The marker payload is deliberately the *authorized* view: the
   caller decides whether an owner is included. Nothing about a
   battery's presence is invented — a battery with no location row is
   simply never built into a marker.
============================================================ */
import {
  deriveHealthStatus,
  deriveLifecycle,
  complianceToBucket,
  deriveServiceBucket,
} from "../constants/mapConfig.js";

const latestServiceOf = (services = []) =>
  services.reduce(
    (latest, s) =>
      !latest ||
      new Date(s.createdAt || 0).getTime() > new Date(latest.createdAt || 0).getTime()
        ? s
        : latest,
    null
  );

export const buildMapMarker = ({
  battery,
  location,
  compliance = null,
  producerName = null,
  services = [],
  owner = null,
}) => {
  const soh =
    battery.stateOfHealth === null || battery.stateOfHealth === undefined
      ? null
      : Number(battery.stateOfHealth);

  const service = latestServiceOf(services);
  const lastUpdated =
    location?.updatedAt || battery.createdAt || battery.createdAt || null;

  return {
    batteryId: battery.id,
    name: battery.name,
    model: battery.modelName || battery.model || null,
    manufacturer: battery.manufacturer || null,
    type: battery.type || null,
    barcode: battery.barcode || null,
    serialNumber: battery.serialNumber || null,
    overallStatus: battery.overallStatus || null,
    hangStatus: Boolean(battery.hangStatus),
    lifecycle: deriveLifecycle(battery.overallStatus, battery.hangStatus),
    stateOfHealth: soh,
    health: deriveHealthStatus(soh),
    compliance: {
      status: compliance?.complianceStatus || null,
      verifiedInApp: Boolean(compliance?.verifiedInApp),
      producerName: producerName || null,
      bucket: complianceToBucket(compliance?.complianceStatus),
    },
    service: service
      ? {
          id: service.id,
          status: service.status,
          bucket: deriveServiceBucket(service.status),
        }
      : null,
    location: {
      siteName: location?.siteName || null,
      locationType: location?.locationType || null,
      address: location?.address || null,
      city: location?.city || null,
      state: location?.state || null,
      country: location?.country || null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      updatedAt: location?.updatedAt || null,
    },
    owner,
    updatedAt: lastUpdated,
  };
};
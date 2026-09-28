/* ============================================================
   SEED DEV COMPLIANCE MAP DATA (DEVELOPMENT / TEST ONLY)
   ------------------------------------------------------------
   Populates the existing MaxSpace PostgreSQL schema with realistic
   TEMPORARY development records so the Global Battery & Compliance
   Map can be tested end-to-end.

   USES ONLY EXISTING TABLES (no new tables):
     • compliance_producers   → organization/facility records
     • battery_locations      → where each battery physically sits
     • battery_compliance     → per-battery compliance state
     • compliance_events      → append-only audit trail for the records
     • services               → one active (defect-hold) service

   DOES NOT create new batteries, users, technicians, or tables.
   Target batteries are the REAL production fleet units already in
   `batteries` (keyed by `battery_id` on maxvolt_prod). Every insert
   below is additive and idempotent (ON CONFLICT … DO UPDATE).

   Run with (from the backend directory):
     node scripts/seedDevComplianceMap.js
   Remove the data any time with:
     node scripts/seedDevComplianceMap.js --undo
   ============================================================ */
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (checked backend/.env).");
  process.exit(1);
}

const isUndo = process.argv.includes("--undo");
const pool = new pg.Pool({ connectionString: url });

const DEV_NOTE = "DEVELOPMENT/TEST record — Compliance Map testing. Safe to delete.";

/* ---------- Organization / facility records (existing table) ---------- */
/* producer_id values 101-104 are explicitly reserved for this dev set.
   id 1 (Maxvolt Reearth, Mumbai Recycler) already exists — reused, not
   modified; the EOL battery at Mumbai references it. */
const PRODUCERS = [
  {
    id: 101,
    producer_name: "MaxVolt Energy Pvt Ltd",
    producer_category: "Manufacturer",
    registration_number: "CPCB/BAT/2024/2101",
    address: "Plot 14, Okhla Industrial Estate Phase II, New Delhi, Delhi 110020",
    contact_email: "compliance@maxvolt-energy.in",
    contact_phone: "+91 11 4050 2101",
    website: "https://maxvolt-energy.example",
    notes: `Manufacturer plant (Delhi NCR). ${DEV_NOTE}`,
  },
  {
    id: 102,
    producer_name: "MaxSpace Service Centre Pvt Ltd",
    producer_category: "Refurbisher",
    registration_number: "CPCB/BAT/2024/2102",
    address: "Plot 5, Sector 62, Noida, Uttar Pradesh 201301",
    contact_email: "service@maxspace-centre.in",
    contact_phone: "+91 120 2102 102",
    website: "https://maxspace-service.example",
    notes: `Service / refurbishment network (Noida HQ). ${DEV_NOTE}`,
  },
  {
    id: 103,
    producer_name: "MaxVolt Retail Distribution Ltd",
    producer_category: "Importer",
    registration_number: "CPCB/BAT/2024/2103",
    address: "Udyog Vihar Phase IV, Gurugram, Haryana 122016",
    contact_email: "distribution@maxvolt-retail.in",
    contact_phone: "+91 124 2103 103",
    website: "https://maxvolt-retail.example",
    notes: `Battery reseller / distribution warehouse (Gurugram). ${DEV_NOTE}`,
  },
  {
    id: 104,
    producer_name: "SafeDrop Collection Centre",
    producer_category: "Recycler",
    registration_number: "CPCB/BAT/2024/2104",
    address: "MIDC Phase 1, Hinjewadi, Pune, Maharashtra 411057",
    contact_email: "collect@safedrop.example",
    contact_phone: "+91 20 2104 104",
    website: "https://safedrop-collect.example",
    notes: `Collection centre / EPR collection network (Pune). ${DEV_NOTE}`,
  },
];

/* ---------- Battery locations: real fleet units, Indian cities ---------- */
const LOCATIONS = [
  { battery_id: "MVAE0014037", lat: 28.5355, lng: 77.279, address: "Plot 14, Okhla Industrial Estate Phase II", city: "Delhi", state: "Delhi", site_name: "MaxVolt Manufacturing Plant, Okhla", location_type: "Manufacturing Plant" },
  { battery_id: "MVAE0014039", lat: 28.6135, lng: 77.3714, address: "Plot 5, Sector 62", city: "Noida", state: "Uttar Pradesh", site_name: "MaxSpace Service Centre, Sector 62", location_type: "Service Center" },
  { battery_id: "MVBE0000865", lat: 28.621, lng: 77.374, address: "Sector 63", city: "Noida", state: "Uttar Pradesh", site_name: "MaxSpace Defect Hold Bay, Sector 63", location_type: "Service Center" },
  { battery_id: "MVAE0014042", lat: 28.5074, lng: 77.0927, address: "Udyog Vihar Phase IV", city: "Gurugram", state: "Haryana", site_name: "MaxVolt Retail Distribution Warehouse, Udyog Vihar", location_type: "Warehouse" },
  { battery_id: "MVBE0000136", lat: 18.5813, lng: 73.7385, address: "MIDC Phase 1, Hinjewadi", city: "Pune", state: "Maharashtra", site_name: "SafeDrop Collection Centre, Hinjewadi", location_type: "End of Life Facility" },
  { battery_id: "MVAE0014036", lat: 12.9698, lng: 77.75, address: "Whitefield Main Road", city: "Bengaluru", state: "Karnataka", site_name: "MaxSpace Service Centre, Whitefield", location_type: "Service Center" },
  { battery_id: "MVAE0014040", lat: 19.109, lng: 72.9256, address: "LBS Marg, Vikhroli West", city: "Mumbai", state: "Maharashtra", site_name: "Maxvolt Reearth Recycling, Vikhroli", location_type: "Recycler" },
  { battery_id: "MVAE0014041", lat: 18.5935, lng: 73.7399, address: "MIDC Phase 1, Hinjewadi", city: "Pune", state: "Maharashtra", site_name: "SafeDrop Collection Centre, Hinjewadi", location_type: "End of Life Facility" },
];

/* ---------- Compliance states (existing battery_compliance table) ----------
   Covers every map legend tone + filter value:
     Compliant / Pending / In Progress (Under Review) / Non-Compliant /
     Exempt (Not Applicable)  —  plus one intentionally UNTRACKED battery
     (no row at all → neutral "Not Tracked"). */
const COMPLIANCES = [
  { battery_id: "MVAE0014037", producer_id: 101, status: "Compliant", verified: true, channel: "Return to Producer", category: "Large", note: "Verified annual compliance filing (Delhi plant)." },
  { battery_id: "MVAE0014039", producer_id: 102, status: "Pending", verified: false, channel: "Dealer / Retailer", category: "Large", note: "Filing under review at Noida service centre." },
  { battery_id: "MVBE0000865", producer_id: 102, status: "Pending", verified: false, channel: "Return to Producer", category: "Large", note: "Defect-hold unit awaiting repair + re-certification." },
  { battery_id: "MVAE0014042", producer_id: 103, status: "Compliant", verified: true, channel: "Dealer / Retailer", category: "Large", note: "Verified via reseller distribution records (Gurugram)." },
  { battery_id: "MVBE0000136", producer_id: 104, status: "In Progress", verified: false, channel: "Registered Recycler", category: "Large", note: "Collection scheduled; recycler assessment underway." },
  { battery_id: "MVAE0014036", producer_id: 102, status: "Non-Compliant", verified: false, channel: "Other", category: "Large", note: "Recycle-consumer evidence missing (Bengaluru service centre)." },
  { battery_id: "MVAE0014041", producer_id: 104, status: "Exempt", verified: false, channel: "Other", category: "Large", note: "Exempt unit — no recovery obligation." },
];

/* ---------- Append-only audit events for the records above ----------
   Ids 5001-5009 are reserved for this dev set. Mirrors the vocabulary
   produced by backend/utils/complianceValidation.js (describeEvent). */
const EVENT_FROM = "user-1789798606613"; /* admin account */
const EVENTS = [
  ...COMPLIANCES.map((c, i) => ({
    id: 5001 + i,
    battery_id: c.battery_id,
    producer_id: c.producer_id,
    event_type: "battery_linked",
    event_description: `Battery linked to a producer — ${c.battery_id}`,
  })),
  {
    id: 5008,
    battery_id: "MVAE0014037",
    producer_id: 101,
    event_type: "verified",
    event_description: "Compliance record verified in MaxSpace — MVAE0014037",
  },
  {
    id: 5009,
    battery_id: "MVAE0014042",
    producer_id: 103,
    event_type: "verified",
    event_description: "Compliance record verified in MaxSpace — MVAE0014042",
  },
];

/* ---------- Active service for the defect-hold battery ---------- */
const SERVICE = {
  id: "srv-dev-compl-0001",
  ticket_number: "SRV-2026-9804",
  battery_id: "MVBE0000865",
  battery_name: "12.8V 100AH Solar lithium battery- REDON",
  service_type: "Defect Hold Repair",
  center: "MaxSpace Service Centre, Sector 62, Noida",
  scheduled_date: "2026-10-02",
  scheduled_time: "10:00",
  status: "Assigned",
  priority: "Urgent",
  technician: "alex",
  customer_id: "user-1789799302203",
  assigned_service_person_id: "sp-1790243875221",
  notes: "Development/test service for the defect-hold battery on the Compliance Map.",
};

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (isUndo) {
      await client.query("DELETE FROM battery_locations WHERE battery_id = ANY($1::text[])", [
        LOCATIONS.map((l) => l.battery_id),
      ]);
      await client.query("DELETE FROM battery_compliance WHERE battery_id = ANY($1::text[])", [
        COMPLIANCES.map((c) => c.battery_id),
      ]);
      await client.query("DELETE FROM compliance_producers WHERE id = ANY($1::int[])", [
        PRODUCERS.map((p) => p.id),
      ]);
      await client.query("DELETE FROM compliance_events WHERE id = ANY($1::int[])", [
        EVENTS.map((e) => e.id),
      ]);
      await client.query("DELETE FROM services WHERE id = $1", [SERVICE.id]);
      await client.query("COMMIT");
      console.log("UNDO complete — dev compliance map data removed.");
      return;
    }

    /* 1) Organizations / facilities */
    for (const p of PRODUCERS) {
      await client.query(
        `INSERT INTO compliance_producers
           (id, producer_name, producer_category, registration_number, registration_valid_until,
            pan, gstin, address, contact_email, contact_phone, website, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Active',$12)
         ON CONFLICT (registration_number) DO UPDATE SET
           producer_name = EXCLUDED.producer_name,
           producer_category = EXCLUDED.producer_category,
           address = EXCLUDED.address,
           contact_email = EXCLUDED.contact_email,
           contact_phone = EXCLUDED.contact_phone,
           website = EXCLUDED.website,
           notes = EXCLUDED.notes,
           updated_at = now()`,
        [p.id, p.producer_name, p.producer_category, p.registration_number, "2027-03-31",
         "AAMCV2101P", "07AAMCV2101P1Z8", p.address, p.contact_email, p.contact_phone, p.website, p.notes]
      );
    }

    /* 2) Locations per real battery */
    for (const l of LOCATIONS) {
      await client.query(
        `INSERT INTO battery_locations
           (battery_id, latitude, longitude, address, city, state, country, site_name, location_type, is_current)
         VALUES ($1,$2,$3,$4,$5,$6,'India',$7,$8,true)
         ON CONFLICT (battery_id) DO UPDATE SET
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           address = EXCLUDED.address,
           city = EXCLUDED.city,
           state = EXCLUDED.state,
           country = EXCLUDED.country,
           site_name = EXCLUDED.site_name,
           location_type = EXCLUDED.location_type,
           is_current = true,
           updated_at = now()`,
        [l.battery_id, l.lat, l.lng, l.address, l.city, l.state, l.site_name, l.location_type]
      );
    }

    /* 3) Compliance states */
    for (const c of COMPLIANCES) {
      await client.query(
        `INSERT INTO battery_compliance
           (battery_id, producer_id, framework, battery_category, collection_channel,
            compliance_status, verified_in_app, verified_at, notes,
            collection_status, collection_location, recycler_name, recycler_registration,
            recycling_status, epr_reference)
         VALUES ($1,$2,'BWMR 2022',$3,$4,$5,$6,
                 CASE WHEN $6 THEN now() ELSE NULL END, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (battery_id) DO UPDATE SET
           producer_id = EXCLUDED.producer_id,
           battery_category = EXCLUDED.battery_category,
           collection_channel = EXCLUDED.collection_channel,
           compliance_status = EXCLUDED.compliance_status,
           verified_in_app = EXCLUDED.verified_in_app,
           verified_at = CASE WHEN EXCLUDED.verified_in_app THEN COALESCE(battery_compliance.verified_at, now()) ELSE NULL END,
           notes = EXCLUDED.notes,
           updated_at = now()`,
        [
          c.battery_id, c.producer_id, c.category, c.channel, c.status, c.verified,
          `${c.note} ${DEV_NOTE}`,
          ...eolFields(c.battery_id),
        ]
      );
    }

    /* 4) One active service on the defect-hold battery */
    await client.query(
      `INSERT INTO services
         (id, ticket_number, battery_id, battery_name, service_type, center,
          scheduled_date, scheduled_time, status, priority, technician,
          customer_id, assigned_service_person_id, notes, history)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'[]')
       ON CONFLICT (id) DO NOTHING`,
      [SERVICE.id, SERVICE.ticket_number, SERVICE.battery_id, SERVICE.battery_name,
       SERVICE.service_type, SERVICE.center, SERVICE.scheduled_date, SERVICE.scheduled_time,
       SERVICE.status, SERVICE.priority, SERVICE.technician, SERVICE.customer_id,
       SERVICE.assigned_service_person_id, SERVICE.notes]
    );

    /* 5) Append-only audit events (mirrors the controller's event log) */
    for (const ev of EVENTS) {
      await client.query(
        `INSERT INTO compliance_events (id, battery_id, producer_id, event_type, event_description, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [ev.id, ev.battery_id, ev.producer_id, ev.event_type, ev.event_description, EVENT_FROM]
      );
    }
    await client.query(
      `SELECT setval('compliance_events_id_seq',
         GREATEST((SELECT COALESCE(MAX(id), 0) FROM compliance_events),
                  (SELECT last_value FROM compliance_events_id_seq)), true)`
    );

    await client.query("COMMIT");
    console.log("SEED complete — dev compliance map data inserted.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("SEED failed:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

/* End-of-life detail only where realistic for the dev set. */
const eolFields = (batteryId) => {
  switch (batteryId) {
    case "MVBE0000136":
      return ["Scheduled", "SafeDrop Collection Centre, Hinjewadi, Pune",
        "SafeDrop Collection Centre", "CPCB/BAT/2024/2104", "Under Assessment", "BWMR/EPR/2026/PUNE-1182"];
    case "MVBE0000865":
      return ["Pending", null, null, null, null, null];
    case "MVAE0014036":
      return ["Not Required", null, null, null, null, null];
    case "MVAE0014041":
      return ["Not Required", null, null, null, null, null];
    default:
      return [null, null, null, null, null, null];
  }
};

run();
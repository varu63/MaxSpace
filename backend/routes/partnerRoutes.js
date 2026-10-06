import express from "express";
import {
  listMyAssignments,
  getAssignmentBattery,
  getPartnerBatteryPassport,
  recordPartnerAction,
  recordPartnerSecondLife,
} from "../controllers/partnerController.js";
import { protect, requirePartner } from "../middleware/auth.js";

const router = express.Router();

/* Every route here is behind BOTH guards: `protect` establishes who the
   caller is, `requirePartner` establishes that they are an external EPR
   partner. The per-battery assignment check happens inside the
   controller — a partner may still only reach batteries it was assigned. */

router.get("/assignments", protect, requirePartner, listMyAssignments);
router.get("/assignments/:id/battery", protect, requirePartner, getAssignmentBattery);

router.get("/batteries/:id", protect, requirePartner, getPartnerBatteryPassport);
router.post("/batteries/:id/eol-action", protect, requirePartner, recordPartnerAction);
router.post("/batteries/:id/second-life", protect, requirePartner, recordPartnerSecondLife);

export default router;
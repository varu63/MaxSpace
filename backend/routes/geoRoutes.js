import express from "express";
import rateLimit from "express-rate-limit";
import { searchLocations, reverseLookup } from "../controllers/geoController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/* Rate limit the proxy that fans out to Nominatim. The frontend debounces
   typing (350 ms) so a person generates a handful of requests per minute;
   60 per 5 minutes per IP is comfortable for real users while stopping
   one client from burning the shared upstream budget. Upstream calls are
   additionally serialised to 1 req/s inside utils/nominatim.js. */
const geocodeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many location lookups from this device. Please wait a moment and try again.",
  },
});

// Booking flows are authenticated, so only signed-in users may use the
// proxy — this is not a public geocoding API.
router.use(protect);
router.use(geocodeLimiter);

router.get("/search", searchLocations);
router.get("/reverse", reverseLookup);

export default router;

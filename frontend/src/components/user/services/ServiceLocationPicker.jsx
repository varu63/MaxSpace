import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Crosshair, Loader2, MapPin, Navigation } from "lucide-react";
import { searchLocations, reverseLookup } from "../../../services/geoApi";
import {
  EMPTY_SERVICE_LOCATION,
  locationHasCoordinates,
} from "../../../data/serviceLocation";

const STATUS_MESSAGES = {
  "search-error":
    "Address search is unavailable right now — you can still type your address manually.",
  locating: "Getting your current location…",
  "gps-denied": "Location permission denied — type your address below instead.",
  "gps-error": "Couldn't get your location — type your address below instead.",
  "gps-unsupported": "This browser can't share your location — type your address instead.",
  "gps-no-address": "No address found for your position — type your address instead.",
  "gps-lookup-error": "Couldn't read an address for your position — type it manually.",
};

const suggestionPrimary = (s) =>
  [s.house, s.area].filter(Boolean).join(", ") || s.address || s.label || "";

const suggestionSecondary = (s) =>
  [s.city, s.state, s.pincode].filter(Boolean).join(", ");

/* ============================================================
   SERVICE LOCATION PICKER
   The booking form's required "Service Location" field:

     - type an address manually (always available, even offline),
     - get OpenStreetMap/Nominatim suggestions while typing
       (debounced, via the backend proxy — no paid API, no key),
     - tap a suggestion to store the complete structured location,
     - or use browser geolocation + reverse geocoding as a shortcut.

   Mobile-first: 48px inputs, ≥52px tap targets, scrollable
   suggestion panel, no hover-only affordances. GPS/search failures
   degrade to manual typing instead of blocking the booking.
   ============================================================ */
const ServiceLocationPicker = ({
  id = "serviceAddress",
  value,
  onChange,
}) => {
  const location = value || EMPTY_SERVICE_LOCATION;
  const [query, setQuery] = useState(location.address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [activeIndex, setActiveIndex] = useState(-1);

  const requestSeqRef = useRef(0);
  const selectedAddressRef = useRef(location.address || "");
  const blurTimerRef = useRef(null);

  /* Debounced autocomplete while typing. All state writes happen inside
     the scheduled task (never synchronously in the effect body), and
     stale responses are dropped via the sequence counter. */
  useEffect(() => {
    const trimmed = query.trim();
    const seq = ++requestSeqRef.current;
    const suppressed =
      trimmed.length < 3 || trimmed === selectedAddressRef.current;

    const timer = setTimeout(async () => {
      if (seq !== requestSeqRef.current) return;
      if (suppressed) {
        setSuggestions([]);
        setActiveIndex(-1);
        setOpen(false);
        setPhase("idle");
        return;
      }
      setPhase("searching");
      try {
        const res = await searchLocations(trimmed);
        if (seq !== requestSeqRef.current) return;
        setSuggestions(Array.isArray(res?.data) ? res.data : []);
        setActiveIndex(-1);
        setOpen(true);
        setPhase("idle");
      } catch {
        if (seq !== requestSeqRef.current) return;
        setSuggestions([]);
        setActiveIndex(-1);
        setPhase("search-error");
      }
    }, suppressed ? 0 : 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      requestSeqRef.current += 1; // cancel in-flight searches on unmount
    },
    []
  );

  /* Typing replaces any previously selected location: stale coordinates
     must never be submitted alongside a different address. */
  const handleInputChange = (e) => {
    const next = e.target.value;
    selectedAddressRef.current = "";
    setQuery(next);
    setPhase("idle");
    onChange({ ...EMPTY_SERVICE_LOCATION, address: next });
  };

  const handleSelect = (suggestion) => {
    selectedAddressRef.current = suggestion.address;
    setQuery(suggestion.address);
    setSuggestions([]);
    setActiveIndex(-1);
    setOpen(false);
    setPhase("idle");
    onChange({
      address: suggestion.address || "",
      latitude: Number.isFinite(Number(suggestion.latitude))
        ? Number(suggestion.latitude)
        : null,
      longitude: Number.isFinite(Number(suggestion.longitude))
        ? Number(suggestion.longitude)
        : null,
      city: suggestion.city || "",
      state: suggestion.state || "",
      pincode: suggestion.pincode || "",
    });
  };

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setPhase("gps-unsupported");
      return;
    }
    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await reverseLookup(
            position.coords.latitude,
            position.coords.longitude
          );
          const found = res?.data;
          if (!found?.address) {
            setPhase("gps-no-address");
            return;
          }
          selectedAddressRef.current = found.address;
          setQuery(found.address);
          setSuggestions([]);
          setActiveIndex(-1);
          setOpen(false);
          setPhase("idle");
          onChange({
            address: found.address,
            latitude: Number.isFinite(Number(found.latitude))
              ? Number(found.latitude)
              : null,
            longitude: Number.isFinite(Number(found.longitude))
              ? Number(found.longitude)
              : null,
            city: found.city || "",
            state: found.state || "",
            pincode: found.pincode || "",
          });
        } catch {
          // Permission was fine but the address lookup failed — manual
          // entry keeps working, so just explain and stand down.
          setPhase("gps-lookup-error");
        }
      },
      (error) => {
        setPhase(error && error.code === 1 ? "gps-denied" : "gps-error");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleBlur = () => {
    // Delay so a tap on a suggestion lands as a click before the panel
    // closes (mousedown/pointerdown ordering differs on touch devices).
    blurTimerRef.current = setTimeout(() => setOpen(false), 200);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (suggestions.length > 0) setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    }
  };

  const showPanel = open && suggestions.length > 0;
  const statusMessage = STATUS_MESSAGES[phase] || "";
  const hasPinned = locationHasCoordinates(location);

  return (
    <div>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A9096] pointer-events-none" />
        <input
          id={id}
          name="address"
          type="text"
          required
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="House / building, area, city…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="search"
          aria-label="Service location address"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          className="w-full h-12 pl-11 pr-11 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C] text-sm sm:text-base"
        />
        {phase === "searching" && (
          <Loader2
            aria-hidden="true"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#8A9096]"
          />
        )}

        {showPanel && (
          <ul
            role="listbox"
            aria-label="Location suggestions"
            className="absolute left-0 right-0 top-full mt-2 z-50 max-h-56 sm:max-h-64 overflow-y-auto rounded-xl border border-[#E7E1D3] bg-[#FFFDF8] shadow-xl"
          >
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id || `${suggestion.latitude}-${suggestion.longitude}`} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  // Keep focus on the input while tapping so the panel
                  // doesn't close before the click fires on mobile.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full min-h-[56px] flex items-start gap-3 px-4 py-3 text-left border-b border-[#EEE9DA] last:border-b-0 transition-colors ${
                    index === activeIndex ? "bg-[#F5F1E7]" : "hover:bg-[#F5F1E7]"
                  }`}
                >
                  <Navigation className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#16263A] break-words">
                      {suggestionPrimary(suggestion)}
                    </span>
                    {suggestionSecondary(suggestion) && (
                      <span className="block text-xs text-[#747B83] mt-0.5 break-words">
                        {suggestionSecondary(suggestion)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={phase === "locating"}
        className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] text-sm font-semibold text-[#173B5C] hover:border-[#173B5C] transition disabled:opacity-60"
      >
        {phase === "locating" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Crosshair className="w-4 h-4" />
        )}
        Use my current location
      </button>

      {statusMessage && (
        <p
          role="status"
          className={`mt-2 flex items-start gap-1.5 text-xs ${
            phase === "locating" ? "text-[#747B83]" : "text-[#A77A08]"
          }`}
        >
          {phase !== "locating" && (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          )}
          <span>{statusMessage}</span>
        </p>
      )}

      {hasPinned && !statusMessage && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#747B83] break-words">
          <MapPin className="w-3 h-3 text-[#B48611] shrink-0" />
          <span>
            {[location.city, location.state, location.pincode]
              .filter(Boolean)
              .join(" · ") || "Location pinned"}
          </span>
        </p>
      )}
    </div>
  );
};

export default React.memo(ServiceLocationPicker);

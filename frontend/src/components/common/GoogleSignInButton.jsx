import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================
   GOOGLE SIGN-IN BUTTON
   Always-visible "Continue with Google" button that performs REAL
   Google authentication through Google Identity Services (GIS):
     1. Loads the GIS script and initializes with the configured
        VITE_GOOGLE_CLIENT_ID.
     2. On click, opens the Google account chooser (One Tap prompt)
        so the user can pick an account.
     3. If One Tap cannot be shown (no Google session, user
        suppressed it, etc.), the official GIS-rendered button is
        shown in its place so sign-in can still complete.
     4. The returned ID token credential is handed to the parent
        via onCredential for server-side verification — this
        component never trusts client-side profile data.
   The button is NEVER a mock: with no configured client ID a click
   reports a clear configuration error instead of faking a login.
============================================================ */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

/* Module-level promise so StrictMode double-mounts (and multiple
   instances) only ever inject the GIS script once. */
let scriptPromise = null;

const loadGoogleScript = () => {
  if (typeof window === "undefined" || !window.document) return Promise.reject();
  if (window.google?.accounts) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = window.document.querySelector(
      `script[src="${GOOGLE_SCRIPT_URL}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject());
      return;
    }
    const script = window.document.createElement("script");
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject();
    };
    window.document.head.appendChild(script);
  });

  return scriptPromise;
};

/* Official Google "G" logo (multicolor SVG, inline so no extra
   asset or dependency is required). */
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="w-5 h-5 shrink-0">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

const CONFIG_ERROR_MESSAGE =
  "Google sign-in is not configured yet. Set VITE_GOOGLE_CLIENT_ID in " +
  "frontend/.env (and GOOGLE_CLIENT_ID in backend/.env), then restart " +
  "the app for the Google button to work.";

const GoogleSignInButton = ({ onCredential, disabled = false }) => {
  const officialContainerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const initializedRef = useRef(false);

  // scriptState: "idle" | "loading" | "ready" | "error"
  const [scriptState, setScriptState] = useState("idle");
  const [usingOfficial, setUsingOfficial] = useState(false);
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  // Load the GIS script whenever a client ID is configured (re-runs
  // after a "Try again" attempt).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    setScriptState("loading");
    setAuthError("");

    loadGoogleScript()
      .then(() => {
        if (cancelled) return;
        if (!window.google?.accounts?.id) {
          setScriptState("error");
          setAuthError("Google sign-in is unavailable right now.");
          return;
        }
        setScriptState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setScriptState("error");
          setAuthError(
            "Could not load Google sign-in. Check your connection and try again."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const ensureInitialized = useCallback(() => {
    const accounts = window.google?.accounts?.id;
    if (!accounts) return false;
    if (initializedRef.current) return true;

    accounts.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: "popup",
      auto_select: false,
      callback: (response) => {
        onCredentialRef.current?.(response?.credential || "");
      },
    });
    initializedRef.current = true;
    return true;
  }, []);

  // Render the official GIS button inside the fallback container once
  // that container exists in the DOM.
  useEffect(() => {
    if (!usingOfficial || !officialContainerRef.current || !window.google?.accounts?.id) {
      return;
    }
    window.google.accounts.id.renderButton(officialContainerRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      type: "standard",
      width: officialContainerRef.current.clientWidth || 320,
      locale: "en",
    });
  }, [usingOfficial]);

  const handleClick = useCallback(() => {
    if (disabled) return;

    // No client ID configured → report honestly, never fake a login.
    if (!GOOGLE_CLIENT_ID) {
      setAuthError(CONFIG_ERROR_MESSAGE);
      return;
    }

    if (scriptState !== "ready") {
      setAuthError(
        scriptState === "error"
          ? "Google sign-in failed to load. Check your connection and try again."
          : "Google sign-in is still loading. Please wait a moment and click again."
      );
      return;
    }

    setAuthError("");
    setUsingOfficial(false);

    if (!ensureInitialized()) {
      setAuthError("Google sign-in is unavailable right now.");
      return;
    }

    // Open the real Google account chooser (One Tap). If it cannot be
    // displayed, fall back to the official rendered button so the user
    // can still pick a Google account and complete sign-in.
    window.google.accounts.id.prompt((notification) => {
      if (
        notification?.isNotDisplayed ||
        notification?.isSkippedMoment ||
        notification?.isDismissedMoment
      ) {
        setUsingOfficial(true);
      }
    });
  }, [disabled, scriptState, ensureInitialized]);

  const retry = useCallback(() => {
    setAuthError("");
    setScriptState("idle");
    setUsingOfficial(false);
    initializedRef.current = false;
    scriptPromise = null;
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="space-y-3">
      {!usingOfficial && (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="
            w-full flex items-center justify-center gap-3
            px-4 py-3 rounded-xl
            bg-white text-[#16263A] text-sm font-semibold
            border border-[#E7E1D3]
            hover:bg-[#F7F3E9] hover:border-[#D5CDBC]
            active:scale-[0.99]
            transition-all shadow-sm
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>
      )}

      {/* Official GIS button — shown only when One Tap could not open. */}
      {usingOfficial && (
        <div ref={officialContainerRef} className="w-full flex justify-center" />
      )}

      {disabled && (
        <p className="text-center text-xs text-[#747B83]">Please wait…</p>
      )}

      {authError && (
        <div className="text-center">
          <p className="text-xs text-red-600 mb-2">{authError}</p>
          {scriptState === "error" && (
            <button
              type="button"
              onClick={retry}
              className="text-xs font-bold text-[#B48611] hover:text-[#8A7A4A]"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GoogleSignInButton;
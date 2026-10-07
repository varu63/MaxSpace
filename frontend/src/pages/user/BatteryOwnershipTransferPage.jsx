import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  UserRound,
  XCircle,
} from "lucide-react";

import { LoadingSpinner } from "../../components/common";
import { useBattery } from "../../context/BatteryContext";
import {
  fetchOwnershipTransfer,
  acceptOwnershipTransfer,
} from "../../services";

/* ============================================================
   OWNERSHIP TRANSFER — acceptance screen (/transfer/:token)

   The scanner reads `maxspace-transfer:<token>` and lands here. The
   token is a bearer secret: whoever holds it AND is signed in as a
   MaxSpace account can read the pending transfer, and the first
   account to tap Accept spends it for good.

   This screen only presents what the server decides — expiry, use and
   cancellation are authoritative over there, so every terminal outcome
   (404 / 409 / 410) replaces the view with the server's reason rather
   than being softened into a generic failure.
   ============================================================ */

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const KIND_PRESENTATION = {
  expired: { Icon: Clock, accent: "bg-[#B48611] text-white" },
  used: { Icon: XCircle, accent: "bg-red-600 text-white" },
  cancelled: { Icon: XCircle, accent: "bg-red-600 text-white" },
  conflict: { Icon: AlertTriangle, accent: "bg-[#B48611] text-white" },
  own: { Icon: UserRound, accent: "bg-[#B48611] text-white" },
  forbidden: { Icon: XCircle, accent: "bg-red-600 text-white" },
  invalid: { Icon: XCircle, accent: "bg-red-600 text-white" },
  offline: { Icon: AlertTriangle, accent: "bg-[#B48611] text-white" },
};

/* One description per backend outcome. Codes come from the store's
   transfer guards (data/postgres/lifecycle.js). */
const describeError = (error) => {
  const code = error?.code;
  const status = error?.status;

  if (status >= 500) {
    return {
      kind: "offline",
      title: "The transfer service is unavailable",
      body: "Something went wrong on our side. Please try again in a moment.",
      terminal: false,
    };
  }
  if (code === "transfer_expired" || status === 410) {
    return {
      kind: "expired",
      title: "This transfer code has expired",
      body: "Transfer codes are valid for 10 minutes. Ask the current owner to generate a new QR code and scan it again.",
      terminal: true,
    };
  }
  if (code === "transfer_already_used") {
    return {
      kind: "used",
      title: "This code has already been used",
      body: "The battery has already been transferred with this QR code. Transfer codes work exactly once.",
      terminal: true,
    };
  }
  if (code === "transfer_cancelled") {
    return {
      kind: "cancelled",
      title: "This transfer was cancelled",
      body: "The current owner revoked this code before it was accepted. Ask them to start a new transfer.",
      terminal: true,
    };
  }
  if (code === "ownership_conflict") {
    return {
      kind: "conflict",
      title: "Ownership has changed",
      body: "This battery changed hands after the code was created, so the transfer can no longer be accepted. Ask the current owner to start a new one.",
      terminal: true,
    };
  }
  if (code === "own_transfer") {
    return {
      kind: "own",
      title: "This is your own transfer code",
      body: "You are signed in as the account that created this code. The receiving account has to sign in and accept it.",
      terminal: true,
    };
  }
  if (status === 404) {
    return {
      kind: "invalid",
      title: "Transfer code not found",
      body: "This code is not valid. It may be mistyped, or it may come from an old request.",
      terminal: true,
    };
  }
  if (status === 403 || code === "forbidden") {
    return {
      kind: "forbidden",
      title: "You cannot take part in this transfer",
      body: error?.message || "This account is not allowed to accept ownership transfers.",
      terminal: true,
    };
  }
  if (status === 401) {
    return {
      kind: "forbidden",
      title: "Please sign in first",
      body: "Ownership transfers are accepted from a signed-in MaxSpace account.",
      terminal: true,
    };
  }
  return {
    kind: "offline",
    title: "Could not open this transfer",
    body: error?.message || "Please try again in a moment.",
    terminal: false,
  };
};

/* The read endpoint answers 200 with the transfer's status rather than
   an error — it deliberately lets the screen say WHICH dead end it hit
   (used vs cancelled vs expired) instead of collapsing them all into a
   failure. Only accept/cancel throw 4xx; this maps the read's status
   onto the same descriptions. */
const TERMINAL_STATUS_CODES = {
  accepted: "transfer_already_used",
  cancelled: "transfer_cancelled",
  expired: "transfer_expired",
};

export default function BatteryOwnershipTransferPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast, findBatteryByBarcode, setBatteries, userProfile } = useBattery();

  // loading → ready → accepted, with "error" reachable from any stage
  // once the server gives a terminal reason.
  const [phase, setPhase] = useState("loading");
  const [transfer, setTransfer] = useState(null);
  const [error, setError] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [accepting, setAccepting] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [accepted, setAccepted] = useState(null);

  /* Which token the states above describe. Until the fetch for the
     current :token finishes, the screen renders the loading view — so a
     route-param change (scanning a second code) never shows the first
     code's data, and the effect itself never has to reset state
     synchronously. */
  const [loadedToken, setLoadedToken] = useState(null);
  const status = loadedToken === token ? phase : "loading";

  useEffect(() => {
    let cancelled = false;

    fetchOwnershipTransfer(token)
      .then((data) => {
        if (cancelled) return;
        setLoadedToken(token);
        const next = data?.transfer || null;
        if (!next) {
          setError(describeError({ status: 404 }));
          setPhase("error");
          return;
        }
        const terminalCode = TERMINAL_STATUS_CODES[next.status];
        if (terminalCode || Number(next.expiresInMs) <= 0) {
          setError(describeError({ code: terminalCode || "transfer_expired" }));
          setPhase("error");
          return;
        }
        setTransfer(next);
        const ms = Number(next.expiresInMs) || 0;
        setDeadline(Date.now() + ms);
        setNow(Date.now());
        setPhase("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadedToken(token);
        setError(describeError(err));
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* Live countdown — only meaningful while the code can still be used.
     `now` is set when the transfer loads (async callback); the effect
     only keeps it moving. */
  useEffect(() => {
    if (status !== "ready" || deadline == null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [status, deadline]);

  const remainingMs = deadline != null ? deadline - now : 0;
  const expired = status === "ready" && remainingMs <= 0;

  const handleAccept = useCallback(async () => {
    setAccepting(true);
    setInlineError("");
    try {
      const result = await acceptOwnershipTransfer(token);
      setAccepted(result);
      setPhase("accepted");
      addToast(
        "Ownership transferred",
        result?.message || "Battery ownership transferred successfully.",
        "success"
      );

      /* Pull the battery into this account's list straight away so the
         passport page below (and Profile/Home) shows it without a
         manual refresh. A failed refresh must not undo the success. */
      try {
        const fresh = await findBatteryByBarcode(result?.battery?.id);
        if (fresh?.id) {
          setBatteries((prev) =>
            Array.isArray(prev) && prev.some((b) => b.id === fresh.id)
              ? prev.map((b) => (b.id === fresh.id ? fresh : b))
              : [...(Array.isArray(prev) ? prev : []), fresh]
          );
        }
      } catch {
        /* list refresh is best-effort */
      }
    } catch (err) {
      const described = describeError(err);
      if (described.terminal) {
        setError(described);
        setPhase("error");
      } else {
        setInlineError(described.body);
      }
      addToast("Could not accept transfer", described.body, "error");
    } finally {
      setAccepting(false);
    }
  }, [token, addToast, findBatteryByBarcode, setBatteries]);

  /* ---------------- loading ---------------- */
  if (status === "loading") {
    return (
      <div className="w-full max-w-xl mx-auto py-6">
        <LoadingSpinner />
      </div>
    );
  }

  /* ---------------- terminal failure ---------------- */
  if (status === "error" && error) {
    const { Icon, accent } = KIND_PRESENTATION[error.kind] || KIND_PRESENTATION.invalid;
    return (
      <div className="w-full max-w-xl mx-auto space-y-6 py-6">
        <div className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-6 sm:p-8 text-center shadow-sm">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 ${accent}`}>
            <Icon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-[#16263A]">{error.title}</h1>
          <p className="mt-2 text-sm text-[#747B83] leading-relaxed max-w-md mx-auto">
            {error.body}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="h-11 px-6 rounded-xl bg-[#173B5C] text-white text-sm font-bold hover:bg-[#102F4A] transition"
            >
              Go to Home
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-11 px-6 rounded-xl border border-[#E7E1D3] text-[#16263A] text-sm font-bold hover:bg-[#F5F1E7] transition"
            >
              Go Back
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-[#747B83]">
          Transfers are single-use and expire after 10 minutes — this protects the
          battery from being moved by a screenshot.
        </p>
      </div>
    );
  }

  /* ---------------- accepted ---------------- */
  if (status === "accepted" && accepted) {
    const batteryId = accepted?.battery?.id;
    const model = accepted?.battery?.modelName || transfer?.batteryModel || "Battery";
    return (
      <div className="w-full max-w-xl mx-auto py-6">
        <div className="rounded-3xl bg-[#FFFDF8] border border-[#CFE6D9] p-6 sm:p-8 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1B5E3C] text-white mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-[#16263A]">
            {accepted?.message || "Battery ownership transferred successfully."}
          </h1>
          <p className="mt-2 text-sm text-[#747B83]">
            <span className="font-semibold text-[#16263A]">{model}</span>
            {transfer?.batteryIdMasked ? ` (${transfer.batteryIdMasked})` : ""} now belongs
            to your account and appears in your fleet.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            {batteryId ? (
              <button
                type="button"
                onClick={() => navigate(`/battery/${batteryId}/passport`)}
                className="h-11 px-6 rounded-xl bg-[#173B5C] text-white text-sm font-bold hover:bg-[#102F4A] transition inline-flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Battery Passport
              </button>
            ) : null}
            <Link
              to="/home"
              className="h-11 px-6 rounded-xl border border-[#E7E1D3] text-[#16263A] text-sm font-bold hover:bg-[#F5F1E7] transition inline-flex items-center justify-center gap-2"
            >
              Go to Home
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- ready to accept ---------------- */
  const isOwnTransfer = Boolean(transfer?.isOwnTransfer);

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-6 sm:p-8 shadow-sm">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F5F1E7] text-[#173B5C] mb-4">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-[#16263A]">Accept ownership transfer</h1>
          <p className="mt-1 text-sm text-[#747B83]">
            A MaxSpace account is offering you this battery via a one-time QR code.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-[#EEE9DA] bg-[#FAF7EF] divide-y divide-[#EEE9DA]">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-[#747B83]">Model</span>
            <span className="text-sm font-bold text-[#16263A] text-right">
              {transfer?.batteryModel || "Battery"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-[#747B83]">Battery ID</span>
            <span className="text-sm font-mono font-semibold text-[#16263A]">
              {transfer?.batteryIdMasked || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-[#747B83]">Code status</span>
            {expired ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBEDED] border border-[#F2C4C0] px-3 py-1 text-xs font-bold text-[#C0392B]">
                <Clock className="w-3 h-3" /> Expired
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF1C9] border border-[#F0E6C8] px-3 py-1 text-xs font-bold text-[#B48611]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B48611] animate-pulse" />
                Live · {formatCountdown(remainingMs)} left
              </span>
            )}
          </div>
        </div>

        {isOwnTransfer && (
          <div className="mt-4 rounded-xl bg-[#FBF1C9] border border-[#F0E6C8] p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B48611] mt-0.5 shrink-0" />
            <p className="text-xs text-[#16263A] leading-relaxed">
              You are signed in as the account that created this code. Sign in with the
              receiving account on this device (or let the new owner scan it) to complete
              the transfer.
            </p>
          </div>
        )}

        {!isOwnTransfer && (
          <ul className="mt-4 space-y-2 text-xs text-[#16263A]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              Accepting moves this battery to your account permanently.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              It will appear in your fleet and passport history straight away.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              The code works once — accepting spends it for everybody.
            </li>
          </ul>
        )}

        {inlineError && (
          <div className="mt-4 rounded-xl bg-[#FBEDED] border border-[#F2C4C0] p-3 text-xs text-[#C0392B]">
            {inlineError}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting || expired || isOwnTransfer}
            className="flex-1 h-11 rounded-xl bg-[#1B5E3C] text-white text-sm font-bold hover:bg-[#14492E] transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Transferring…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Accept Ownership
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/home")}
            disabled={accepting}
            className="h-11 px-6 rounded-xl border border-[#E7E1D3] text-[#16263A] text-sm font-bold hover:bg-[#F5F1E7] transition disabled:opacity-50"
          >
            Decline
          </button>
        </div>

        {expired && (
          <p className="mt-3 text-center text-xs text-[#747B83]">
            Ask the current owner to generate a fresh code from the battery page.
          </p>
        )}
      </div>

      {userProfile?.email && (
        <p className="text-center text-xs text-[#747B83]">
          Accepting as{" "}
          <span className="font-semibold text-[#16263A]">{userProfile.email}</span>
        </p>
      )}
    </div>
  );
}

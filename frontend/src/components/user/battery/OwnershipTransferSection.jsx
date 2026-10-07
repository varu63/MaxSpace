import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Copy,
  QrCode,
} from "lucide-react";

import { Modal, ModalHeader } from "../../common";
import { useBattery } from "../../../context/BatteryContext";
import { createOwnershipTransfer, cancelOwnershipTransfer } from "../../../services";

/* ============================================================
   OWNERSHIP TRANSFER — owner side

   The button, the confirmation, and the one-time QR itself.

   Two rules shape the flow:
     - closing the QR window does NOT cancel the code (the owner may
       have handed the phone to somebody and closed it by reflex), so
       the code stays live until it expires, is cancelled explicitly,
       or is superseded by generating a new one;
     - the token is shown here and never again — the store only kept
       its hash, so there is nothing to come back to.
   ============================================================ */

const maskId = (id) => {
  const value = String(id || "");
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const expiresAtMs = (session) =>
  session?.expiresAt ? new Date(session.expiresAt).getTime() : 0;

export default function OwnershipTransferSection({ battery }) {
  const { userProfile, addToast } = useBattery();

  // idle → confirm → minting → qr (qr can loop back to confirm when the
  // code expires and a fresh one is wanted).
  const [phase, setPhase] = useState("idle");
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [qrImage, setQrImage] = useState("");

  const isOwner = Boolean(
    battery?.ownerId && userProfile?.id && battery.ownerId === userProfile.id
  );
  const remainingMs = expiresAtMs(session) - now;

  /* Ticker only while the QR is on screen: a live countdown is part of
     "this code is short-lived", and nothing needs it while closed. The
     clock itself is refreshed when the window opens (event handlers),
     so the effect only has to keep it moving. */
  useEffect(() => {
    if (phase !== "qr") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [phase, session]);

  if (!isOwner) return null;

  const openFlow = () => {
    // A still-live code from an earlier click is reused rather than
    // silently superseded — the owner may have closed the window by
    // accident, and the recipient may already be aiming their camera.
    if (session && expiresAtMs(session) > Date.now()) {
      setNow(Date.now());
      setPhase("qr");
      return;
    }
    setPhase("confirm");
  };

  const closeModals = () => setPhase("idle");

  const generateCode = async () => {
    setBusy(true);
    try {
      const data = await createOwnershipTransfer(battery.id);
      setSession({
        token: data.token,
        qrPayload: data.qrPayload,
        expiresAt: data.transfer?.expiresAt,
        batteryIdMasked: data.transfer?.batteryIdMasked || maskId(battery.id),
        batteryModel: data.transfer?.batteryModel || battery.modelName || null,
      });
      setNow(Date.now());

      try {
        setQrImage(
          await QRCode.toDataURL(data.qrPayload, {
            margin: 1,
            width: 320,
            errorCorrectionLevel: "M",
            color: { dark: "#16263A", light: "#FFFDF8" },
          })
        );
      } catch {
        // The payload text below the image is the fallback; a missing
        // image must not lose the transfer.
        setQrImage("");
      }

      setPhase("qr");
      if (data.previousCodeSuperseded) {
        addToast(
          "Previous code replaced",
          "Any QR code you generated earlier for this battery is no longer valid.",
          "info"
        );
      }
      addToast(
        "Transfer code ready",
        "Show this QR to the new owner. It expires in 10 minutes.",
        "success"
      );
    } catch (error) {
      addToast(
        "Could not start the transfer",
        error?.message || "Please try again in a moment.",
        "error"
      );
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  };

  const cancelCode = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await cancelOwnershipTransfer(session.token);
      setSession(null);
      setPhase("idle");
      addToast("Transfer cancelled", "The QR code is no longer valid.", "info");
    } catch (error) {
      addToast(
        "Could not cancel the transfer",
        error?.message || "Please try again in a moment.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(session?.qrPayload || "");
      addToast("Copied", "The transfer code was copied to your clipboard.", "success");
    } catch {
      addToast("Could not copy", "Your browser blocked clipboard access.", "error");
    }
  };

  const expired = Boolean(session) && remainingMs <= 0;

  return (
    <>
      <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5F1E7] flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5 text-[#173B5C]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16263A]">Ownership Transfer</h3>
              <p className="text-xs text-[#747B83] mt-1 leading-relaxed max-w-xl">
                Hand this battery to another MaxSpace account. You get a one-time QR
                code that is valid for 10 minutes — the transfer completes only when
                the new owner scans it and accepts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openFlow}
            className="h-10 px-5 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition flex items-center justify-center gap-1.5 shrink-0"
          >
            <QrCode className="w-3.5 h-3.5" />
            Transfer Ownership
          </button>
        </div>
      </div>

      {/* ---------- confirmation ---------- */}
      <Modal isOpen={phase === "confirm"} onClose={closeModals}>
        <div className="relative w-full max-w-md rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] shadow-xl overflow-hidden">
          <ModalHeader
            title="Transfer ownership?"
            subtitle={battery.modelName || "Battery"}
            batteryId={battery.id}
            onClose={closeModals}
          />
          <div className="p-6 space-y-3 text-sm text-[#16263A]">
            <p className="text-xs text-[#747B83] leading-relaxed">
              A one-time QR code will be generated for{" "}
              <span className="font-semibold text-[#16263A]">
                {battery.modelName || battery.id}
              </span>
              . Show it to the new owner, who scans and accepts it on their device.
            </p>
            <ul className="space-y-2 text-xs text-[#16263A]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                The code works once and expires after 10 minutes.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                Closing the QR window keeps the code live until it expires.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                You can cancel it at any time before it is accepted.
              </li>
            </ul>
            <div className="rounded-xl bg-[#FBEDED] border border-[#F2C4C0] p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#C0392B] mt-0.5 shrink-0" />
              <p className="text-xs text-[#16263A] leading-relaxed">
                Once accepted, this battery leaves your account permanently and its
                passport history moves to the new owner.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 p-5 border-t border-[#EEE9DA]">
            <button
              type="button"
              onClick={closeModals}
              className="h-10 px-5 rounded-xl border border-[#E7E1D3] text-[#16263A] text-xs font-semibold hover:bg-[#F5F1E7] transition"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={generateCode}
              disabled={busy}
              className="h-10 px-5 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition disabled:opacity-60"
            >
              {busy ? "Generating…" : "Generate QR code"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------- the QR ---------- */}
      <Modal isOpen={phase === "qr"} onClose={closeModals}>
        <div className="relative w-full max-w-md rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] shadow-xl overflow-hidden">
          <ModalHeader
            title="One-time transfer code"
            subtitle={session?.batteryModel || battery.modelName || "Battery"}
            batteryId={session?.batteryIdMasked || maskId(battery.id)}
            onClose={closeModals}
          />
          <div className="p-6 space-y-4">
            {!expired ? (
              <>
                <div className="flex justify-center">
                  <div className="rounded-2xl bg-white border border-[#E7E1D3] p-3">
                    {qrImage ? (
                      <img
                        src={qrImage}
                        alt="One-time ownership transfer QR code"
                        className="w-56 h-56"
                      />
                    ) : (
                      <p className="w-56 h-56 flex items-center justify-center text-center px-4 text-xs font-mono break-all text-[#16263A]">
                        {session?.qrPayload}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF1C9] border border-[#F0E6C8] px-3 py-1 text-xs font-bold text-[#B48611]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B48611] animate-pulse" />
                    Expires in {formatCountdown(remainingMs)}
                  </span>
                  <button
                    type="button"
                    onClick={copyPayload}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E7E1D3] px-3 py-1 text-xs font-semibold text-[#173B5C] hover:bg-[#F5F1E7] transition"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>

                <p className="text-xs text-[#747B83] leading-relaxed text-center">
                  The new owner opens their scanner and points it at this code. The
                  transfer happens only when they tap <span className="font-semibold text-[#16263A]">Accept</span>.
                </p>
              </>
            ) : (
              <div className="py-4 text-center">
                <AlertTriangle className="w-10 h-10 mx-auto text-[#B48611] mb-3" />
                <p className="text-sm font-bold text-[#16263A]">This code has expired</p>
                <p className="mt-1 text-xs text-[#747B83]">
                  Transfer codes are valid for 10 minutes. Generate a fresh one to
                  continue.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-between gap-3 p-5 border-t border-[#EEE9DA]">
            <button
              type="button"
              onClick={cancelCode}
              disabled={busy || !session || expired}
              className="h-10 px-5 rounded-xl border border-[#F2C4C0] text-[#C0392B] text-xs font-semibold hover:bg-[#FBEDED] transition disabled:opacity-50"
            >
              {busy ? "Working…" : "Cancel transfer"}
            </button>
            {expired ? (
              <button
                type="button"
                onClick={generateCode}
                disabled={busy}
                className="h-10 px-5 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition disabled:opacity-60"
              >
                {busy ? "Generating…" : "Generate a new code"}
              </button>
            ) : (
              <button
                type="button"
                onClick={closeModals}
                className="h-10 px-5 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

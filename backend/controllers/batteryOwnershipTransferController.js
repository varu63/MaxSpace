/* ============================================================
   BATTERY OWNERSHIP TRANSFER — one-time QR, HTTP surface

   Three endpoints around a bearer token that exists only in the QR
   the current owner shows:

     POST   /batteries/:id/transfers          mint (owner only)
     GET    /batteries/transfers/:token       read before deciding
     POST   /batteries/transfers/:token/accept swap custody
     POST   /batteries/transfers/:token/cancel revoke (minter only)

   The token is 32 random bytes base64url-encoded; the store keeps only
   its SHA-256, so a database dump cannot be replayed as a working QR.
   Every status transition — expiry, supersession, single use, the
   battery still being with the account that minted it — is decided by
   the store under row locks inside one transaction; this controller
   only resolves the caller and shapes the response.

   What the scanner shows before acceptance is deliberately thin: the
   model, a masked identifier and how long the code is live. Who the
   battery belongs to today is not published through a bearer token —
   the previous owner's identity becomes visible after the swap, in the
   custody history the new owner is entitled to.
   ============================================================ */
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  normalizeBatteryIdentifier,
  resolveBatteryByIdentifier,
} from "../utils/batteryIdentifier.js";

const TRANSFER_QR_PREFIX = "maxspace-transfer:";
const TRANSFER_TTL_MS = 10 * 60 * 1000;

const httpError = (status, message, code) =>
  Object.assign(new Error(message), { statusCode: status, code, userFacing: true });

/* External EPR partners reach batteries only through their EOL
   assignments (utils/partnerAccess.js); a bearer transfer token must
   not become a second way in. */
const assertTransferParticipant = (req) => {
  if (req.user?.role === "PARTNER") {
    throw httpError(
      403,
      "External partner accounts cannot take part in ownership transfers.",
      "forbidden"
    );
  }
};

/* `MVAE…0471` — enough to recognise the unit on screen, not enough to
   act on it. */
const maskBatteryId = (id) => {
  const value = String(id || "");
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

const resolveTargetBattery = async (req) => {
  const identifier = normalizeBatteryIdentifier(req.params.id);
  if (!identifier) throw httpError(400, "A battery identifier is required", "validation");
  const battery = await resolveBatteryByIdentifier(store, identifier);
  if (!battery) throw httpError(404, "Battery not found", "not_found");
  return battery;
};

// POST /api/batteries/:id/transfers
export const createOwnershipTransferRequest = asyncHandler(async (req, res) => {
  assertTransferParticipant(req);
  const battery = await resolveTargetBattery(req);

  const { token, transfer, supersededCount } = await store.createOwnershipTransfer({
    batteryId: battery.id,
    previousOwnerId: req.user.id,
    ttlMs: TRANSFER_TTL_MS,
  });

  await store.logActivity(
    req.user.id,
    "Ownership Transfer Started",
    `Generated a one-time transfer code for ${battery.modelName || battery.barcode || battery.id}`,
    "general"
  );

  res.status(201).json({
    success: true,
    token,
    qrPayload: `${TRANSFER_QR_PREFIX}${token}`,
    expiresInMs: TRANSFER_TTL_MS,
    transfer: {
      id: transfer.id,
      batteryId: battery.id,
      batteryIdMasked: maskBatteryId(battery.id),
      batteryModel: battery.modelName || battery.model || null,
      status: transfer.status,
      expiresAt: transfer.expiresAt,
      createdAt: transfer.createdAt,
    },
    // A second click on the button replaced an earlier live code; the
    // client may want to say so rather than silently hold two QRs.
    previousCodeSuperseded: supersededCount > 0,
  });
});

// GET /api/batteries/transfers/:token
export const getOwnershipTransferRequest = asyncHandler(async (req, res) => {
  assertTransferParticipant(req);
  const transfer = await store.getOwnershipTransferByToken(req.params.token);
  const expiresAt = new Date(transfer.expiresAt).getTime();

  res.json({
    success: true,
    transfer: {
      status: transfer.status,
      batteryIdMasked: maskBatteryId(transfer.batteryId),
      batteryModel: transfer.batteryModel,
      expiresAt: transfer.expiresAt,
      expiresInMs: Math.max(0, expiresAt - Date.now()),
      isOwnTransfer: transfer.previousOwnerId === req.user.id,
    },
  });
});

// POST /api/batteries/transfers/:token/accept
export const acceptOwnershipTransferRequest = asyncHandler(async (req, res) => {
  assertTransferParticipant(req);
  const result = await store.acceptOwnershipTransfer({
    token: req.params.token,
    newOwnerId: req.user.id,
  });

  const model = result.battery.modelName || result.transfer.batteryModel || "Battery";

  /* Both sides see the swap in their activity feed: one entry is "I
     received", the other "it left me". Neither is derivable from the
     other, so both are written. */
  await store.logActivity(
    req.user.id,
    "Ownership Transfer Accepted",
    `Received ${model} (${result.battery.id}) via one-time QR transfer`,
    "general"
  );
  await store.logActivity(
    result.previousOwnerId,
    "Ownership Transferred Away",
    `${req.user.name || req.user.email} accepted ${model} (${result.battery.id}) via one-time QR transfer`,
    "general"
  );

  res.json({
    success: true,
    message: "Battery ownership transferred successfully.",
    battery: { id: result.battery.id, modelName: result.battery.modelName || null },
    transfer: { id: result.transfer.id, status: result.transfer.status, acceptedAt: result.transfer.acceptedAt },
  });
});

// POST /api/batteries/transfers/:token/cancel
export const cancelOwnershipTransferRequest = asyncHandler(async (req, res) => {
  assertTransferParticipant(req);
  const transfer = await store.cancelOwnershipTransfer({
    token: req.params.token,
    userId: req.user.id,
  });

  await store.logActivity(
    req.user.id,
    "Ownership Transfer Cancelled",
    `Cancelled the pending transfer code for ${transfer.batteryModel || maskBatteryId(transfer.batteryId)}`,
    "general"
  );

  res.json({
    success: true,
    message: "Transfer request cancelled.",
    transfer: { id: transfer.id, status: transfer.status, cancelledAt: transfer.cancelledAt },
  });
});

/* One-time ownership-transfer QR payload: `maxspace-transfer:<token>`.
   The token is a base64url secret (43 chars in practice); anything that
   does not match is not a transfer code and must fall through to the
   battery-identifier checks in the scanner. */

const TRANSFER_PAYLOAD = /^maxspace-transfer:([A-Za-z0-9_-]{20,})$/;

export const extractTransferToken = (raw) => {
  const code = String(raw ?? "").trim();
  const match = code.match(TRANSFER_PAYLOAD);
  return match ? match[1] : null;
};

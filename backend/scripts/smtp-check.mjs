/* ============================================================
   SMTP DIAGNOSTIC CHECK (dev tooling)
   Verifies that the .env SMTP settings are present, that the
   server can be reached and authenticated, and optionally sends
   a test email through the existing mailer utility.

   Usage:
     node scripts/smtp-check.mjs                # connection check only
     node scripts/smtp-check.mjs recipient@x   # also send a test email
   Never prints the SMTP password.
   ============================================================ */
import "dotenv/config";
import { verifySmtpConnection, sendPasswordResetEmail, isMailerConfigured } from "../utils/mailer.js";

const mask = (value) =>
  !value ? "(empty)" : typeof value === "string" && value.length > 4
    ? `${value.slice(0, 2)}${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`
    : "***";

const env = {
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: process.env.SMTP_PORT || "",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "",
  CLIENT_URL: process.env.CLIENT_URL || process.env.FRONTEND_URL || "",
};

console.log("=== SMTP configuration check ===");
console.log(`SMTP_HOST      : ${env.SMTP_HOST || "(missing)"}`);
console.log(`SMTP_PORT      : ${env.SMTP_PORT || "(missing)"}`);
console.log(`SMTP_USER      : ${env.SMTP_USER ? mask(env.SMTP_USER) : "(missing)"}`);
console.log(`SMTP_PASS      : ${env.SMTP_PASS ? mask(env.SMTP_PASS) : "(missing)"}`);
console.log(`EMAIL_FROM     : ${env.EMAIL_FROM || "(missing)"}`);
console.log(`CLIENT_URL     : ${env.CLIENT_URL || "(missing, defaults to http://localhost:5173)"}`);
console.log(`mailerConfigured: ${isMailerConfigured()}`);
console.log("");

const missing = Object.entries({
  SMTP_HOST: env.SMTP_HOST,
  SMTP_USER: env.SMTP_USER,
  SMTP_PASS: env.SMTP_PASS,
  EMAIL_FROM: env.EMAIL_FROM,
}).filter(([, v]) => !v);

if (missing.length) {
  console.log(`SMTP Configuration: FAIL  (missing: ${missing.map(([k]) => k).join(", ")})`);
} else {
  console.log("SMTP Configuration: PASS");
}

console.log("");
console.log("=== SMTP connection / authentication ===");
const result = await verifySmtpConnection();
console.log(result.ok ? "SMTP Connection: PASS" : `SMTP Connection: FAIL`);
console.log(`  alias : ${result.alias}`);
console.log(`  reason: ${result.reason}`);

const recipient = process.argv[2];
if (recipient) {
  console.log("");
  console.log(`=== Test email to ${recipient} ===`);
  try {
    const sent = await sendPasswordResetEmail(
      recipient,
      `${env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=diagnostic-test-only-not-a-real-token`
    );
    console.log(`method: ${sent.method}`);
    console.log(`messageId: ${sent.messageId || "n/a"}`);
    console.log(sent.error ? `error: ${sent.error}` : "");
    console.log(`Test Email Sending: ${sent.method === "sent" ? "PASS" : "FAIL (SMTP send failed)"}`);
    console.log(`  info: ${sent.info || ""}`);
  } catch (error) {
    console.log(`Test Email Sending: FAIL`);
    console.log(`  error: ${String(error && error.message ? error.message : error)}`);
  }
}

process.exit(result.ok ? 0 : 1);
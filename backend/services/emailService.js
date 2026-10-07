/* ============================================================
   CENTRAL E-MAIL SERVICE (Resend)
   The single place the backend sends transactional e-mail:
   account-verification links and password-reset links.

   Rules this module enforces for every caller:
     * the Resend API key is read from the BACKEND environment only and
       is never logged, never returned, and never sent to the client;
     * a provider failure surfaces as EmailDeliveryError so callers can
       report a generic, user-safe message — Resend's own error text
       never reaches the user;
     * a message counts as "delivered" only when Resend accepted it.

   Local development without a RESEND_API_KEY falls back to appending
   the link to a log file so the flow stays testable. That fallback is
   hard-disabled when NODE_ENV=production: a raw token is never written
   to disk in production, and the caller is told delivery failed.
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { Resend } from "resend";
import config from "../config/app.js";

/** Delivery failed (unconfigured, or Resend rejected/failed the request). */
export class EmailDeliveryError extends Error {
  constructor(message = "Unable to send email right now.") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

const isProduction = config.nodeEnv === "production";

/* ---------- Sender resolution (environment-aware) ----------
   Resend only accepts senders on domains verified for the account, so
   exactly one sanctioned sender per environment:
     * development/local -> onboarding@resend.dev (Resend's built-in
       development address; needs no domain verification);
     * production        -> no-reply@maxvoltreearth.com (the project's
       verified domain).
   A placeholder such as no-reply@your-domain.com — copied from an
   example — or any empty/malformed value is treated as "not
   configured": it is replaced by this environment's sender and the
   substitution is logged, never sent as-is. If no valid sender can be
   produced at all, sending stops with an explicit configuration error
   instead of silently picking an address. */
const DEV_SENDER = "onboarding@resend.dev";
const PROD_SENDER = "no-reply@maxvoltreearth.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isUsableSender = (value) =>
  Boolean(value) &&
  EMAIL_PATTERN.test(value) &&
  !/your-domain\.com$/i.test(value);

/* Resolved once per process (config is static) so the substitution is
   logged a single time, not on every message. */
let resolvedSender = null;
const resolveFromEmail = () => {
  if (resolvedSender) return resolvedSender;
  const configured = config.email.fromEmail;
  if (isUsableSender(configured)) {
    resolvedSender = configured;
  } else {
    resolvedSender = isProduction ? PROD_SENDER : DEV_SENDER;
    console.warn(
      `[email] RESEND_FROM_EMAIL is ${configured ? `"${configured}" (missing or invalid)` : "not set"} — using the ${isProduction ? "production" : "development"} sender ${resolvedSender}.`
    );
  }
  return resolvedSender;
};

let resendClient = null;

const getClient = () => {
  if (!config.email.resendApiKey) return null;
  if (!resendClient) resendClient = new Resend(config.email.resendApiKey);
  return resendClient;
};

export const isEmailServiceConfigured = () =>
  Boolean(config.email.resendApiKey && isUsableSender(resolveFromEmail()));

const fromHeader = () => {
  const fromEmail = resolveFromEmail();
  const { fromName } = config.email;
  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
};

/* Strip the Resend API key out of a provider error before it is logged,
   so a leaked diagnostic can never reveal a secret. */
const safeText = (value) => {
  let text = String(value && value.message ? value.message : value);
  if (config.email.resendApiKey) {
    text = text.split(config.email.resendApiKey).join("***");
  }
  return text;
};

/* Development-only link log. Returns the file path, or null. */
const logDevLink = (kind, email, link) => {
  if (isProduction || !link) return null;
  try {
    const logFile = path.join(
      process.env.TEMP || process.env.TMPDIR || "/tmp",
      "maxspace-auth-links.log"
    );
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${kind} ${email} ${link}\n`);
    return logFile;
  } catch {
    return null;
  }
};

/* Send one message through Resend. Resolves only when Resend accepted
   the message; otherwise throws EmailDeliveryError. */
const send = async ({ to, subject, text, html, kind, link }) => {
  const client = getClient();
  const fromEmail = resolveFromEmail();

  if (!isUsableSender(fromEmail)) {
    // Defensive: both the configured value and the environment defaults
    // are validated, so reaching this means nothing usable exists.
    console.error(
      `[email] Configuration error: no valid sender address. Set RESEND_FROM_EMAIL to a verified address (development: ${DEV_SENDER}, production: ${PROD_SENDER}).`
    );
    throw new EmailDeliveryError("Email sender address is not configured.");
  }

  if (!client) {
    if (isProduction) {
      console.error(
        "[email] Refusing to send: RESEND_API_KEY / RESEND_FROM_EMAIL is not configured."
      );
      throw new EmailDeliveryError();
    }
    // Local development: the message was NOT delivered to a mailbox, but
    // the flow stays exercisable — the link is appended to a dev log.
    const logFile = logDevLink(kind, to, link);
    console.warn(
      `[email] RESEND_API_KEY not configured — "${subject}" NOT sent to ${to}.` +
        (logFile ? ` Link written to ${logFile}.` : "")
    );
    return { delivered: false, method: "dev-log", to, subject };
  }

  let response;
  try {
    response = await client.emails.send({
      from: fromHeader(),
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error(`[email] Resend request failed for "${subject}" -> ${safeText(error)}`);
    throw new EmailDeliveryError();
  }

  // The SDK reports API failures as `{ error }` rather than an exception.
  if (response?.error) {
    console.error(`[email] Resend rejected "${subject}" -> ${safeText(response.error)}`);
    throw new EmailDeliveryError();
  }

  console.log(
    `[email] Sent "${subject}" to ${to} via Resend (id=${response?.data?.id || "unknown"})`
  );
  return { delivered: true, method: "resend", id: response?.data?.id || null };
};

/* ---------- Shared layout ---------- */

const shell = ({ heading, body, ctaLabel, ctaHref, footer }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#16263A">
    <div style="padding:24px 0 8px">
      <span style="display:inline-block;background:#173B5C;color:#fff;font-weight:bold;letter-spacing:1px;padding:8px 14px;border-radius:8px">MaxSpace</span>
    </div>
    <h2 style="color:#173B5C;margin-bottom:12px">${heading}</h2>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${body}</p>
    <p style="margin:0 0 20px">
      <a href="${ctaHref}" style="display:inline-block;background:#173B5C;color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px;font-weight:bold">${ctaLabel}</a>
    </p>
    <p style="font-size:12px;color:#747B83;line-height:1.6;margin:0">${footer}</p>
  </div>`;

/**
 * Send the "verify your e-mail" message for a freshly created account.
 * @param {{to: string, name?: string, verifyUrl: string}} params
 */
export const sendVerificationEmail = async ({ to, name, verifyUrl }) => {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return send({
    to,
    kind: "verify-email",
    link: verifyUrl,
    subject: "Welcome to MaxSpace — verify your email",
    text: `${greeting}\n\nYour MaxSpace account has been created successfully.\n\nPlease verify your email address to activate your account:\n${verifyUrl}\n\nThis link expires in 24 hours. If you did not create a MaxSpace account, you can safely ignore this email.\n\n— The MaxSpace team`,
    html: shell({
      heading: "Welcome to MaxSpace",
      body: `${greeting}<br /><br />Your MaxSpace account has been created successfully.<br />Please verify your email address to activate your account.`,
      ctaLabel: "Verify Email",
      ctaHref: verifyUrl,
      footer:
        "This link expires in 24 hours and can be used once. If you did not create a MaxSpace account, you can safely ignore this email.",
    }),
  });
};

/**
 * Send the "reset your password" message.
 * @param {{to: string, name?: string, resetUrl: string}} params
 */
export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return send({
    to,
    kind: "reset-password",
    link: resetUrl,
    subject: "Reset your MaxSpace password",
    text: `${greeting}\n\nSomeone requested a password reset for your MaxSpace account.\n\nChoose a new password here (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can ignore this email — your password will not change.\n\n— The MaxSpace team`,
    html: shell({
      heading: "Reset your MaxSpace password",
      body: `${greeting}<br /><br />Someone requested a password reset for your MaxSpace account. Click the button below to choose a new password.`,
      ctaLabel: "Reset Password",
      ctaHref: resetUrl,
      footer:
        "This link expires in 30 minutes and can be used once. If you did not request this, you can safely ignore this email — your password has not changed.",
    }),
  });
};

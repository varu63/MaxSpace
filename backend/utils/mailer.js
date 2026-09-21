/* ============================================================
   MAILER UTILITY
   Sends transactional emails (password reset links) over SMTP.
   When SMTP is not configured (e.g. local development), it falls
   back to writing the reset link to a log file so the flow can
   still be exercised without a mail server.
   ============================================================ */

import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const smtpHost = (process.env.SMTP_HOST || "").trim();
const smtpConfigured = Boolean(smtpHost);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    })
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || "MaxSpace <no-reply@maxspace-energy.com>";

/* The SMTP-less dev fallback writes the reset link (which contains the raw
   token) to a log file so the whole reset flow can be exercised locally.
   It is strictly disabled in production: raw reset tokens are never logged. */
const canLogFallback = (process.env.NODE_ENV || "development") !== "production";

/* Persist the reset link to a development log when no SMTP server is
   configured, so the whole reset flow can be tested locally. */
const logResetLink = (email, resetLink) => {
  try {
    const resetsLog = path.join(process.env.TEMP || "/tmp", "maxspace-reset-links.log");
    fs.appendFileSync(
      resetsLog,
      `${new Date().toISOString()} ${email} ${resetLink}\n`
    );
    return resetsLog;
  } catch {
    return null;
  }
};

/* Send a password-reset email. Returns a description of the delivery
   method used ("sent" | "logged") plus any preview/extra info. */
export const sendPasswordResetEmail = async (email, resetLink) => {
  if (!transporter) {
    if (!canLogFallback) {
      throw new Error(
        "Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM to send password reset emails."
      );
    }
    const resetsLog = logResetLink(email, resetLink);
    return {
      method: "logged",
      info: resetsLog
        ? `Reset link written to ${resetsLog} (no SMTP configured).`
        : "Reset link generated (could not log it).",
    };
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your MaxSpace password",
      text: `You requested a password reset for your MaxSpace account.\n\nOpen this link to choose a new password (valid for 30 minutes):\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#16263A">
          <h2 style="color:#173B5C">Reset your MaxSpace password</h2>
          <p>You requested a password reset for your MaxSpace account.</p>
          <p><a href="${resetLink}" style="display:inline-block;background:#173B5C;color:#fff;padding:10px 18px;text-decoration:none;border-radius:8px">Choose a new password</a></p>
          <p style="font-size:12px;color:#747B83">This link expires in 30 minutes. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    return { method: "sent", info, messageId: info.messageId };
  } catch (error) {
    if (!canLogFallback) {
      throw new Error(`Email delivery failed: ${error.message}`);
    }
    // SMTP down — fall back to the log so the flow is still testable (dev only).
    const resetsLog = logResetLink(email, resetLink);
    return {
      method: "logged",
      error: error.message,
      info: resetsLog ? `SMTP failed; reset link written to ${resetsLog}.` : `SMTP failed: ${error.message}`,
    };
  }
};

export const isMailerConfigured = () => Boolean(transporter);

/* Safe connection/auth check for dev tooling. Never echoes the SMTP
   password: it is removed from any error text before being returned. */
export const verifySmtpConnection = async () => {
  if (!transporter) {
    return {
      ok: false,
      alias: "missing-environment-variable",
      reason: "SMTP_HOST is not set. Configure SMTP_HOST/SMTP_USER/SMTP_PASS in backend/.env.",
    };
  }
  try {
    await transporter.verify();
    return { ok: true, alias: "connected", reason: "SMTP connection successful" };
  } catch (error) {
    const secret = String(process.env.SMTP_PASS || "").trim();
    let message = String(error && error.message ? error.message : error);
    if (secret) message = message.split(secret).join("***");
    const lower = message.toLowerCase();
    let alias = "unknown";
    if (/invalid login|authentication failed|535|5\.7\.8|bad credentials|username/i.test(lower)) alias = "authentication-failed";
    else if (/getaddrinfo|enotfound|dns/i.test(lower)) alias = "invalid-smtp-host";
    else if (/econnrefused|connection refused/i.test(lower)) alias = "connection-refused";
    else if (/etimedout|timeout|timed out/i.test(lower)) alias = "timeout";
    else if (/tls|ssl|starttls|certificate/i.test(lower)) alias = "tls-ssl-problem";
    else if (/sender|from address|553|5\.1\.8|mail from/i.test(lower)) alias = "invalid-sender-address";
    else if (/auth|credentials|missing/i.test(lower)) alias = "missing-credentials";
    return { ok: false, alias, reason: message };
  }
};
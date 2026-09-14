/* ============================================================
   GOOGLE AUTH HELPERS
   Verifies Google ID tokens issued by Google Identity Services
   using the official google-auth-library. Only tokens signed
   by Google, issued for OUR OAUTH client, unexpired, and with a
   verified email are accepted — user-submitted profile fields are
   never trusted.
============================================================ */
import { OAuth2Client } from "google-auth-library";
import config from "../config/app.js";

/* Cache the token verifier (it keeps Google's public certs warm). */
let verifier = null;

const getVerifier = () => {
  if (!config.google.clientId) return null;
  if (!verifier) {
    verifier = new OAuth2Client(config.google.clientId);
  }
  return verifier;
};

/* Verify a Google ID token credential.
   Returns the verified Google profile claims, or throws an error. */
export const verifyGoogleIdToken = async (credential) => {
  if (!credential || typeof credential !== "string") {
    const error = new Error("Google sign-in requires a credential token.");
    error.statusCode = 400;
    throw error;
  }

  const client = getVerifier();
  if (!client) {
    const error = new Error(
      "Google sign-in is not configured on this server. Please contact support."
    );
    error.statusCode = 503;
    throw error;
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.google.clientId,
    });
  } catch (verifyError) {
    const error = new Error(
      "We could not verify your Google sign-in. The sign-in may have expired, been cancelled, or used a different account. Please try again."
    );
    error.statusCode = 401;
    throw error;
  }

  const payload = ticket.getPayload();
  if (!payload) {
    const error = new Error("Google returned no profile for this sign-in.");
    error.statusCode = 401;
    throw error;
  }

  // Audience check (must be THIS app's OAuth client).
  if (payload.aud !== config.google.clientId) {
    const error = new Error("Google sign-in was issued for a different application.");
    error.statusCode = 401;
    throw error;
  }

  // Only allow users with a Google-verified email.
  if (!payload.email) {
    const error = new Error("Your Google account has no email address to sign in with.");
    error.statusCode = 400;
    throw error;
  }
  if (payload.email_verified !== true) {
    const error = new Error("Your Google email is not verified and cannot be used to sign in.");
    error.statusCode = 400;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || "",
    avatar: payload.picture || "",
    locale: payload.locale || "",
  };
};

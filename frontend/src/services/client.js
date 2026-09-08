/* ============================================================
   SHARED API CLIENT
   Core fetch wrapper that supports both the customer and admin
   JWT sessions via a token key parameter.
============================================================ */

const BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export const USER_TOKEN_KEY = "maxspace_auth_token";
export const ADMIN_TOKEN_KEY = "maxspace_admin_token";

export const getToken = (key = USER_TOKEN_KEY) => localStorage.getItem(key);

export const setToken = (token, key = USER_TOKEN_KEY) => {
  if (token) localStorage.setItem(key, token);
  else localStorage.removeItem(key);
};

export const getAdminToken = () => getToken(ADMIN_TOKEN_KEY);

export const setAdminToken = (token) => setToken(token, ADMIN_TOKEN_KEY);

export const getErrorMessage = (error) => {
  if (!error) return "Something went wrong.";
  return error.message || "Something went wrong.";
};

/* Core fetch wrapper: attaches JWT, JSON bodies, throws on non-2xx. */
const client = async (path, { method = "GET", body, auth = true, admin = false } = {}) => {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = admin ? getAdminToken() : getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure (backend not running / CORS / offline)
    throw new Error("Cannot reach the server. Please check your connection.");
  }

  // Parse JSON safely (empty or non-JSON responses fall back to null)
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  return data;
};

export default client;

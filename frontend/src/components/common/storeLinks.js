/* ============================================================
   STORE LINKS
   Platform app-store URLs come from Vite env vars so the build
   is not tied to a placeholder. When unset, getStoreLink() returns
   null and the Download buttons hide themselves.
     VITE_IOS_STORE_URL      https://apps.apple.com/app/<id>
     VITE_ANDROID_STORE_URL  https://play.google.com/store/apps/details?id=<pkg>
============================================================ */

const IOS_URL = import.meta.env?.VITE_IOS_STORE_URL || "";
const ANDROID_URL = import.meta.env?.VITE_ANDROID_STORE_URL || "";

export const isStoreLinkConfigured = () => Boolean(IOS_URL || ANDROID_URL);

export const getStoreLink = () => {
  if (!isStoreLinkConfigured()) return null;

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

  if (/ipad|iphone|ipod/i.test(userAgent) && IOS_URL) {
    return IOS_URL;
  }

  return ANDROID_URL || IOS_URL || null;
};
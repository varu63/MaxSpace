const APP_LINKS = {
  android: "https://play.google.com/store/apps/details?id=YOUR_APP_ID",
  ios: "https://apps.apple.com/app/YOUR_APP_ID",
};

export const getStoreLink = () => {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

  if (/android/i.test(userAgent)) {
    return APP_LINKS.android;
  }

  if (/ipad|iphone|ipod/i.test(userAgent)) {
    return APP_LINKS.ios;
  }

  return APP_LINKS.android;
};

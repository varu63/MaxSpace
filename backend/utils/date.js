/* ============================================================
   DATE HELPERS
============================================================ */

export const todayISO = () => new Date().toISOString().split("T")[0];

export const todayMonth = () => new Date().toISOString().slice(0, 7);

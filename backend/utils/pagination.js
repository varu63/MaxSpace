/* ============================================================
   SERVER-SIDE PAGINATION HELPERS
   Single source of truth for parsing/strict-validating page queries
   and shaping the standard pagination envelope used by list routes.

   Query params:
     page=1&limit=20&search=foo&status=Assigned&sort=createdAt&order=asc

   Envelope (all list endpoints):
     {
       success: true,
       data: [...],
       pagination: {
         page, limit, total, totalPages,
         hasNextPage, hasPreviousPage,
         nextPage, previousPage
       }
     }
============================================================ */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/* Parse + validate pagination query params. Never throws — falls
   back to safe defaults with a normalized query object. */
export const parsePagination = (query = {}) => {
  const pageRaw = Number.parseInt(query.page, 10);
  const limitRaw = Number.parseInt(query.limit, 10);

  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : DEFAULT_PAGE;
  let limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const sort = typeof query.sort === "string" ? query.sort.trim() : "";
  const orderRaw = typeof query.order === "string" ? query.order.toLowerCase() : "";
  const order = orderRaw === "desc" ? "desc" : "asc";

  return { page, limit, offset: (page - 1) * limit, sort, order };
};

/* Build the standardized pagination envelope. */
export const buildPagination = (page, limit, total) => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 ? page - 1 : null,
  };
};

/* Case-normalizing substring matcher (used by mock-store sorting /
   filtering so behavior matches postgres ILIKE). */
export const matchesSearch = (value, needle) => {
  if (!needle) return true;
  return String(value ?? "").toLowerCase().includes(String(needle).toLowerCase());
};

/* Sort comparator: respects the requested field, falls back to
   createdAt DESC. Handles numeric, date, and string fields. */
export const compareSorted = (a, b, sortBy, order) => {
  const key = sortBy && sortBy in a ? sortBy : "createdAt";
  const av = a[key];
  const bv = b[key];
  let result = 0;

  if (typeof av === "number" && typeof bv === "number") {
    result = av - bv;
  } else if (
    av instanceof Date ||
    (typeof av === "string" && !Number.isNaN(Date.parse(av))) ||
    bv instanceof Date ||
    (typeof bv === "string" && !Number.isNaN(Date.parse(bv)))
  ) {
    const at = av ? new Date(av).getTime() : 0;
    const bt = bv ? new Date(bv).getTime() : 0;
    result = at - bt;
  } else {
    result = String(av ?? "").localeCompare(String(bv ?? ""));
  }

  return order === "desc" ? -result : result;
};

/* Helpers so list controllers can respond uniformly. */
export const paginateArray = (items, { page, limit }) => {
  const total = items.length;
  const data = items.slice((page - 1) * limit, page * limit);
  return { data, pagination: buildPagination(page, limit, total) };
};
/* Owner isolation applies only to customer (USER) accounts. Operator roles
   (ADMIN / EMPLOYEE) manage the whole production fleet, so they are not
   restricted to batteries they personally own. */
export const ownerScopeFor = (req) =>
  req.user && req.user.role === "USER" ? req.user.id : null;
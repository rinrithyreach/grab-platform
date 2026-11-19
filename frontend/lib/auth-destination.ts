/** Pages a customer may return to after signing in (never an outside URL). */
export const CUSTOMER_RETURN_PAGES = ["/ride", "/rides", "/cart", "/orders"] as const;
export type CustomerReturnPage = (typeof CUSTOMER_RETURN_PAGES)[number];

/** Only local, supported destinations can be used after a sign-in or registration. */
export function authDestination(role: string, search: string): string {
  if (role === "Admin") return "/admin";
  if (role === "Merchant") return "/merchant";
  const next = new URLSearchParams(search).get("next");
  return (CUSTOMER_RETURN_PAGES as readonly (string | null)[]).includes(next) ? next! : "/";
}

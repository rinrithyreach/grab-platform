/** Only local, supported destinations can be used after a sign-in or registration. */
export function authDestination(role: string, search: string): string {
  if (role === "Merchant") return "/merchant";
  const next = new URLSearchParams(search).get("next");
  return next === "/ride" || next === "/rides" ? next : "/";
}

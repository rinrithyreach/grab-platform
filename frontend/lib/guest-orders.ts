/** Only receipt credentials are kept in this tab; contact details stay on the server. */
const KEY = "grab:guest-order-receipts";
type Credential = { id: string; accessToken: string };
let memory: Credential[] = [];

function credentials(): Credential[] {
  try {
    const saved = window.sessionStorage.getItem(KEY);
    if (!saved) return memory;
    const value: unknown = JSON.parse(saved);
    if (Array.isArray(value)) return value.filter((x): x is Credential => x && typeof x.id === "string"
      && typeof x.accessToken === "string" && /^[A-Fa-f0-9]{64}$/.test(x.accessToken)).slice(-20);
  } catch { /* Storage may be disabled; the current page still has an in-memory receipt. */ }
  return memory;
}

export function rememberGuestOrder(id: string, accessToken: string) {
  memory = [...credentials().filter(x => x.id !== id), { id, accessToken }].slice(-20);
  try { window.sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Keep the memory fallback. */ }
}

export function guestOrderToken(id: string): string | null {
  return credentials().find(x => x.id === id)?.accessToken ?? null;
}

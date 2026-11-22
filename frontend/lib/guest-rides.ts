/** Guest ride tracking tokens, kept only for this browser tab. Contact details stay on the server. */
const KEY = "grab:guest-rides";
type Credential = { id: string; accessToken: string };
let memory: Credential[] = [];

function credentials(): Credential[] {
  try {
    const saved = window.sessionStorage.getItem(KEY);
    if (!saved) return memory;
    const value: unknown = JSON.parse(saved);
    if (Array.isArray(value)) return value.filter((x): x is Credential => x && typeof x.id === "string"
      && typeof x.accessToken === "string" && /^[A-Fa-f0-9]{64}$/.test(x.accessToken)).slice(-20);
  } catch { /* Storage may be disabled; the in-memory copy still works on this page. */ }
  return memory;
}

export function rememberGuestRide(id: string, accessToken: string) {
  memory = [...credentials().filter(x => x.id !== id), { id, accessToken }].slice(-20);
  try { window.sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Keep the memory fallback. */ }
}

export function guestRideToken(id: string): string | null {
  return credentials().find(x => x.id === id)?.accessToken ?? null;
}

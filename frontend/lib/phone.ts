/** Phone login: Cambodian local form or an explicit international number. */
export function normalizePhoneNumber(input: string): string | null {
  if (!input.trim() || input.length > 30) return null;
  let phone = input.trim().replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith("0")) phone = `+855${phone.slice(1)}`;
  else if (/^[1-9][0-9]{6,8}$/.test(phone)) phone = `+855${phone}`;
  else if (phone.startsWith("855")) phone = `+${phone}`;
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return null;
  if (phone.startsWith("+855") && !/^\+855[1-9][0-9]{6,8}$/.test(phone)) return null;
  return phone;
}

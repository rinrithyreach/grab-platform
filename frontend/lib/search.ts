/**
 * Forgiving text search used by the Food/Mart search box and the home search.
 * - Ignores upper/lower case
 * - Every word typed must appear somewhere ("pork rice" finds "Grilled Pork Rice")
 * - Plural and singular both match ("burgers" finds "Burger Yard" and "Cheeseburger")
 * - Works for Khmer text too (Khmer has no plurals, so it's a plain "contains" check)
 */

/** "burgers" → "burger", "dishes" → "dish"; short words are left alone. */
function singular(word: string) {
  if (word.length > 4 && word.endsWith("es") && /(ch|sh|x|s|z)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function matchesSearch(query: string, ...texts: (string | undefined)[]) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = texts.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w) || haystack.includes(singular(w)));
}

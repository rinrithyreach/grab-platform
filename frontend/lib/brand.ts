/** Change the app's name/tagline in one place. */
export const BRAND = {
  name: "Grab",
  tagline: "Rides, food and groceries — one tap away.",
};

/** Footer credits. */
export const PROJECT = {
  team: "Group 6",
  year: 2026,
};

/**
 * Social media links shown in the footer.
 * TODO: replace "#" with your group's real page links.
 * To hide one, delete its line.
 */
export const SOCIAL_LINKS = [
  { network: "telegram", label: "Telegram", href: "#" },
  { network: "facebook", label: "Facebook", href: "#" },
  { network: "x", label: "X (Twitter)", href: "#" },
  { network: "instagram", label: "Instagram", href: "#" },
  { network: "tiktok", label: "TikTok", href: "#" },
  { network: "youtube", label: "YouTube", href: "#" },
] as const;

export const DELIVERY_FEE = 1.5;

export function money(value: number) {
  return `$${value.toFixed(2)}`;
}

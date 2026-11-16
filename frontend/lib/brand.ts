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
 * These open each platform's home page. When the group creates its own accounts,
 * replace the link with the page address, e.g. "https://t.me/your_group".
 * To hide one, delete its line.
 */
export const SOCIAL_LINKS = [
  { network: "telegram", label: "Telegram", href: "https://telegram.org" },
  { network: "facebook", label: "Facebook", href: "https://www.facebook.com" },
  { network: "x", label: "X (Twitter)", href: "https://x.com" },
  { network: "instagram", label: "Instagram", href: "https://www.instagram.com" },
  { network: "tiktok", label: "TikTok", href: "https://www.tiktok.com" },
  { network: "youtube", label: "YouTube", href: "https://www.youtube.com" },
] as const;

export const DELIVERY_FEE = 1.5;

export function money(value: number) {
  return `$${value.toFixed(2)}`;
}

/** Change the app's name/tagline in one place. */
export const BRAND = {
  name: "Grab",
  tagline: "Rides, food and groceries — one tap away.",
};

export const DELIVERY_FEE = 1.5;

export function money(value: number) {
  return `$${value.toFixed(2)}`;
}

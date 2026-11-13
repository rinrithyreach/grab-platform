/**
 * Demo catalogue for the Food and Mart sections.
 * The backend has no food/mart endpoints yet; when it does, replace these
 * constants with calls in lib/api.ts and keep the same shapes.
 */
export type StoreKind = "food" | "mart";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  popular?: boolean;
}

export interface Store {
  id: string;
  kind: StoreKind;
  name: string;
  cuisine: string;
  emoji: string;
  rating: number;
  etaMinutes: number;
  priceLevel: 1 | 2 | 3;
  promo?: string;
  items: MenuItem[];
}

export const STORES: Store[] = [
  {
    id: "golden-noodle", kind: "food", name: "Golden Noodle House", cuisine: "Noodles", emoji: "🍜",
    rating: 4.7, etaMinutes: 25, priceLevel: 1, promo: "20% off first order",
    items: [
      { id: "beef-noodle", name: "Beef Noodle Soup", description: "Slow-cooked broth, rice noodles, herbs", price: 3.5, emoji: "🍜", popular: true },
      { id: "fried-noodle", name: "Stir-fried Noodles", description: "Egg noodles, vegetables, soy glaze", price: 3.0, emoji: "🥢" },
      { id: "dumplings", name: "Pork Dumplings (8)", description: "Pan-fried, with chili vinegar", price: 2.75, emoji: "🥟", popular: true },
      { id: "iced-tea", name: "Iced Lemon Tea", description: "Fresh lemon, lightly sweet", price: 1.0, emoji: "🧋" },
    ],
  },
  {
    id: "burger-yard", kind: "food", name: "Burger Yard", cuisine: "Burgers", emoji: "🍔",
    rating: 4.5, etaMinutes: 30, priceLevel: 2,
    items: [
      { id: "classic", name: "Classic Cheeseburger", description: "Beef patty, cheddar, pickles", price: 5.5, emoji: "🍔", popular: true },
      { id: "chicken", name: "Crispy Chicken Burger", description: "Buttermilk chicken, slaw", price: 5.0, emoji: "🍗" },
      { id: "fries", name: "Loaded Fries", description: "Cheese sauce, spring onion", price: 2.5, emoji: "🍟" },
      { id: "shake", name: "Vanilla Milkshake", description: "Thick and creamy", price: 2.25, emoji: "🥤" },
    ],
  },
  {
    id: "rice-bowl", kind: "food", name: "Rice & Co.", cuisine: "Rice dishes", emoji: "🍛",
    rating: 4.6, etaMinutes: 20, priceLevel: 1, promo: "Free delivery",
    items: [
      { id: "pork-rice", name: "Grilled Pork Rice", description: "Charcoal pork, pickles, egg", price: 2.5, emoji: "🍖", popular: true },
      { id: "fried-rice", name: "Shrimp Fried Rice", description: "Wok-fried with garlic", price: 3.25, emoji: "🍤" },
      { id: "curry", name: "Chicken Curry Rice", description: "Mild coconut curry", price: 3.5, emoji: "🍛" },
      { id: "coconut", name: "Fresh Coconut", description: "Served chilled", price: 1.25, emoji: "🥥" },
    ],
  },
  {
    id: "pizza-lab", kind: "food", name: "Pizza Lab", cuisine: "Pizza", emoji: "🍕",
    rating: 4.3, etaMinutes: 35, priceLevel: 2,
    items: [
      { id: "margherita", name: "Margherita", description: "Tomato, mozzarella, basil", price: 7.0, emoji: "🍕", popular: true },
      { id: "pepperoni", name: "Pepperoni", description: "Double pepperoni, oregano", price: 8.0, emoji: "🍕" },
      { id: "garlic-bread", name: "Garlic Bread", description: "Toasted, herb butter", price: 2.0, emoji: "🥖" },
    ],
  },
  {
    id: "sweet-spot", kind: "food", name: "The Sweet Spot", cuisine: "Desserts & Drinks", emoji: "🧁",
    rating: 4.8, etaMinutes: 15, priceLevel: 1, promo: "Buy 2 get 1",
    items: [
      { id: "bubble-tea", name: "Brown Sugar Bubble Tea", description: "Fresh milk, tapioca pearls", price: 2.5, emoji: "🧋", popular: true },
      { id: "cupcake", name: "Chocolate Cupcake", description: "Ganache frosting", price: 1.75, emoji: "🧁" },
      { id: "mango", name: "Mango Sticky Rice", description: "Coconut cream, ripe mango", price: 2.75, emoji: "🥭" },
    ],
  },
  {
    id: "green-bowl", kind: "food", name: "Green Bowl", cuisine: "Healthy", emoji: "🥗",
    rating: 4.4, etaMinutes: 25, priceLevel: 2,
    items: [
      { id: "salad", name: "Chicken Caesar Salad", description: "Romaine, parmesan, croutons", price: 4.5, emoji: "🥗", popular: true },
      { id: "poke", name: "Salmon Poke Bowl", description: "Rice, avocado, edamame", price: 6.5, emoji: "🍣" },
      { id: "smoothie", name: "Berry Smoothie", description: "No added sugar", price: 2.75, emoji: "🫐" },
    ],
  },
  {
    id: "daily-mart", kind: "mart", name: "Daily Mart", cuisine: "Groceries", emoji: "🛒",
    rating: 4.6, etaMinutes: 30, priceLevel: 1,
    items: [
      { id: "milk", name: "Fresh Milk 1L", description: "Full cream", price: 1.8, emoji: "🥛", popular: true },
      { id: "eggs", name: "Eggs (10)", description: "Free-range", price: 2.2, emoji: "🥚" },
      { id: "bread", name: "Sandwich Bread", description: "Soft white loaf", price: 1.5, emoji: "🍞" },
      { id: "bananas", name: "Bananas (1kg)", description: "Locally grown", price: 1.2, emoji: "🍌" },
      { id: "water", name: "Drinking Water 6×1.5L", description: "Pack of six", price: 2.4, emoji: "💧", popular: true },
    ],
  },
  {
    id: "home-plus", kind: "mart", name: "Home Plus", cuisine: "Household", emoji: "🧴",
    rating: 4.2, etaMinutes: 40, priceLevel: 2, promo: "10% off over $20",
    items: [
      { id: "tissue", name: "Tissue Box (3)", description: "Soft 2-ply", price: 2.0, emoji: "🧻" },
      { id: "detergent", name: "Laundry Detergent", description: "2L, fresh scent", price: 4.5, emoji: "🧴", popular: true },
      { id: "soap", name: "Hand Soap", description: "Antibacterial", price: 1.6, emoji: "🧼" },
    ],
  },
];

export function getStore(id: string) {
  return STORES.find((s) => s.id === id);
}

export function getItem(storeId: string, itemId: string) {
  return getStore(storeId)?.items.find((i) => i.id === itemId);
}

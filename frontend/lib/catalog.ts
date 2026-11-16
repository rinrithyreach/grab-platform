/**
 * Demo catalogue for the Food and Mart sections.
 * The backend has no food/mart endpoints yet; when it does, replace these
 * constants with calls in lib/api.ts and keep the same shapes.
 */
import type { Hours } from "./hours";

export type StoreKind = "food" | "mart";

/** A choice on a dish, e.g. "Large (+$1.00)". */
export interface OptionChoice { id: string; name: string; km?: string; price: number }
/**
 * A group of choices: "single" = pick one (radio), "multi" = pick any (checkboxes).
 * Required single groups start on their first choice.
 */
export interface OptionGroup { id: string; name: string; km?: string; type: "single" | "multi"; required?: boolean; choices: OptionChoice[] }

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  popular?: boolean;
  /** Optional choices shown before adding to cart (size, spice, extras...). */
  options?: OptionGroup[];
  /** Khmer translation (optional — falls back to English). */
  km?: { name: string; description: string };
}

/**
 * A store's promotion rule, applied automatically at checkout (see lib/cart.ts).
 * `promo` on the store is just the label shown to users; this is the actual rule.
 */
export type Deal =
  | { type: "freeDelivery" }
  | { type: "percentOff"; percent: number; minSubtotal?: number; firstOrderOnly?: boolean }
  | { type: "buyGetFree"; buy: number; free: number }; // e.g. buy 2 get 1: every 3rd unit of an item is free

/** A store photo and its credit. Photos must be free to use; every one is listed on /credits. */
export interface Photo { src: string; author: string; license: string; source: string }

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
  deal?: Deal;
  /** Optional cover photo; stores without one show their emoji. */
  photo?: Photo;
  /** Opening hours (local time); missing = always open. */
  hours?: Hours;
  /** Where the store is (for the delivery map). */
  location?: { lat: number; lng: number };
  /** Khmer text for cuisine/promo; store names stay as brand names. */
  km?: { cuisine: string; promo?: string };
  items: MenuItem[];
}

export const STORES: Store[] = [
  {
    id: "golden-noodle", kind: "food", name: "Golden Noodle House", cuisine: "Noodles", emoji: "🍜",
    photo: { src: "/images/stores/golden-noodle.jpg", author: "Peachyeung316", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:A_Bowl_of_Beef_Noodle_Soup_from_The_Modern_Shanghai.jpg" },
    rating: 4.7, etaMinutes: 25, priceLevel: 1, promo: "20% off first order", deal: { type: "percentOff", percent: 20, firstOrderOnly: true },
    km: { cuisine: "មី និងគុយទាវ", promo: "បញ្ចុះ ២០% លើការបញ្ជាទិញដំបូង" },
    items: [
      { id: "beef-noodle", name: "Beef Noodle Soup", description: "Slow-cooked broth, rice noodles, herbs", price: 3.5, emoji: "🍜", popular: true, km: { name: "គុយទាវសាច់គោ", description: "ទឹកស៊ុបរំងាស់យូរ គុយទាវ និងជីរ" } },
      { id: "fried-noodle", name: "Stir-fried Noodles", description: "Egg noodles, vegetables, soy glaze", price: 3.0, emoji: "🥢", km: { name: "មីឆា", description: "មីពង បន្លែ និងទឹកស៊ីអ៊ីវ" } },
      { id: "dumplings", name: "Pork Dumplings (8)", description: "Pan-fried, with chili vinegar", price: 2.75, emoji: "🥟", popular: true, km: { name: "នំប៉ាវចៀនសាច់ជ្រូក (៨)", description: "ចៀនក្នុងខ្ទះ ជាមួយទឹកខ្មេះម្ទេស" } },
      { id: "iced-tea", name: "Iced Lemon Tea", description: "Fresh lemon, lightly sweet", price: 1.0, emoji: "🧋", km: { name: "តែក្រូចឆ្មាទឹកកក", description: "ក្រូចឆ្មាស្រស់ ផ្អែមល្មម" } },
    ],
  },
  {
    id: "burger-yard", kind: "food", name: "Burger Yard", cuisine: "Burgers", emoji: "🍔",
    photo: { src: "/images/stores/burger-yard.jpg", author: "Acabashi", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Cheeseburger_with_onions_at_Hatfield_Heath_Festival_2017.jpg" },
    rating: 4.5, etaMinutes: 30, priceLevel: 2,
    km: { cuisine: "ប៊ឺហ្គឺ" },
    items: [
      { id: "classic", name: "Classic Cheeseburger", description: "Beef patty, cheddar, pickles", price: 5.5, emoji: "🍔", popular: true, km: { name: "ឈីសប៊ឺហ្គឺ", description: "សាច់គោ ឈីស និងត្រសក់ជ្រក់" } },
      { id: "chicken", name: "Crispy Chicken Burger", description: "Buttermilk chicken, slaw", price: 5.0, emoji: "🍗", km: { name: "ប៊ឺហ្គឺសាច់មាន់បំពង", description: "សាច់មាន់បំពងស្រួយ និងសាឡាត់ស្ពៃ" } },
      { id: "fries", name: "Loaded Fries", description: "Cheese sauce, spring onion", price: 2.5, emoji: "🍟", km: { name: "ដំឡូងបំពងឈីស", description: "ទឹកជ្រលក់ឈីស និងស្លឹកខ្ទឹម" } },
      { id: "shake", name: "Vanilla Milkshake", description: "Thick and creamy", price: 2.25, emoji: "🥤", km: { name: "មីលសេកវ៉ានីឡា", description: "ខាប់ និងក្រៀម" } },
    ],
  },
  {
    id: "rice-bowl", kind: "food", name: "Rice & Co.", cuisine: "Rice dishes", emoji: "🍛",
    photo: { src: "/images/stores/rice-bowl.jpg", author: "Vee Satayamas from Bangkok, Thailand", license: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Fried_rice_with_chicken_(17234644521).jpg" },
    rating: 4.6, etaMinutes: 20, priceLevel: 1, promo: "Free delivery", deal: { type: "freeDelivery" },
    km: { cuisine: "មុខម្ហូបបាយ", promo: "ដឹកជូនឥតគិតថ្លៃ" },
    items: [
      { id: "pork-rice", name: "Grilled Pork Rice", description: "Charcoal pork, pickles, egg", price: 2.5, emoji: "🍖", popular: true, km: { name: "បាយសាច់ជ្រូក", description: "សាច់ជ្រូកអាំងធ្យូង ជ្រក់ និងពង" } },
      { id: "fried-rice", name: "Shrimp Fried Rice", description: "Wok-fried with garlic", price: 3.25, emoji: "🍤", km: { name: "បាយឆាបង្គា", description: "ឆាជាមួយខ្ទឹមស" } },
      { id: "curry", name: "Chicken Curry Rice", description: "Mild coconut curry", price: 3.5, emoji: "🍛", km: { name: "បាយការីសាច់មាន់", description: "ការីខ្ទិះដូង មិនសូវហឹរ" } },
      { id: "coconut", name: "Fresh Coconut", description: "Served chilled", price: 1.25, emoji: "🥥", km: { name: "ដូងស្រស់", description: "ក្លាសេ" } },
    ],
  },
  {
    id: "pizza-lab", kind: "food", name: "Pizza Lab", cuisine: "Pizza", emoji: "🍕",
    photo: { src: "/images/stores/pizza-lab.jpg", author: "Mario56", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Margherita_Originale.JPG" },
    rating: 4.3, etaMinutes: 35, priceLevel: 2,
    km: { cuisine: "ភីហ្សា" },
    items: [
      { id: "margherita", name: "Margherita", description: "Tomato, mozzarella, basil", price: 7.0, emoji: "🍕", popular: true, km: { name: "ភីហ្សាម៉ាហ្គារីតា", description: "ប៉េងប៉ោះ ឈីសម៉ូហ្សារ៉ែឡា និងជីរនាងវង" } },
      { id: "pepperoni", name: "Pepperoni", description: "Double pepperoni, oregano", price: 8.0, emoji: "🍕", km: { name: "ភីហ្សាប៉េប៉េរ៉ូនី", description: "ប៉េប៉េរ៉ូនីទ្វេដង" } },
      { id: "garlic-bread", name: "Garlic Bread", description: "Toasted, herb butter", price: 2.0, emoji: "🥖", km: { name: "នំបុ័ងខ្ទឹមស", description: "អាំង ជាមួយប៊័រជីរ" } },
    ],
  },
  {
    id: "sweet-spot", kind: "food", name: "The Sweet Spot", cuisine: "Desserts & Drinks", emoji: "🧁",
    photo: { src: "/images/stores/sweet-spot.jpg", author: "Battlesnake1", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Pearl_Milk_Tea_in_Chun_Shui_Tang.jpg" },
    rating: 4.8, etaMinutes: 15, priceLevel: 1, promo: "Buy 2 get 1", deal: { type: "buyGetFree", buy: 2, free: 1 },
    km: { cuisine: "បង្អែម និងភេសជ្ជៈ", promo: "ទិញ ២ ថែម ១" },
    items: [
      { id: "bubble-tea", name: "Brown Sugar Bubble Tea", description: "Fresh milk, tapioca pearls", price: 2.5, emoji: "🧋", popular: true, km: { name: "តែទឹកដោះគោស្ករត្នោត", description: "ទឹកដោះគោស្រស់ និងគ្រាប់ត្ងៃ" } },
      { id: "cupcake", name: "Chocolate Cupcake", description: "Ganache frosting", price: 1.75, emoji: "🧁", km: { name: "នំខាប់ខេកសូកូឡា", description: "ក្រែមសូកូឡា" } },
      { id: "mango", name: "Mango Sticky Rice", description: "Coconut cream, ripe mango", price: 2.75, emoji: "🥭", km: { name: "បាយដំណើបស្វាយ", description: "ខ្ទិះដូង និងស្វាយទុំ" } },
    ],
  },
  {
    id: "green-bowl", kind: "food", name: "Green Bowl", cuisine: "Healthy", emoji: "🥗",
    photo: { src: "/images/stores/green-bowl.jpg", author: "Andy Li", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Caesar_Salad_-_Purezza_2023-11-22.jpg" },
    rating: 4.4, etaMinutes: 25, priceLevel: 2,
    km: { cuisine: "អាហារសុខភាព" },
    items: [
      { id: "salad", name: "Chicken Caesar Salad", description: "Romaine, parmesan, croutons", price: 4.5, emoji: "🥗", popular: true, km: { name: "សាឡាត់សាច់មាន់", description: "សាឡាដ ឈីស និងនំបុ័ងស្រួយ" } },
      { id: "poke", name: "Salmon Poke Bowl", description: "Rice, avocado, edamame", price: 6.5, emoji: "🍣", km: { name: "បាយត្រីសាលម៉ុន", description: "បាយ ផ្លែប័រ និងសណ្ដែក" } },
      { id: "smoothie", name: "Berry Smoothie", description: "No added sugar", price: 2.75, emoji: "🫐", km: { name: "ទឹកក្រឡុកផ្លែប៊ឺរី", description: "គ្មានស្ករបន្ថែម" } },
    ],
  },
  {
    id: "daily-mart", kind: "mart", name: "Daily Mart", cuisine: "Groceries", emoji: "🛒",
    rating: 4.6, etaMinutes: 30, priceLevel: 1,
    km: { cuisine: "ទំនិញប្រចាំថ្ងៃ" },
    items: [
      { id: "milk", name: "Fresh Milk 1L", description: "Full cream", price: 1.8, emoji: "🥛", popular: true, km: { name: "ទឹកដោះគោស្រស់ ១លីត្រ", description: "ជាតិខ្លាញ់ពេញ" } },
      { id: "eggs", name: "Eggs (10)", description: "Free-range", price: 2.2, emoji: "🥚", km: { name: "ពងមាន់ (១០)", description: "មាន់ចិញ្ចឹមសេរី" } },
      { id: "bread", name: "Sandwich Bread", description: "Soft white loaf", price: 1.5, emoji: "🍞", km: { name: "នំបុ័ងសាំងវិច", description: "ទន់ ពណ៌ស" } },
      { id: "bananas", name: "Bananas (1kg)", description: "Locally grown", price: 1.2, emoji: "🍌", km: { name: "ចេក (១គ.ក)", description: "ដាំក្នុងស្រុក" } },
      { id: "water", name: "Drinking Water 6×1.5L", description: "Pack of six", price: 2.4, emoji: "💧", popular: true, km: { name: "ទឹកសុទ្ធ ៦×១.៥លីត្រ", description: "មួយកញ្ចប់ ៦ដប" } },
    ],
  },
  {
    id: "home-plus", kind: "mart", name: "Home Plus", cuisine: "Household", emoji: "🧴",
    rating: 4.2, etaMinutes: 40, priceLevel: 2, promo: "10% off over $20", deal: { type: "percentOff", percent: 10, minSubtotal: 20 },
    km: { cuisine: "របស់ប្រើប្រាស់ក្នុងផ្ទះ", promo: "បញ្ចុះ ១០% ពេលទិញលើស $20" },
    items: [
      { id: "tissue", name: "Tissue Box (3)", description: "Soft 2-ply", price: 2.0, emoji: "🧻", km: { name: "ក្រដាសអនាម័យ (៣ប្រអប់)", description: "ទន់ ២ស្រទាប់" } },
      { id: "detergent", name: "Laundry Detergent", description: "2L, fresh scent", price: 4.5, emoji: "🧴", popular: true, km: { name: "ទឹកសាប៊ូបោកខោអាវ", description: "២លីត្រ ក្លិនក្រអូប" } },
      { id: "soap", name: "Hand Soap", description: "Antibacterial", price: 1.6, emoji: "🧼", km: { name: "សាប៊ូលាងដៃ", description: "សម្លាប់មេរោគ" } },
    ],
  },
];

export function getStore(id: string) {
  return STORES.find((s) => s.id === id);
}

export function getItem(storeId: string, itemId: string) {
  return getStore(storeId)?.items.find((i) => i.id === itemId);
}

// ---------- Item options (size, spice, extras) ----------
// Kept separate so the menu above stays easy to read. Keys are "storeId/itemId".

const SPICE: OptionGroup = {
  id: "spice", name: "Spice level", km: "កម្រិតហឹរ", type: "single", required: true,
  choices: [
    { id: "none", name: "Not spicy", km: "មិនហឹរ", price: 0 },
    { id: "mild", name: "Mild", km: "ហឹរតិច", price: 0 },
    { id: "hot", name: "Hot 🌶️", km: "ហឹរខ្លាំង 🌶️", price: 0 },
  ],
};
const EGG = { id: "egg", name: "Fried egg", km: "ពងមាន់ចៀន", price: 0.5 };

const ITEM_OPTIONS: Record<string, OptionGroup[]> = {
  "golden-noodle/beef-noodle": [
    { id: "size", name: "Size", km: "ទំហំ", type: "single", required: true, choices: [
      { id: "regular", name: "Regular", km: "ធម្មតា", price: 0 },
      { id: "large", name: "Large", km: "ធំ", price: 1 },
    ] },
    SPICE,
    { id: "extras", name: "Extras", km: "បន្ថែម", type: "multi", choices: [
      { id: "beef", name: "Extra beef", km: "សាច់គោបន្ថែម", price: 1.5 },
      { id: "egg", name: "Soft-boiled egg", km: "ពងមាន់ស្ងោរ", price: 0.5 },
    ] },
  ],
  "golden-noodle/fried-noodle": [SPICE, { id: "extras", name: "Extras", km: "បន្ថែម", type: "multi", choices: [EGG] }],
  "burger-yard/classic": [
    { id: "extras", name: "Extras", km: "បន្ថែម", type: "multi", choices: [
      { id: "cheese", name: "Extra cheese", km: "ឈីសបន្ថែម", price: 0.75 },
      { id: "bacon", name: "Bacon", km: "សាច់ជ្រូកបីជាន់ក្រៀម", price: 1 },
      { id: "nopickle", name: "No pickles", km: "មិនដាក់ត្រសក់ជ្រក់", price: 0 },
    ] },
  ],
  "rice-bowl/pork-rice": [
    { id: "extras", name: "Extras", km: "បន្ថែម", type: "multi", choices: [
      EGG,
      { id: "pork", name: "Extra pork", km: "សាច់ជ្រូកបន្ថែម", price: 1 },
    ] },
  ],
  "rice-bowl/fried-rice": [SPICE],
  "pizza-lab/margherita": [
    { id: "size", name: "Size", km: "ទំហំ", type: "single", required: true, choices: [
      { id: "10", name: "10 inch", km: "១០ អ៊ីញ", price: 0 },
      { id: "12", name: "12 inch", km: "១២ អ៊ីញ", price: 2 },
      { id: "14", name: "14 inch", km: "១៤ អ៊ីញ", price: 4 },
    ] },
  ],
  "pizza-lab/pepperoni": [
    { id: "size", name: "Size", km: "ទំហំ", type: "single", required: true, choices: [
      { id: "10", name: "10 inch", km: "១០ អ៊ីញ", price: 0 },
      { id: "12", name: "12 inch", km: "១២ អ៊ីញ", price: 2 },
      { id: "14", name: "14 inch", km: "១៤ អ៊ីញ", price: 4 },
    ] },
  ],
  "sweet-spot/bubble-tea": [
    { id: "size", name: "Size", km: "ទំហំ", type: "single", required: true, choices: [
      { id: "m", name: "Medium", km: "មធ្យម", price: 0 },
      { id: "l", name: "Large", km: "ធំ", price: 0.5 },
    ] },
    { id: "sugar", name: "Sugar", km: "ស្ករ", type: "single", required: true, choices: [
      { id: "100", name: "100% sugar", km: "ស្ករ ១០០%", price: 0 },
      { id: "50", name: "50% sugar", km: "ស្ករ ៥០%", price: 0 },
      { id: "0", name: "No sugar", km: "គ្មានស្ករ", price: 0 },
    ] },
    { id: "toppings", name: "Toppings", km: "គ្រឿងបន្ថែម", type: "multi", choices: [
      { id: "pearls", name: "Extra pearls", km: "គ្រាប់ត្ងៃបន្ថែម", price: 0.3 },
      { id: "pudding", name: "Pudding", km: "ពុឌីង", price: 0.5 },
    ] },
  ],
  "green-bowl/salad": [
    { id: "extras", name: "Extras", km: "បន្ថែម", type: "multi", choices: [
      { id: "chicken", name: "Extra chicken", km: "សាច់មាន់បន្ថែម", price: 1.5 },
      { id: "egg", name: "Boiled egg", km: "ពងមាន់ស្ងោរ", price: 0.5 },
    ] },
  ],
};

for (const store of STORES) {
  for (const item of store.items) {
    const options = ITEM_OPTIONS[`${store.id}/${item.id}`];
    if (options) item.options = options;
  }
}

// ---------- Opening hours ----------
// Rice & Co. is lunch-only on purpose, so the "Closed" state can be seen in a demo.
const HOURS: Record<string, Hours> = {
  "golden-noodle": { open: "06:00", close: "21:00" },
  "burger-yard": { open: "10:00", close: "23:00" },
  "rice-bowl": { open: "06:00", close: "14:00" },
  "pizza-lab": { open: "11:00", close: "23:30" },
  "sweet-spot": { open: "09:00", close: "22:00" },
  "green-bowl": { open: "07:30", close: "20:00" },
  "daily-mart": { open: "00:00", close: "24:00" },
  "home-plus": { open: "08:00", close: "21:00" },
};
for (const store of STORES) store.hours = HOURS[store.id];

// ---------- Store locations (demo, around central Phnom Penh) ----------
const LOCATIONS: Record<string, { lat: number; lng: number }> = {
  "golden-noodle": { lat: 11.5681, lng: 104.9189 },
  "burger-yard": { lat: 11.5552, lng: 104.9248 },
  "rice-bowl": { lat: 11.5449, lng: 104.9165 },
  "pizza-lab": { lat: 11.5603, lng: 104.9302 },
  "sweet-spot": { lat: 11.5498, lng: 104.9281 },
  "green-bowl": { lat: 11.5627, lng: 104.9225 },
  "daily-mart": { lat: 11.5574, lng: 104.9137 },
  "home-plus": { lat: 11.5488, lng: 104.9339 },
};
for (const store of STORES) store.location = LOCATIONS[store.id];

import type { MerchantServiceKind } from "./api";
import type { Lang } from "./settings-script";

// These are the English sample GrabFood listings already published in the local database.
// Match the description as well as the title so edited merchant copy is never replaced by stale text.
const SAMPLE_FOOD: Record<string, { en: string; title: string; description: string }> = {
  "Chocolate Lava Cake": {
    en: "Warm chocolate cake with a molten centre and vanilla ice cream.",
    title: "នំសូកូឡាហូរខាងក្នុង",
    description: "នំសូកូឡាក្ដៅ មានសូកូឡារាវនៅកណ្ដាល និងការ៉េមវ៉ានីឡា។",
  },
  "Chicken Fried Rice": {
    en: "Jasmine rice fried with chicken, egg, vegetables and soy.",
    title: "បាយឆាមាន់",
    description: "បាយម្លិះឆាជាមួយសាច់មាន់ ស៊ុត បន្លែ និងទឹកស៊ីអ៊ីវ។",
  },
  "Khmer Pork & Rice (Bai Sach Chrouk)": {
    en: "Grilled marinated pork over broken rice with pickles and egg.",
    title: "បាយសាច់ជ្រូក",
    description: "សាច់ជ្រូកប្រឡាក់អាំងលើបាយកិន ជាមួយជ្រក់ និងស៊ុត។",
  },
  "Pepperoni Pizza": {
    en: "Loaded with pepperoni and mozzarella, baked until crispy.",
    title: "ភីហ្សាផេបភើរ៉ូនី",
    description: "ភីហ្សាដាក់សាច់ផេបភើរ៉ូនី និងឈីសម៉ូហ្សារ៉េឡា ដុតរហូតក្រួយ។",
  },
  "Margherita Pizza": {
    en: "Tomato sauce, mozzarella and fresh basil on a thin crust.",
    title: "ភីហ្សាម៉ាហ្គារីតា",
    description: "ទឹកជ្រលក់ប៉េងប៉ោះ ឈីសម៉ូហ្សារ៉េឡា និងជីរនាងវងស្រស់លើនំស្ដើង។",
  },
  "Fresh Garden Salad Bowl": {
    en: "Mixed greens, cucumber, cherry tomatoes, avocado and lime dressing.",
    title: "សាឡាត់បន្លែស្រស់",
    description: "បន្លែបៃតងចម្រុះ ត្រសក់ ប៉េងប៉ោះតូច ផ្លែប័រ និងទឹកសាឡាត់ក្រូចឆ្មារ។",
  },
  "Stir-fried Lo Mein": {
    en: "Wok-tossed egg noodles with vegetables and soy-garlic sauce.",
    title: "មីឆាឡូម៉ីន",
    description: "មីពងឆាក្នុងខ្ទះជាមួយបន្លែ និងទឹកជ្រលក់ស៊ីអ៊ីវខ្ទឹមស។",
  },
  "Beef Noodle Soup": {
    en: "Slow-cooked beef broth with rice noodles, herbs and tender beef slices.",
    title: "គុយទាវសាច់គោ",
    description: "ទឹកស៊ុបសាច់គោរំងាស់យូរ ជាមួយគុយទាវ ជីរ និងសាច់គោទន់។",
  },
  "Crispy Chicken Burger": {
    en: "Crunchy fried chicken fillet with spicy mayo and pickles.",
    title: "ប៊ឺហ្គឺមាន់បំពងក្រួយ",
    description: "សាច់មាន់បំពងក្រួយជាមួយម៉ាយ៉ូហឹរ និងត្រសក់ជ្រក់។",
  },
  "Classic Beef Burger": {
    en: "Grilled beef patty, cheddar, lettuce, tomato and house sauce on a toasted bun.",
    title: "ប៊ឺហ្គឺសាច់គោបែបបុរាណ",
    description: "សាច់គោអាំង ឈីសឆេដដា សាឡាត់ ប៉េងប៉ោះ និងទឹកជ្រលក់ពិសេសក្នុងនំប៉័ងអាំង។",
  },
};

export function merchantProductText(title: string, description: string, service: MerchantServiceKind, lang: Lang) {
  const translation = service === "GrabFood" && lang === "km" ? SAMPLE_FOOD[title] : undefined;
  return translation && description === translation.en
    ? { title: translation.title, description: translation.description }
    : { title, description };
}

export function merchantProductTitle(title: string, lang: Lang, service?: MerchantServiceKind) {
  return lang === "km" && (!service || service === "GrabFood") ? SAMPLE_FOOD[title]?.title ?? title : title;
}

export function merchantBusinessDescription(name: string, description: string, service: MerchantServiceKind, lang: Lang) {
  return service === "GrabFood" && lang === "km" && name === "Aeon Mart" && description === "Aeon Mart Foods"
    ? "អាហារពី Aeon Mart" : description;
}

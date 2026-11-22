export type PromotionKind = "amount" | "percent" | "freeDelivery" | "buyGetFree";
export interface Promotion {
  id: string; name: string; code: string | null; kind: PromotionKind; value: number;
  minSubtotal: number; maxDiscount: number | null; buyQuantity: number; freeQuantity: number;
  storeId: string | null; productId: string | null; firstOrderOnly: boolean; isActive: boolean;
  startsAt: string | null; endsAt: string | null; updatedAt?: string;
}
export type SavePromotion = Omit<Promotion, "id" | "updatedAt"> & { reason: string };
export interface PromotionTarget { storeId: string; storeName: string; productId: string; productName: string }
export interface PromotionLine { productId: string; price: number; qty: number }

const seed = (n: number, name: string, fields: Partial<Promotion>): Promotion => ({
  id: `60000000-0000-0000-0000-${String(n).padStart(12, "0")}`, name, code: null, kind: "percent", value: 0,
  minSubtotal: 0, maxDiscount: null, buyQuantity: 2, freeQuantity: 1, storeId: null, productId: null,
  firstOrderOnly: false, isActive: true, startsAt: null, endsAt: null, ...fields,
});
/** Initial demo offers. Once the API responds, its complete list replaces these, including an empty list. */
export const DEFAULT_PROMOTIONS: Promotion[] = [
  seed(1, "$1 off orders of $3+", { code: "GROUP6", kind: "amount", value: 1, minSubtotal: 3 }),
  seed(2, "10% off, up to $3", { code: "WELCOME10", value: 10, maxDiscount: 3 }),
  seed(3, "Free delivery", { code: "FREESHIP", kind: "freeDelivery" }),
  seed(4, "20% off first order", { storeId: "golden-noodle", value: 20, firstOrderOnly: true }),
  seed(5, "Free delivery", { storeId: "rice-bowl", kind: "freeDelivery" }),
  seed(6, "Buy 2 get 1", { storeId: "sweet-spot", kind: "buyGetFree" }),
  seed(7, "10% off over $20", { storeId: "home-plus", value: 10, minSubtotal: 20 }),
];
let current = DEFAULT_PROMOTIONS;
// Updated by API effects, never by a render. Keeps prerenders and hydration deterministic.
let currentTime = 0;
const listeners = new Set<() => void>();
export const getPromotionRules = () => current;
export const subscribePromotions = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setPromotionRules(rules: Promotion[]) {
  currentTime = Date.now();
  current = rules;
  listeners.forEach(listener => listener());
}
export function promotionStatus(p: Promotion, now = currentTime): "Active" | "Paused" | "Scheduled" | "Expired" {
  if (!p.isActive) return "Paused";
  if (p.endsAt && Date.parse(p.endsAt) <= now) return "Expired";
  if (p.startsAt && Date.parse(p.startsAt) > now) return "Scheduled";
  return "Active";
}
export function matchesPromotion(p: Promotion, storeId: string, lines: PromotionLine[]) {
  return (!p.storeId || p.storeId === storeId) && lines.some(l => !p.productId || p.productId === l.productId);
}
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Shared display calculator. Merchant orders are independently validated and priced by the API. */
export function promotionTotals(storeId: string, lines: PromotionLine[], rawCode?: string, firstOrder = true, fee = 1.5, rules = current, now = currentTime) {
  const subtotal = round(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const active = rules.filter(p => promotionStatus(p, now) === "Active" && matchesPromotion(p, storeId, lines));
  const eligible = (p: Promotion) => (!p.firstOrderOnly || firstOrder) && subtotal >= p.minSubtotal;
  const amount = (p: Promotion, remaining: number, reduction = 0) => {
    const items = lines.filter(l => !p.productId || l.productId === p.productId);
    const basis = round(Math.max(0, Math.min(remaining, items.reduce((sum, l) => sum + l.price * l.qty, 0) - reduction)));
    let value = p.kind === "amount" ? p.value : p.kind === "percent" ? round(basis * p.value / 100) : 0;
    if (p.kind === "buyGetFree") {
      const groups = new Map<string, { qty: number; price: number }>();
      items.forEach(l => { const g = groups.get(l.productId); groups.set(l.productId, { qty: (g?.qty ?? 0) + l.qty, price: Math.min(g?.price ?? Infinity, l.price) }); });
      value = [...groups.values()].reduce((sum, g) => sum + Math.floor(g.qty / (p.buyQuantity + p.freeQuantity)) * p.freeQuantity * g.price, 0);
    }
    return round(Math.min(basis, value, p.maxDiscount ?? Infinity));
  };
  const automatic = active.filter(p => !p.code && eligible(p));
  const best = automatic.reduce<Promotion | undefined>((best, p) => !best || amount(p, subtotal) > amount(best, subtotal) ? p : best, undefined);
  const discount = best ? amount(best, subtotal) : 0;
  const shipping = automatic.find(p => p.kind === "freeDelivery");
  let deliveryFee = lines.length && !shipping ? fee : 0;
  const entered = rawCode?.trim().toUpperCase();
  const code = entered ? active.find(p => p.code === entered) : undefined;
  const codeValid = !!code && eligible(code);
  const automaticBasis = best ? lines.filter(l => !best.productId || best.productId === l.productId).reduce((sum, l) => sum + l.price * l.qty, 0) : 0;
  const overlap = best && code ? lines.filter(l => (!best.productId || best.productId === l.productId) && (!code.productId || code.productId === l.productId)).reduce((sum, l) => sum + l.price * l.qty, 0) : 0;
  const codeDiscount = code && codeValid ? amount(code, subtotal - discount, automaticBasis > 0 ? discount * overlap / automaticBasis : 0) : 0;
  if (codeValid && code?.kind === "freeDelivery") deliveryFee = 0;
  return { subtotal, discount, codeDiscount, deliveryFee, total: round(subtotal - discount - codeDiscount + deliveryFee),
    promoCode: entered || undefined, codeValid, code,
    codeError: !entered || codeValid ? null : code && !eligible(code) && subtotal < code.minSubtotal ? "minSpend" as const : "invalid" as const,
    promotionLabel: [discount > 0 ? best?.name : undefined, shipping?.name].filter(Boolean).join(" · "),
    promotion: best,
  };
}

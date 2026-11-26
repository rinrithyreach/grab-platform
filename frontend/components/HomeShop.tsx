"use client";

/**
 * Storefront sections for the home page: shop by category, today's deals,
 * best sellers with quick add, promo banners and the trust strip.
 * Everything is built from the demo catalogue in lib/catalog.ts.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { money } from "@/lib/brand";
import { STORES, type MenuItem, type Store } from "@/lib/catalog";
import { addToCart, lineKey, setQty, useShop } from "@/lib/cart";
import { askReplaceCart, withReplaceConfirm } from "@/lib/dialog";
import { useNow } from "@/lib/clock";
import { isOpenAt } from "@/lib/hours";
import { useT } from "@/lib/i18n";
import { useStoreReviews } from "@/lib/reviews";
import { toast } from "@/lib/toast";
import Icon, { type IconName } from "./Icon";
import ItemOptionsDialog from "./ItemOptionsDialog";

const FOOD = STORES.filter((s) => s.kind === "food");

/** One tile per cuisine in the catalogue, so every category has results. */
const CUISINES = [...new Map(FOOD.map((s) => [s.cuisine, s])).values()].map((s) => ({
  key: s.cuisine,
  en: s.cuisine,
  km: s.km?.cuisine,
  emoji: s.emoji,
  count: FOOD.filter((x) => x.cuisine === s.cuisine).length,
}));

const DEALS = FOOD.filter((s) => s.promo);

/** Desktop columns for the deals grid, so a short list never leaves an empty slot. */
const DEAL_COLS = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"][Math.min(DEALS.length, 4)];

/** Popular dishes first, topped up with other dishes so the grid always fills whole rows (8 = 2×4 = 4×2). */
const BEST_SELLERS = [
  ...FOOD.flatMap((store) => store.items.filter((item) => item.popular).map((item) => ({ store, item }))),
  ...[...FOOD].sort((a, b) => b.rating - a.rating).flatMap((store) => store.items.filter((item) => !item.popular).map((item) => ({ store, item }))),
].slice(0, 8);

function SectionHead({ id, eyebrow, title, href }: { id?: string; eyebrow?: string; title: string; href?: string }) {
  const { t } = useT();
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">{eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}<h2 id={id} className="text-2xl font-bold">{title}</h2></div>
      {href && <Link href={href} className="-my-2 shrink-0 py-2 text-sm font-semibold text-brand">{t("home.seeAll")}</Link>}
    </div>
  );
}

/* ---------- Shop by category ---------- */

/**
 * Plays a staggered entrance (CSS `.shop-cat-list[data-reveal]`) when the list scrolls into view.
 * A list already on screen when the page loads is left as it is, so nothing flickers.
 */
function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;
    el.dataset.reveal = "pending";
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      el.dataset.reveal = "in";
      observer.disconnect();
    }, { rootMargin: "0px 0px -8% 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function ShopByCategory() {
  const { pick } = useT();
  const listRef = useRevealOnScroll<HTMLUListElement>();
  const order = (i: number) => ({ "--i": i }) as CSSProperties;
  return (
    <section className="shop-categories mx-auto mt-9 max-w-6xl px-4" aria-labelledby="shop-cat-title">
      <SectionHead id="shop-cat-title" title={pick("Shop by category", "ទិញតាមប្រភេទ")} href="/food" />
      <ul ref={listRef} className="shop-cat-list rail-scroll -mx-4 mt-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 pt-1 lg:mx-0 lg:grid lg:grid-cols-8 lg:gap-4 lg:overflow-visible lg:px-0">
        {CUISINES.map((c, i) => (
          <li key={c.key} className="snap-start" style={order(i)}>
            <Link href={`/food?category=${encodeURIComponent(c.key)}`} className="shop-cat group flex w-[84px] flex-col items-center gap-2 text-center lg:w-auto">
              <span className="shop-cat-icon grid h-[72px] w-[72px] place-items-center rounded-3xl bg-surface text-[34px] lg:h-20 lg:w-20" aria-hidden><span className="inline-block">{c.emoji}</span></span>
              <span className="w-full">
                <span className="block truncate text-xs font-semibold sm:text-sm">{pick(c.en, c.km)}</span>
                <span className="block text-[10px] text-muted sm:text-xs">{pick(`${c.count} ${c.count === 1 ? "store" : "stores"}`, `${c.count} ហាង`)}</span>
              </span>
            </Link>
          </li>
        ))}
        <li className="snap-start" style={order(CUISINES.length)}>
          <Link href="/express" className="shop-cat group flex w-[84px] flex-col items-center gap-2 text-center lg:w-auto">
            <span className="shop-cat-icon grid h-[72px] w-[72px] place-items-center rounded-3xl bg-surface text-[#6079b4] lg:h-20 lg:w-20" aria-hidden><Icon name="store" className="h-8 w-8" /></span>
            <span className="w-full"><span className="block truncate text-xs font-semibold sm:text-sm">{pick("Shop", "ទំនិញ")}</span><span className="block text-[10px] text-muted sm:text-xs">{pick("Local merchants", "អាជីវករក្នុងស្រុក")}</span></span>
          </Link>
        </li>
        <li className="snap-start" style={order(CUISINES.length + 1)}>
          <Link href="/express" className="shop-cat group flex w-[84px] flex-col items-center gap-2 text-center lg:w-auto">
            <span className="shop-cat-icon grid h-[72px] w-[72px] place-items-center rounded-3xl bg-surface text-[#b58221] lg:h-20 lg:w-20" aria-hidden><Icon name="parcel" className="h-8 w-8" /></span>
            <span className="w-full"><span className="block truncate text-xs font-semibold sm:text-sm">{pick("Parcels", "កញ្ចប់ឥវ៉ាន់")}</span><span className="block text-[10px] text-muted sm:text-xs">{pick("Same-day", "ក្នុងថ្ងៃតែមួយ")}</span></span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/* ---------- Today's deals ---------- */

/** Time left until local midnight, ticking every second once the page is in the browser. */
function useMidnightCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const update = () => { const end = new Date(); end.setHours(24, 0, 0, 0); setLeft(Math.max(0, end.getTime() - Date.now())); };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);
  return left;
}

function Countdown() {
  const { pick } = useT();
  const left = useMidnightCountdown();
  const parts = left === null ? ["--", "--", "--"] : [3_600_000, 60_000, 1000].map((unit, i) => String(Math.floor(left / unit) % (i === 0 ? 24 : 60)).padStart(2, "0"));
  return (
    <p className="deal-countdown flex items-center gap-1.5 text-xs font-semibold sm:text-sm" role="timer" aria-label={pick("Deals end at midnight", "ការបញ្ចុះតម្លៃបញ្ចប់នៅពាក់កណ្ដាលអធ្រាត្រ")}>
      <span className="hidden text-muted sm:inline">{pick("Ends in", "នៅសល់")}</span>
      {parts.map((p, i) => <span key={i} className="flex items-center gap-1.5"><span className="grid h-7 min-w-7 place-items-center rounded-lg bg-foreground px-1 font-mono text-background tabular-nums">{p}</span>{i < 2 && <span aria-hidden className="text-muted">:</span>}</span>)}
    </p>
  );
}

const DEAL_TONES = ["deal-tone-green", "deal-tone-amber", "deal-tone-rose", "deal-tone-blue"];

export function TodaysDeals() {
  const { pick, t } = useT();
  if (!DEALS.length) return null;
  return (
    <section className="todays-deals mx-auto mt-10 max-w-6xl px-4" aria-labelledby="deals-title">
      <div className="deals-panel rounded-[28px] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#ff5a36] text-xl text-white" aria-hidden>⚡</span>
            <div><h2 id="deals-title" className="text-xl font-bold sm:text-2xl">{pick("Today's deals", "ការផ្ដល់ជូនថ្ងៃនេះ")}</h2><p className="text-xs text-muted sm:text-sm">{pick("Applied automatically at checkout", "អនុវត្តដោយស្វ័យប្រវត្តិពេលទូទាត់")}</p></div>
          </div>
          <Countdown />
        </div>
        <ul className={`rail-scroll -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 ${DEAL_COLS}`}>
          {DEALS.map((s, i) => (
            <li key={s.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <Link href={`/store/${s.id}`} className={`deal-card group flex h-full flex-col overflow-hidden rounded-3xl bg-surface ${DEAL_TONES[i % DEAL_TONES.length]}`}>
                <span className="relative block aspect-[16/10] overflow-hidden bg-brand-soft">
                  {s.photo ? <Image src={s.photo.src} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 78vw" className="object-cover transition-transform duration-500 group-hover:scale-105" /> : <span className="grid h-full place-items-center text-5xl" aria-hidden>{s.emoji}</span>}
                  <span className="deal-ribbon absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-extrabold">{dealHeadline(s, pick)}</span>
                </span>
                <span className="flex flex-1 flex-col gap-1 p-4">
                  <span className="font-bold leading-snug">{s.name}</span>
                  <span className="line-clamp-1 text-sm text-muted">{pick(s.promo ?? "", s.km?.promo)}</span>
                  <span className="mt-auto flex items-center justify-between pt-2 text-xs text-muted"><span className="flex items-center gap-1"><Icon name="clock" className="h-3 w-3" />{t("store.min", { n: s.etaMinutes })}</span><span className="font-semibold text-brand">{pick("Shop deal", "ទិញឥឡូវ")} →</span></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function dealHeadline(s: Store, pick: (en: string, km?: string) => string) {
  const d = s.deal;
  if (!d) return pick("Deal", "ការផ្ដល់ជូន");
  if (d.type === "percentOff") return pick(`${d.percent}% OFF`, `បញ្ចុះ ${d.percent}%`);
  if (d.type === "freeDelivery") return pick("FREE DELIVERY", "ដឹកឥតគិតថ្លៃ");
  return pick(`BUY ${d.buy} GET ${d.free}`, `ទិញ ${d.buy} ថែម ${d.free}`);
}

/* ---------- Best sellers ---------- */

function ProductCard({ store, item }: { store: Store; item: MenuItem }) {
  const { t, pick } = useT();
  const { cart } = useShop();
  const now = useNow();
  const { average } = useStoreReviews(store.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const name = pick(item.name, item.km?.name);
  const hasOptions = !!item.options?.length;
  const closed = now > 0 && !isOpenAt(store.hours, new Date(now));
  const photo = store.items[0]?.id === item.id ? store.photo : undefined;
  const plainKey = lineKey({ itemId: item.id });
  const inThisStore = cart.storeId === store.id;
  const qty = inThisStore ? (hasOptions ? cart.lines.filter((l) => l.itemId === item.id).reduce((n, l) => n + l.qty, 0) : cart.lines.find((l) => lineKey(l) === plainKey)?.qty ?? 0) : 0;

  async function add(options: string[] = [], n = 1) {
    const added = await withReplaceConfirm((confirmReplace) => addToCart(store.id, item.id, confirmReplace, options, n), askReplaceCart(t));
    if (added) toast(t("store.added", { name }));
    return added;
  }

  const addButton = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-xl font-bold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40 dark:text-background";
  return (
    <article className={`product-card card group relative flex min-w-0 flex-col overflow-hidden ${closed ? "opacity-70" : ""}`}>
      <Link href={`/store/${store.id}`} className="flex flex-1 flex-col">
        <span className="relative block aspect-square overflow-hidden bg-brand-soft">
          {photo ? <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            : <span className="product-emoji grid h-full place-items-center text-6xl transition-transform duration-300 group-hover:scale-110 sm:text-7xl" aria-hidden>{item.emoji}</span>}
          <span className={`absolute left-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-[10px] font-bold shadow-sm sm:text-xs ${item.popular ? "text-[#d9480f]" : "text-brand"}`}>{item.popular ? `🔥 ${pick("Best seller", "លក់ដាច់")}` : `✦ ${pick("Trending", "កំពុងពេញនិយម")}`}</span>
          {closed && <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-xs font-semibold text-white">{pick("Closed now", "បិទឥឡូវនេះ")}</span>}
        </span>
        <span className="flex flex-1 flex-col p-3 sm:p-4">
          <span className="line-clamp-2 text-sm font-bold leading-snug sm:text-base">{name}</span>
          <span className="mt-0.5 truncate text-xs text-muted">{store.name}</span>
          <span className="mt-1.5 flex items-center gap-1 text-xs"><Icon name="star" filled className="h-3 w-3 text-amber-400" /><span className="font-semibold">{average.toFixed(1)}</span><span className="text-muted">· {t("store.min", { n: store.etaMinutes })}</span></span>
          <span className="mt-auto block pt-2 pr-11 text-base font-extrabold text-brand sm:text-lg">{money(item.price)}</span>
        </span>
      </Link>
      <div className="product-add absolute bottom-3 right-3 flex items-center gap-1.5 sm:bottom-4 sm:right-4">
        {qty > 0 && !hasOptions ? (
          <span className="flex items-center gap-1 rounded-full bg-surface shadow-sm">
            <button type="button" onClick={() => setQty(plainKey, qty - 1)} aria-label={t("store.decrease")} className="grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">−</button>
            <span className="w-4 text-center text-sm font-semibold">{qty}</span>
            <button type="button" onClick={() => setQty(plainKey, qty + 1)} disabled={closed} aria-label={t("store.increase")} className={`${addButton} h-8 w-8 text-lg`}>+</button>
          </span>
        ) : (
          <>
            {qty > 0 && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand" aria-label={t("options.inCart", { n: qty })}>×{qty}</span>}
            <button type="button" onClick={() => (hasOptions ? setDialogOpen(true) : void add())} disabled={closed} aria-label={t("store.add", { name })} aria-haspopup={hasOptions ? "dialog" : undefined} className={addButton}>+</button>
          </>
        )}
      </div>
      {dialogOpen && (
        <ItemOptionsDialog item={item} open={dialogOpen} storeName={store.name} imageUrl={photo?.src} closed={closed}
          onClose={() => setDialogOpen(false)} onAdd={async (options, n) => { if (await add(options, n)) setDialogOpen(false); }} />
      )}
    </article>
  );
}

export function BestSellers() {
  const { pick } = useT();
  return (
    <section className="best-sellers mx-auto mt-10 max-w-6xl px-4" aria-labelledby="best-title">
      <SectionHead id="best-title" eyebrow={pick("Most ordered this week", "បញ្ជាទិញច្រើនបំផុតសប្ដាហ៍នេះ")} title={pick("Best sellers", "មុខម្ហូបលក់ដាច់")} href="/food" />
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {BEST_SELLERS.map(({ store, item }) => <li key={`${store.id}-${item.id}`} className="min-w-0"><ProductCard store={store} item={item} /></li>)}
      </ul>
    </section>
  );
}

/* ---------- Promo banners ---------- */

export function PromoPair() {
  const { pick } = useT();
  return (
    <section className="promo-pair mx-auto mt-10 grid max-w-6xl gap-3 px-4 sm:grid-cols-2 sm:gap-5">
      <Link href="/express" className="promo-tile promo-tile-blue group relative flex min-h-40 flex-col justify-center overflow-hidden rounded-[26px] p-5 sm:min-h-48 sm:p-7">
        <span className="relative z-10 max-w-[68%]">
          <span className="promo-badge">{pick("Grab Express", "Grab Express")}</span>
          <span className="mt-2 block text-xl font-extrabold leading-tight sm:text-2xl">{pick("Send a parcel across town today", "ផ្ញើកញ្ចប់ឥវ៉ាន់ឆ្លងទីក្រុងថ្ងៃនេះ")}</span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold">{pick("Book delivery", "កក់ការដឹកជញ្ជូន")}<Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </span>
        <span className="promo-tile-art" aria-hidden><Icon name="parcel" /></span>
      </Link>
      <Link href="/merchant/register" className="promo-tile promo-tile-green group relative flex min-h-40 flex-col justify-center overflow-hidden rounded-[26px] p-5 sm:min-h-48 sm:p-7">
        <span className="relative z-10 max-w-[68%]">
          <span className="promo-badge">{pick("For businesses", "សម្រាប់អាជីវកម្ម")}</span>
          <span className="mt-2 block text-xl font-extrabold leading-tight sm:text-2xl">{pick("Sell on Grab and reach more customers", "លក់លើ Grab ដើម្បីទៅដល់អតិថិជនកាន់តែច្រើន")}</span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold">{pick("Become a merchant", "ក្លាយជាអាជីវករ")}<Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </span>
        <span className="promo-tile-art" aria-hidden><Icon name="store" /></span>
      </Link>
    </section>
  );
}

/* ---------- Trust strip ---------- */

const PERKS: { icon: IconName; en: [string, string]; km: [string, string] }[] = [
  { icon: "truck", en: ["Fast delivery", "Most orders in under 30 min"], km: ["ដឹកជញ្ជូនរហ័ស", "ភាគច្រើនក្រោម ៣០ នាទី"] },
  { icon: "wallet", en: ["Secure payment", "Card, wallet or cash"], km: ["ការទូទាត់មានសុវត្ថិភាព", "កាត កាបូប ឬសាច់ប្រាក់"] },
  { icon: "pin", en: ["Live tracking", "Follow every order on the map"], km: ["តាមដានផ្ទាល់", "តាមដានការបញ្ជាទិញលើផែនទី"] },
  { icon: "check", en: ["Trusted merchants", "Rated by real customers"], km: ["អាជីវករគួរឱ្យទុកចិត្ត", "វាយតម្លៃដោយអតិថិជនពិត"] },
];

export function TrustStrip() {
  const { pick } = useT();
  return (
    <section className="trust-strip mx-auto mt-10 max-w-6xl px-4" aria-label={pick("Why shop with Grab", "ហេតុអ្វីទិញជាមួយ Grab")}>
      <ul className="card grid grid-cols-2 gap-px overflow-hidden bg-border p-0 lg:grid-cols-4">
        {PERKS.map((p) => (
          <li key={p.icon} className="flex items-center gap-3 bg-surface p-3.5 sm:p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand sm:h-12 sm:w-12"><Icon name={p.icon} className="h-5 w-5 sm:h-6 sm:w-6" /></span>
            <span className="min-w-0"><span className="block text-xs font-bold sm:text-sm">{pick(p.en[0], p.km[0])}</span><span className="mt-0.5 block text-[11px] leading-snug text-muted sm:text-xs">{pick(p.en[1], p.km[1])}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

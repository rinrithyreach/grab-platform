"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { money } from "@/lib/brand";
import type { Store } from "@/lib/catalog";
import { cartDetails, useShop } from "@/lib/cart";
import { useNow } from "@/lib/clock";
import { formatTime, isOpen24h, isOpenAt } from "@/lib/hours";
import { useT } from "@/lib/i18n";
import { useActivePromotions } from "@/lib/promotions";
import { useStoreReviews } from "@/lib/reviews";
import { toast } from "@/lib/toast";
import BackButton from "./BackButton";
import CartBar from "./CartBar";
import FavoriteButton from "./FavoriteButton";
import Icon from "./Icon";
import MenuItemCard from "./MenuItemCard";
import Stars from "./Stars";

type Tab = "all" | "popular";
type Sort = "recommended" | "priceAsc" | "priceDesc";

/** A restaurant (or shop) page laid out like an online store: hero, offers, filterable product grid, order summary, reviews. */
export default function StoreView({ store }: { store: Store }) {
  const { t, pick, dateLocale } = useT();
  const now = useNow();
  const { reviews, average, count } = useStoreReviews(store.id);
  const offers = useActivePromotions(store.id).filter((p) => !p.productId);
  const isMart = store.kind === "mart";
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [query, setQuery] = useState("");

  // The clock is 0 until the page is in the browser; show the store as open until then.
  const closed = now > 0 && !isOpenAt(store.hours, new Date(now));
  const hoursText = !store.hours || isOpen24h(store.hours)
    ? t("hours.open24")
    : `${formatTime(store.hours.open, dateLocale)} – ${formatTime(store.hours.close, dateLocale)}`;

  const popularCount = store.items.filter((i) => i.popular).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = store.items.filter((i) => (tab === "all" || i.popular)
      && (!q || [i.name, i.description, i.km?.name, i.km?.description].some((s) => s?.toLowerCase().includes(q))));
    if (sort === "priceAsc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [store.items, tab, sort, query]);

  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); toast(pick(`Code ${code} copied`, `បានចម្លងកូដ ${code}`)); }
    catch { toast(pick(`Use code ${code} at checkout`, `ប្រើកូដ ${code} ពេលបង់ប្រាក់`), "info"); }
  }

  return (
    <div className="storefront mx-auto max-w-6xl px-4 py-6 lg:pb-32">
      <div className="storefront-topbar">
        <BackButton href={isMart ? "/mart" : "/food"} />
        <nav className="storefront-breadcrumb" aria-label={pick("Breadcrumb", "ទីតាំងទំព័រ")}>
          <Link href={isMart ? "/mart" : "/food"}>{isMart ? "GrabMart" : "GrabFood"}</Link><span aria-hidden>/</span>
          <span>{pick(store.cuisine, store.km?.cuisine)}</span><span aria-hidden>/</span>
          <span aria-current="page">{store.name}</span>
        </nav>
      </div>

      {/* Hero */}
      <header className={`storefront-hero ${closed ? "is-closed" : ""}`}>
        {store.photo
          ? <Image src={store.photo.src} alt="" fill preload fetchPriority="high" sizes="(min-width: 1152px) 1152px, 100vw" className="storefront-hero-photo" />
          : <span className="storefront-hero-emoji" aria-hidden>{store.emoji}</span>}
        <div className="storefront-hero-body">
          <span className="storefront-logo" aria-hidden>{store.emoji}</span>
          <div className="min-w-0">
            <span className={`storefront-status ${closed ? "is-closed" : ""}`}><span aria-hidden />{closed ? t("hours.closed") : t("hours.openNow")}</span>
            <h1>{store.name}</h1>
            <p>{pick(store.cuisine, store.km?.cuisine)} · {"$".repeat(store.priceLevel)} · {t("store.items", { n: store.items.length })}</p>
          </div>
        </div>
        <FavoriteButton storeId={store.id} storeName={store.name} className="storefront-favorite" />
      </header>

      <dl className="storefront-stats">
        <a href="#reviews"><dt>{pick("Rating", "ការវាយតម្លៃ")}</dt><dd><Icon name="star" filled className="text-amber-500" />{average.toFixed(1)} <small>({count})</small></dd></a>
        <div><dt>{pick("Delivery", "ដឹកជញ្ជូន")}</dt><dd><Icon name="clock" />{t("store.min", { n: store.etaMinutes })}</dd></div>
        <div><dt>{pick("Price range", "កម្រិតតម្លៃ")}</dt><dd><Icon name="wallet" />{"$".repeat(store.priceLevel)}<small>{"$".repeat(3 - store.priceLevel)}</small></dd></div>
        <div><dt>{pick("Opening hours", "ម៉ោងបើក")}</dt><dd className={closed ? "text-red-600 dark:text-red-400" : ""}><Icon name="store" />{hoursText}</dd></div>
      </dl>

      {closed && store.hours && (
        <p role="status" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          🔒 {t("hours.closedBanner", { time: formatTime(store.hours.open, dateLocale) })}
        </p>
      )}

      {offers.length > 0 && (
        <section className="storefront-offers" aria-label={pick("Offers", "ការផ្តល់ជូន")}>
          {offers.map((p) => (
            <div key={p.id} className="storefront-coupon">
              <span className="storefront-coupon-icon" aria-hidden>🏷️</span>
              <span className="min-w-0 flex-1">
                <strong>{p.name}</strong>
                <small>{p.code ? pick("Enter the code at checkout", "បញ្ចូលកូដពេលបង់ប្រាក់") : pick("Applied automatically", "អនុវត្តដោយស្វ័យប្រវត្តិ")}{p.firstOrderOnly ? ` · ${pick("first order", "ការបញ្ជាទិញដំបូង")}` : ""}</small>
              </span>
              {p.code && <button type="button" onClick={() => copyCode(p.code!)} className="storefront-coupon-code" aria-label={pick(`Copy code ${p.code}`, `ចម្លងកូដ ${p.code}`)}>{p.code}<span>{pick("Copy", "ចម្លង")}</span></button>}
            </div>
          ))}
        </section>
      )}

      <div className="storefront-layout">
        <main className="min-w-0">
          <section aria-labelledby="menu-title">
            <div className="storefront-section-head">
              <h2 id="menu-title">{t(isMart ? "store.allProducts" : "store.fullMenu")}</h2>
              <span>{pick(`${shown.length} of ${store.items.length} items`, `${shown.length} ក្នុងចំណោម ${store.items.length} មុខ`)}</span>
            </div>

            <div className="storefront-toolbar">
              <div className="storefront-tabs" role="tablist" aria-label={pick("Filter menu", "ត្រងម៉ឺនុយ")}>
                <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>{pick("All", "ទាំងអស់")} <small>{store.items.length}</small></button>
                {popularCount > 0 && <button type="button" role="tab" aria-selected={tab === "popular"} onClick={() => setTab("popular")}>{t("store.popular")} <small>{popularCount}</small></button>}
              </div>
              <label className="storefront-search">
                <Icon name="search" />
                <span className="sr-only">{pick("Search this menu", "ស្វែងរកក្នុងម៉ឺនុយ")}</span>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={pick(`Search ${store.name}`, `ស្វែងរកក្នុង ${store.name}`)} />
              </label>
              <label className="storefront-sort">
                <span className="sr-only">{pick("Sort by", "តម្រៀបតាម")}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="recommended">{pick("Recommended", "ណែនាំ")}</option>
                  <option value="priceAsc">{pick("Price: low to high", "តម្លៃ៖ ទាបទៅខ្ពស់")}</option>
                  <option value="priceDesc">{pick("Price: high to low", "តម្លៃ៖ ខ្ពស់ទៅទាប")}</option>
                </select>
              </label>
            </div>

            {shown.length ? (
              <div className="storefront-grid">
                {shown.map((i) => <MenuItemCard key={i.id} storeId={store.id} item={i} closed={closed} />)}
              </div>
            ) : (
              <div className="storefront-empty">
                <Icon name="search" />
                <p>{pick(`No dishes match “${query}”`, `រកមិនឃើញម្ហូបសម្រាប់ “${query}”`)}</p>
                <button type="button" onClick={() => { setQuery(""); setTab("all"); }}>{pick("Clear search", "សម្អាតការស្វែងរក")}</button>
              </div>
            )}
          </section>

          <ReviewsSection reviews={reviews} average={average} count={count} />
        </main>

        <aside className="storefront-aside">
          <OrderSummary store={store} />
          <ul className="storefront-perks">
            <li><Icon name="truck" /><span><strong>{pick("Delivered hot", "ដឹកជូនទាំងក្ដៅៗ")}</strong><small>{pick(`About ${store.etaMinutes} min to your door`, `ប្រហែល ${store.etaMinutes} នាទីដល់ទ្វារ`)}</small></span></li>
            <li><Icon name="wallet" /><span><strong>{pick("Pay your way", "បង់តាមចិត្ត")}</strong><small>{t("cart.cash")} · {t("cart.card")}</small></span></li>
          </ul>
        </aside>
      </div>

      <div className="storefront-cartbar"><CartBar /></div>
    </div>
  );
}

/** Desktop sidebar: what's in the basket from this store, with a checkout button. */
function OrderSummary({ store }: { store: Store }) {
  const { t, pick } = useT();
  const { cart } = useShop();
  const details = cartDetails(cart);
  const here = cart.storeId === store.id && details.count > 0;
  const itemOf = (id: string) => store.items.find((i) => i.id === id);
  const nameOf = (id: string, fallback: string) => {
    const item = itemOf(id);
    return item ? pick(item.name, item.km?.name) : fallback;
  };

  return (
    <section className="storefront-summary" aria-labelledby="summary-title">
      <h2 id="summary-title"><Icon name="bag" />{pick("Your order", "ការបញ្ជាទិញរបស់អ្នក")}</h2>
      {here ? (
        <>
          <ul>
            {details.lines.map((l) => (
              <li key={l.key}>
                <span className="storefront-summary-thumb" aria-hidden>
                  {itemOf(l.itemId)?.photo ? <Image src={itemOf(l.itemId)!.photo!.src} alt="" fill sizes="44px" className="object-cover" /> : itemOf(l.itemId)?.emoji}
                  <span className="storefront-summary-qty">{l.qty}×</span>
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate">{nameOf(l.itemId, l.name)}</span>{!!l.options?.length && <small>{l.options.join(", ")}</small>}</span>
                <span>{money(l.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="storefront-summary-total"><span>{pick("Subtotal", "សរុបរង")}</span><strong>{money(details.subtotal)}</strong></p>
          <Link href="/cart" className="storefront-checkout">{pick("Go to checkout", "ទៅបង់ប្រាក់")}<Icon name="arrow" /></Link>
        </>
      ) : (
        <div className="storefront-summary-empty">
          <span aria-hidden>🛒</span>
          {details.count > 0 && details.store
            ? <p>{pick(`Your basket has items from ${details.store.name}. Adding from here starts a new basket.`, `កន្ត្រករបស់អ្នកមានទំនិញពី ${details.store.name}។ ការបន្ថែមពីទីនេះនឹងចាប់ផ្ដើមកន្ត្រកថ្មី។`)} <Link href="/cart">{t("store.viewCart")}</Link></p>
            : <p>{pick("Your basket is empty. Add a dish to get started.", "កន្ត្រករបស់អ្នកទទេ។ បន្ថែមម្ហូបដើម្បីចាប់ផ្ដើម។")}</p>}
        </div>
      )}
    </section>
  );
}

function ReviewsSection({ reviews, average, count }: ReturnType<typeof useStoreReviews>) {
  const { t, pick, dateLocale } = useT();
  const bars = [5, 4, 3, 2, 1].map((n) => ({ n, share: reviews.length ? reviews.filter((r) => r.rating === n).length / reviews.length : 0 }));

  return (
    <section id="reviews" className="storefront-reviews scroll-mt-24" aria-labelledby="reviews-title">
      <div className="storefront-section-head"><h2 id="reviews-title">{t("reviews.title")}</h2><span>{t("reviews.count", { n: count })}</span></div>
      <div className="storefront-reviews-grid">
        <div className="storefront-rating-card">
          <strong>{average.toFixed(1)}</strong>
          <Stars value={average} />
          <small>{t("reviews.count", { n: count })}</small>
          {reviews.length > 0 && (
            <ul aria-label={pick("Written reviews by stars", "មតិតាមចំនួនផ្កាយ")}>
              {bars.map(({ n, share }) => (
                <li key={n}><span>{n}★</span><span className="storefront-bar"><span style={{ width: `${share * 100}%` }} /></span><span>{Math.round(share * 100)}%</span></li>
              ))}
            </ul>
          )}
        </div>
        <ul className="storefront-review-list">
          {reviews.map((r) => (
            <li key={r.id}>
              <span className="storefront-avatar" aria-hidden>{r.name.trim().slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold">{r.name}</p><Stars value={r.rating} /></div>
                {r.comment && <p className="mt-1 text-sm">{pick(r.comment, r.km)}</p>}
                <p className="mt-2 text-xs text-muted">{new Date(r.createdAt).toLocaleDateString(dateLocale)}</p>
              </div>
            </li>
          ))}
          {!reviews.length && <li className="text-sm text-muted">{pick("No written reviews yet.", "មិនទាន់មានមតិនៅឡើយទេ។")}</li>}
        </ul>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { money } from "@/lib/brand";
import { STORES } from "@/lib/catalog";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n";
import { merchantProductTitle } from "@/lib/merchant-content";
import { toast } from "@/lib/toast";
import { removeFromWishlist, useWishlist, useWishStatus, type WishItem } from "@/lib/wishlist";
import BackButton from "./BackButton";
import Icon from "./Icon";
import StoreCard from "./StoreCard";

/** One saved product with its live status (sold out / price dropped) from the background check. */
function WishCard({ item }: { item: WishItem }) {
  const { t, lang } = useT();
  const status = useWishStatus()[item.listingId];
  const soldOut = status ? !status.available : !item.title;
  const price = status?.available ? status.price : item.price;
  const dropped = !!status?.available && item.price > 0 && status.price < item.price;
  const title = item.title ? merchantProductTitle(item.title, lang, item.service || undefined) : t("wish.untitled");
  const href = `/partners/${encodeURIComponent(item.merchantId)}/products/${encodeURIComponent(item.listingId)}`;
  return (
    <article className={`card wish-card relative overflow-hidden ${soldOut ? "is-sold-out" : ""}`}>
      <Link href={href} className="flex gap-3 p-3">
        <span className="wish-thumb">
          {/* Merchant images are served by the API. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <Icon name="bag" />}
        </span>
        <span className="min-w-0 flex-1 pr-8">
          <span className="block truncate font-semibold">{title}</span>
          {item.merchantName && <span className="block truncate text-xs text-muted">{item.merchantName}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {price > 0 && <strong className="text-brand">{money(price)}</strong>}
            {dropped && <s className="text-xs text-muted">{money(item.price)}</s>}
            {soldOut && <span className="wish-badge is-sold-out">{t("wish.unavailable")}</span>}
            {dropped && <span className="wish-badge is-drop">{t("wish.priceDrop")}</span>}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => { removeFromWishlist(item.listingId); toast(t("wish.removed"), "info"); }}
        aria-label={t("wish.remove", { name: title })}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-red-500 hover:bg-brand-soft"
      >
        <Icon name="heart" filled />
      </button>
    </article>
  );
}

export default function FavoritesView() {
  const { t, pick } = useT();
  const ids = useFavorites();
  const wishlist = useWishlist();
  const stores = STORES.filter((store) => store.kind === "food" && ids.includes(store.id));
  return <div className="mx-auto max-w-6xl px-4 py-8">
    <BackButton />
    <p className="eyebrow">{pick("A little collection of joy", "កន្លែងដែលអ្នកចូលចិត្ត")}</p>
    <h1 className="mt-2 text-3xl font-bold">{t("fav.title")}</h1>
    <p className="mt-2 text-muted">{pick("Your favourites, all in one place. Ready when you are.", "ហាងដែលអ្នកចូលចិត្តទាំងអស់នៅទីនេះ។")}</p>

    <section aria-labelledby="wishlist-title" className="mt-8">
      <h2 id="wishlist-title" className="flex items-center gap-2 text-xl font-bold"><Icon name="heart" className="text-red-500" filled />{t("wish.title")}{wishlist.length > 0 && <span className="text-base font-medium text-muted">({wishlist.length})</span>}</h2>
      {wishlist.length
        ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{wishlist.map((item) => <WishCard key={item.listingId} item={item} />)}</div>
        : <div className="card mt-4 flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden><Icon name="bell" /></span>
          <span><span className="block font-semibold">{t("wish.empty")}</span><span className="block text-sm text-muted">{t("wish.emptyText")}</span></span>
        </div>}
    </section>

    <section aria-labelledby="saved-stores-title" className="mt-10">
      <h2 id="saved-stores-title" className="text-xl font-bold">{t("wish.restaurants")}</h2>
      {stores.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{stores.map((store) => <StoreCard key={store.id} store={store} />)}</div>
        : <div className="empty-state card mt-4 p-8 text-center">
          <span className="empty-state-icon"><Icon name="heart" /></span>
          <h2 className="mt-5 text-xl font-bold">{pick("Make room for your favourites", "រក្សាទុកហាងដែលអ្នកចូលចិត្ត")}</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{pick("Tap the heart on any restaurant to save it for your next craving.", "ចុចបេះដូងនៅលើហាងដើម្បីរក្សាទុកសម្រាប់ពេលក្រោយ។")}</p>
          <Link href="/food" className="btn-primary mt-6">{t("cart.browseFood")}<Icon name="arrow" /></Link>
        </div>}
    </section>
  </div>;
}

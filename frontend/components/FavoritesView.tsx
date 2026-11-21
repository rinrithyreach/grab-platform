"use client";

import Link from "next/link";
import { STORES } from "@/lib/catalog";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n";
import BackButton from "./BackButton";
import Icon from "./Icon";
import StoreCard from "./StoreCard";

export default function FavoritesView() {
  const { t, pick } = useT();
  const ids = useFavorites();
  const stores = STORES.filter((store) => store.kind === "food" && ids.includes(store.id));
  return <div className="mx-auto max-w-6xl px-4 py-8">
    <BackButton />
    <p className="eyebrow">{pick("A little collection of joy", "កន្លែងដែលអ្នកចូលចិត្ត")}</p>
    <h1 className="mt-2 text-3xl font-bold">{t("fav.title")}</h1>
    <p className="mt-2 text-muted">{pick("Your favourites, all in one place. Ready when you are.", "ហាងដែលអ្នកចូលចិត្តទាំងអស់នៅទីនេះ។")}</p>
    {stores.length ? <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{stores.map((store) => <StoreCard key={store.id} store={store} />)}</div>
      : <div className="empty-state card mt-7 p-8 text-center">
        <span className="empty-state-icon"><Icon name="heart" /></span>
        <h2 className="mt-5 text-xl font-bold">{pick("Make room for your favourites", "រក្សាទុកហាងដែលអ្នកចូលចិត្ត")}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{pick("Tap the heart on any restaurant to save it for your next craving.", "ចុចបេះដូងនៅលើហាងដើម្បីរក្សាទុកសម្រាប់ពេលក្រោយ។")}</p>
        <Link href="/food" className="btn-primary mt-6">{t("cart.browseFood")}<Icon name="arrow" /></Link>
      </div>}
  </div>;
}

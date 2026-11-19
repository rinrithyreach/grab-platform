"use client";

import Link from "next/link";
import { STORES } from "@/lib/catalog";
import { useT, type MessageKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import StoreCard from "@/components/StoreCard";
import BannerCarousel from "@/components/BannerCarousel";
import MerchantOffers from "@/components/MerchantOffers";
import GlobalSearch from "@/components/GlobalSearch";
import { useFavorites } from "@/lib/favorites";

const SERVICES: { href: string; emoji: string; title: MessageKey; text: MessageKey }[] = [
  { href: "/ride", emoji: "🚗", title: "nav.ride", text: "home.rideText" },
  { href: "/food", emoji: "🍜", title: "nav.food", text: "home.foodText" },
  { href: "/express", emoji: "📦", title: "nav.express", text: "home.expressText" },
];

/** Shortcuts for signed-in customers back to their own activity. */
const QUICK_LINKS: { href: string; emoji: string; label: MessageKey }[] = [
  { href: "/rides", emoji: "🧾", label: "nav.myRides" },
  { href: "/orders", emoji: "🛍️", label: "nav.myOrders" },
  { href: "/deliveries", emoji: "🚚", label: "nav.deliveries" },
  { href: "/wallet", emoji: "👛", label: "nav.wallet" },
];

const STEPS: { emoji: string; title: MessageKey; text: MessageKey }[] = [
  { emoji: "📱", title: "home.step1", text: "home.step1Text" },
  { emoji: "📍", title: "home.step2", text: "home.step2Text" },
  { emoji: "⚡", title: "home.step3", text: "home.step3Text" },
];

const FEATURED = STORES.filter((s) => s.kind === "food").sort((a, b) => b.rating - a.rating).slice(0, 3);

export default function Home() {
  const { t } = useT();
  const { user, ready } = useAuth();
  const favIds = useFavorites();
  const favourites = favIds.flatMap((id) => STORES.filter((s) => s.id === id && s.kind === "food"));
  const signedInCustomer = ready && user && user.role !== "Admin";

  return (
    <>
      {/* Hero slideshow: welcome slide + banners from the backend */}
      <BannerCarousel />

      {/* Services. relative z-10: the cards overlap the bottom of the hero and must stay on top of it.
          On phones they are compact tiles in one row so search and content stay above the fold. */}
      <section className="relative z-10 mx-auto -mt-8 max-w-6xl px-4">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {SERVICES.map((s) => (
            <Link key={s.href} href={s.href} className="card group flex flex-col items-center gap-2 p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:gap-4 sm:p-5 sm:text-left">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl transition group-hover:scale-105 sm:h-14 sm:w-14 sm:text-3xl" aria-hidden>{s.emoji}</span>
              <span className="min-w-0">
                <span className="block font-bold sm:text-lg">{t(s.title)}</span>
                <span className="hidden text-sm text-muted sm:block">{t(s.text)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Search everything, right under the services */}
      <GlobalSearch className="mx-auto mt-6 max-w-6xl px-4" />

      {/* Jump back in (signed-in customers) */}
      {signedInCustomer && (
        <section className="mx-auto mt-8 max-w-6xl px-4" aria-labelledby="quick-title">
          <h2 id="quick-title" className="text-sm font-semibold uppercase tracking-wider text-muted">{t("home.quickTitle")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_LINKS.map((q) => (
              <Link key={q.href} href={q.href} className="card flex items-center gap-3 px-4 py-3 text-sm font-semibold transition hover:border-brand hover:text-brand">
                <span className="text-xl" aria-hidden>{q.emoji}</span><span className="truncate">{t(q.label)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Favourites (only when the user has hearted a store) */}
      {favourites.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="text-2xl font-bold">❤️ {t("fav.title")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favourites.map((s) => <StoreCard key={s.id} store={s} />)}
          </div>
        </section>
      )}

      {/* Merchant products: one swipeable row with service tabs */}
      <div className="mx-auto max-w-6xl px-4"><MerchantOffers variant="rail" /></div>

      {/* Featured */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">{t("home.topRated")}</h2>
          <Link href="/food" className="-my-2 shrink-0 py-2 text-sm font-semibold text-brand">{t("home.seeAll")}</Link>
        </div>
        {/* Phones: a swipeable row instead of three tall stacked cards. */}
        <div className="rail-scroll -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {FEATURED.map((s) => <div key={s.id} className="w-[78%] shrink-0 snap-start sm:w-auto"><StoreCard store={s} /></div>)}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <h2 className="text-2xl font-bold">{t("home.howItWorks")}</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex items-start gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-xl" aria-hidden>{s.emoji}</span>
              <span>
                <span className="block font-bold">{i + 1}. {t(s.title)}</span>
                <span className="mt-1 block text-sm text-muted">{t(s.text)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

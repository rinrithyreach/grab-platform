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
import Icon, { type IconName } from "@/components/Icon";
import { useProfile } from "@/lib/profile";

const SERVICES: { href: string; icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { href: "/food", icon: "food", title: "nav.food", text: "home.foodText" },
  { href: "/ride", icon: "car", title: "nav.ride", text: "home.rideText" },
  { href: "/express", icon: "parcel", title: "nav.express", text: "home.expressText" },
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

const FEATURED = STORES.filter((s) => s.kind === "food").sort((a, b) => b.rating - a.rating).slice(0, 4);

export default function Home() {
  const { t, pick } = useT();
  const { user, ready } = useAuth();
  const { addresses } = useProfile();
  const favIds = useFavorites();
  const favourites = favIds.flatMap((id) => STORES.filter((s) => s.id === id && s.kind === "food"));
  const signedInCustomer = ready && user && user.role !== "Admin";

  return (
    <div className="home-page pb-4">
      <section className="home-welcome mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-5 pt-7">
        <div>
          <p className="eyebrow">{pick("A little joy, every day", "រីករាយជារៀងរាល់ថ្ងៃ")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{pick("What sounds good today?", "ថ្ងៃនេះចង់ញ៉ាំអ្វី?")}</h1>
          <p className="mt-2 hidden text-sm text-muted sm:block">{pick("Your favourite food, a ride across town, and everything in between.", "អាហារដែលអ្នកចូលចិត្ត ការធ្វើដំណើរ និងអ្វីៗជាច្រើនទៀត។")}</p>
        </div>
        <Link href="/profile#addresses" className="home-location hidden items-center gap-3 rounded-2xl bg-surface px-4 py-3 sm:flex">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand"><Icon name="pin" /></span>
          <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-widest text-muted">{pick("Deliver to", "ដឹកជញ្ជូនទៅ")}</span><span className="mt-1 block max-w-40 truncate text-sm font-semibold">{addresses.find((a) => a.label === "home")?.text ?? pick("Choose your location", "ជ្រើសរើសទីតាំងរបស់អ្នក")}</span></span>
          <Icon name="chevron" className="h-3.5 w-3.5 text-muted" />
        </Link>
      </section>
      {/* Hero slideshow: welcome slide + banners from the backend */}
      <BannerCarousel />

      {/* Compact service shortcuts stay in one row on mobile. */}
      <section className="relative mx-auto mt-5 max-w-6xl px-4">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {SERVICES.map((s) => (
            <Link key={s.href} href={s.href} className="service-tile card group flex flex-col items-center gap-2 p-3 text-center sm:flex-row sm:gap-4 sm:p-5 sm:text-left">
              <span className="service-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand sm:h-14 sm:w-14"><Icon name={s.icon} className="h-6 w-6 sm:h-7 sm:w-7" /></span>
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
          <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">{t("fav.title")}</h2><Link href="/favorites" className="text-sm font-semibold text-brand">{t("home.seeAll")}</Link></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favourites.map((s) => <StoreCard key={s.id} store={s} />)}
          </div>
        </section>
      )}

      {/* Merchant products: one swipeable row with service tabs */}

      {/* Featured */}
      <section className="mx-auto mt-9 max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <div><p className="eyebrow mb-1">{pick("Made for your cravings", "អាហារដែលអ្នកចូលចិត្ត")}</p><h2 className="text-2xl font-bold">{t("home.topRated")}</h2></div>
          <Link href="/food" className="-my-2 flex shrink-0 items-center gap-1 py-2 text-sm font-semibold text-brand">{t("home.seeAll")}<Icon name="chevron" className="h-3 w-3" /></Link>
        </div>
        {/* A compact two-column grid on phones, four columns on desktop. */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {FEATURED.map((s) => <StoreCard key={s.id} store={s} />)}
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4"><MerchantOffers variant="rail" /></div>

      {/* How it works */}
      <section className="how-it-works mx-auto mt-10 max-w-6xl px-4">
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
    </div>
  );
}

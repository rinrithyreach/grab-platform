"use client";

import Link from "next/link";
import { STORES } from "@/lib/catalog";
import { useT, type MessageKey } from "@/lib/i18n";
import StoreCard from "@/components/StoreCard";

const SERVICES: { href: string; emoji: string; title: MessageKey; text: MessageKey }[] = [
  { href: "/ride", emoji: "🚗", title: "nav.ride", text: "home.rideText" },
  { href: "/food", emoji: "🍜", title: "nav.food", text: "home.foodText" },
  { href: "/mart", emoji: "🛒", title: "nav.mart", text: "home.martText" },
];

const STEPS: { emoji: string; title: MessageKey; text: MessageKey }[] = [
  { emoji: "📱", title: "home.step1", text: "home.step1Text" },
  { emoji: "📍", title: "home.step2", text: "home.step2Text" },
  { emoji: "⚡", title: "home.step3", text: "home.step3Text" },
];

const FEATURED = STORES.filter((s) => s.kind === "food").sort((a, b) => b.rating - a.rating).slice(0, 3);

export default function Home() {
  const { t } = useT();

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand to-brand-strong text-white dark:text-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-medium">{t("home.badge")}</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              {t("home.title1")}<br />{t("home.title2")}
            </h1>
            <p className="mt-4 max-w-md text-lg opacity-90">{t("brand.tagline")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/ride" className="btn bg-white text-brand hover:bg-white/90">🚗 {t("home.bookRide")}</Link>
              <Link href="/food" className="btn border border-white/40 hover:bg-white/10">🍜 {t("home.orderFood")}</Link>
            </div>
          </div>
          <div className="hidden grid-cols-2 gap-4 md:grid" aria-hidden>
            {["🚗", "🍔", "🛒", "🧋"].map((e, i) => (
              <div key={e} className={`grid aspect-square place-items-center rounded-3xl bg-white/10 text-7xl ${i % 2 ? "translate-y-6" : ""}`}>{e}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto -mt-8 max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {SERVICES.map((s) => (
            <Link key={s.href} href={s.href} className="card flex items-center gap-4 p-5 shadow-sm transition-shadow hover:shadow-lg">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-3xl">{s.emoji}</span>
              <span className="min-w-0">
                <span className="block text-lg font-bold">{t(s.title)}</span>
                <span className="text-sm text-muted">{t(s.text)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">{t("home.topRated")}</h2>
          <Link href="/food" className="shrink-0 text-sm font-semibold text-brand">{t("home.seeAll")}</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED.map((s) => <StoreCard key={s.id} store={s} />)}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <h2 className="text-2xl font-bold">{t("home.howItWorks")}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-6">
              <p className="text-3xl">{s.emoji}</p>
              <p className="mt-3 font-bold">{i + 1}. {t(s.title)}</p>
              <p className="mt-1 text-sm text-muted">{t(s.text)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

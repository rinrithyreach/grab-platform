"use client";

/**
 * Home-page hero slideshow.
 * Slide 1 is always the welcome slide. After it come the banners from the backend
 * (GET /api/banners — see `Banner` in lib/api.ts), in the order the backend returns them.
 * Until the backend returns at least one banner, placeholder slides are shown instead.
 * Adding, removing or reordering banners is done entirely in the backend.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import Carousel from "./Carousel";

const PLACEHOLDER_COUNT = 2;
const PLACEHOLDER_STYLES = ["from-amber-500 to-orange-600", "from-sky-600 to-indigo-700"];

// Every slide has the same height so the page never jumps between slides.
const FRAME = "relative block h-[480px] w-full overflow-hidden sm:h-[460px] md:h-[520px]";
// Content lines up with the rest of the page; extra bottom padding leaves room for the dots + service cards.
const INNER = "mx-auto flex h-full max-w-6xl flex-col justify-center px-4 pb-16 sm:px-16 lg:px-4";

function WelcomeSlide() {
  const { t } = useT();
  return (
    <div className={`${FRAME} bg-gradient-to-br from-brand to-brand-strong text-white dark:text-background`}>
      <div className={`${INNER} md:grid md:grid-cols-2 md:items-center md:gap-10`}>
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
            <div key={e} className={`grid aspect-square max-h-44 place-items-center rounded-3xl bg-white/10 text-6xl ${i % 2 ? "translate-y-6" : ""}`}>{e}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BannerSlide({ banner }: { banner: Banner }) {
  const content = (
    <>
      {/* Plain <img>: banner URLs come from the backend and can be on any host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={banner.imageUrl} alt={banner.title ?? ""} className="absolute inset-0 h-full w-full object-cover" />
      {(banner.title || banner.subtitle) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent">
          <div className={`${INNER} justify-end text-white`}>
            {banner.title && <p className="text-3xl font-extrabold sm:text-5xl">{banner.title}</p>}
            {banner.subtitle && <p className="mt-2 text-lg opacity-90">{banner.subtitle}</p>}
          </div>
        </div>
      )}
    </>
  );
  if (!banner.linkUrl) return <div className={FRAME}>{content}</div>;
  return banner.linkUrl.startsWith("/")
    ? <Link href={banner.linkUrl} className={FRAME}>{content}</Link>
    : <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className={FRAME}>{content}</a>;
}

function PlaceholderSlide({ n }: { n: number }) {
  const { t } = useT();
  return (
    <div className={`${FRAME} bg-gradient-to-br ${PLACEHOLDER_STYLES[(n - 1) % PLACEHOLDER_STYLES.length]} text-white`}>
      <div className={`${INNER} items-center text-center`}>
        <p className="text-4xl font-extrabold sm:text-5xl">{t("carousel.placeholderTitle", { n })}</p>
        <p className="mt-3 text-lg opacity-90">{t("carousel.placeholderText")}</p>
      </div>
    </div>
  );
}

export default function BannerCarousel() {
  const { api } = useAuth();
  const { t } = useT();
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    api.banners(ctrl.signal)
      .then((list) => setBanners(Array.isArray(list) ? list.filter((b) => b?.imageUrl) : []))
      .catch(() => { /* backend not running or no /api/banners yet: keep placeholders */ });
    return () => ctrl.abort();
  }, [api]);

  const slides = [
    <WelcomeSlide key="welcome" />,
    ...(banners.length
      ? banners.map((b) => <BannerSlide key={b.id} banner={b} />)
      : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => <PlaceholderSlide key={`placeholder-${i}`} n={i + 1} />)),
  ];

  return <Carousel hero slides={slides} label={t("carousel.label")} />;
}

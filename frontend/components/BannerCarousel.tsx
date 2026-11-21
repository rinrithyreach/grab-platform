"use client";

/**
 * Home-page hero slideshow.
 * Uploaded banners replace the built-in promotions, in the order supplied by
 * GET /api/banners. Built-in promotions are only a fallback when there are no banners.
 * Administrators upload banners in /admin?section=listings ("Homepage banners"); those come first,
 * followed by up to 12 listings that merchants feature in /merchant.
 */
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import Carousel from "./Carousel";
import Icon from "./Icon";

const PLACEHOLDER_COUNT = 2;
const PLACEHOLDER_STYLES = ["from-brand to-brand-strong", "from-amber-100 to-amber-200"];

// Every slide has the same height so the page never jumps between slides.
const FRAME = "promo-frame relative block h-[230px] w-full overflow-hidden sm:h-[320px]";
// Extra bottom padding leaves space for the carousel controls.
const INNER = "mx-auto flex h-full max-w-6xl flex-col justify-center px-6 pb-8 sm:px-14 sm:pb-10";

function WelcomeSlide() {
  const { t, pick } = useT();
  return (
    <div className={`${FRAME} welcome-promo`}>
      <div className={`${INNER} relative z-10`}>
        <div className="relative z-10 w-[65%] sm:w-[58%]">
          <p className="promo-badge">{pick("A delicious first hello", "ស្វាគមន៍ជាមួយអាហារឆ្ងាញ់")}</p>
          <h2 className="mt-3 text-[28px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{pick("Big cravings.", "ឃ្លានហើយមែនទេ?")}<br /><span className="text-[#008b3e]">{pick("Little prices.", "តម្លៃពិសេស។")}</span></h2>
          <p className="mt-2 text-xs text-[#496247] sm:mt-3 sm:text-base">{pick("20% off your first noodle order.", "បញ្ចុះតម្លៃ ២០% លើការបញ្ជាទិញមីដំបូង។")}</p>
          <Link href="/store/golden-noodle" className="btn mt-4 h-10 bg-[#008b3e] px-4 text-xs text-white hover:bg-[#006f32] sm:mt-5 sm:h-11 sm:px-5 sm:text-sm">{t("home.orderFood")}<Icon name="arrow" className="h-4 w-4" /></Link>
        </div>
        <div className="promo-food-art" aria-hidden="true"><span className="promo-ring" /><div className="promo-plate"><Image src="/images/stores/golden-noodle.jpg" alt="" fill preload sizes="(min-width: 640px) 300px, 190px" className="object-cover" /></div><span className="promo-discount">20%<small>OFF</small></span><span className="promo-spark">✦</span></div>
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
  const href = banner.linkUrl;
  if (!href || (!/^\/(?!\/)/.test(href) && !/^https?:\/\//i.test(href))) return <div className={FRAME}>{content}</div>;
  return href.startsWith("/")
    ? <Link href={href} className={FRAME}>{content}</Link>
    : <a href={href} target="_blank" rel="noopener noreferrer" className={FRAME}>{content}</a>;
}

function PlaceholderSlide({ n }: { n: number }) {
  const { t } = useT();
  return (
    <Link href={n === 1 ? "/express" : "/food"} className={`${FRAME} bg-gradient-to-br ${PLACEHOLDER_STYLES[(n - 1) % PLACEHOLDER_STYLES.length]} text-white`}>
      <div className={`${INNER} items-start ${n === 1 ? "text-white" : "text-[#164b2d]"}`}>
        <Icon name={n === 1 ? "parcel" : "food"} className="mb-4 h-9 w-9 sm:h-12 sm:w-12" />
        <p className="max-w-[75%] text-3xl font-extrabold tracking-tight sm:text-5xl">{t(n === 1 ? "express.title" : "food.title")}</p>
        <p className="mt-3 max-w-[80%] text-sm opacity-85 sm:text-lg">{t(n === 1 ? "home.expressText" : "food.subtitle")}</p>
        <span className="promo-line-art" aria-hidden><Icon name={n === 1 ? "parcel" : "food"} /></span>
      </div>
    </Link>
  );
}

export default function BannerCarousel() {
  const { api } = useAuth();
  const { t } = useT();
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    const refresh = () => {
      if (busy) return;
      busy = true;
      void api.banners(ctrl.signal)
      .then((list) => setBanners(Array.isArray(list) ? list.filter((b) => b?.imageUrl) : []))
      .catch(() => { /* backend unavailable: keep existing slides */ }).finally(() => { busy = false; });
    };
    refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api]);

  const slides = banners.length
    ? banners.map((banner) => <BannerSlide key={banner.id} banner={banner} />)
    : [<WelcomeSlide key="welcome" />, ...Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => <PlaceholderSlide key={`placeholder-${i}`} n={i + 1} />)];

  return <div className="home-banner mx-auto max-w-6xl px-4"><Carousel key={banners.length ? "uploaded" : "fallback"} hero slides={slides} label={t("carousel.label")} interval={6500} /></div>;
}

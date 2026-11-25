"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MerchantOffer, MerchantServiceKind } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT, type MessageKey } from "@/lib/i18n";
import { usePartnerCart } from "@/lib/partner-cart";
import { useCategories } from "@/lib/categories";
import { categoryLabel } from "@/lib/category-types";
import MerchantOfferCard from "./MerchantOfferCard";
import { OfferGridSkeleton, OfferRailSkeleton } from "./Skeleton";
import { PartnerAddButton, PartnerCartBar } from "./PartnerCartControls";

const TABS: { service?: MerchantServiceKind; label: MessageKey; href: string }[] = [
  { label: "home.offersAll", href: "/express" },
  { service: "GrabFood", label: "nav.food", href: "/food" },
  { service: "GrabExpress", label: "nav.express", href: "/express" },
];

/**
 * Published merchant products. "grid" (service pages) lists every product with Load more;
 * "rail" (home page) shows one swipeable row with service tabs and a See all link, so the page stays short.
 */
export default function MerchantOffers({ service, variant = "grid" }: { service?: MerchantServiceKind; variant?: "grid" | "rail" }) {
  const { api } = useAuth();
  const { t, lang, pick } = useT();
  const cart = usePartnerCart();
  const rail = variant === "rail";
  const [tab, setTab] = useState<MerchantServiceKind | undefined>(service);
  const active = rail ? tab : service;
  const categories = useCategories().filter(c => c.service === active);
  const [categoryFilter, setCategoryFilter] = useState<{ service?: MerchantServiceKind; id: string }>({ id: "" });
  const selectedCategory = categoryFilter.service === active ? categories.find(c => c.id === categoryFilter.id) : undefined;
  const categoryId = !rail ? selectedCategory?.id : undefined;
  const parentId = selectedCategory?.parentId ?? categoryId;
  const subcategories = categories.filter(c => c.parentId === parentId);
  const [offers, setOffers] = useState<MerchantOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const moreRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api.merchantOffers(active, 1, ctrl.signal, categoryId).then((rows) => {
      if (ctrl.signal.aborted) return;
      setOffers(rows); setMore(rows.length === 24); setPage(1); setError(false); setLoading(false);
    }).catch(() => { if (!ctrl.signal.aborted) { setError(true); setLoading(false); } });
    return () => { ctrl.abort(); moreRequest.current?.abort(); };
  }, [api, active, retry, categoryId]);

  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const pages = await Promise.all(Array.from({ length: page }, (_, index) => api.merchantOffers(active, index + 1, ctrl.signal, categoryId)));
        if (!ctrl.signal.aborted) { setOffers(pages.flat()); setMore(pages[pages.length - 1].length === 24); setError(false); }
      } catch { /* retain the last successful public list; initial load/retry shows errors */ }
      finally { busy = false; }
    };
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api, active, page, categoryId]);

  // Rail arrows are enabled only when there is more to scroll in that direction.
  useEffect(() => {
    const el = track.current;
    if (!rail || !el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [rail, offers]);

  async function loadMore() {
    const ctrl = new AbortController(); moreRequest.current?.abort(); moreRequest.current = ctrl;
    setLoading(true); setError(false);
    try {
      const rows = await api.merchantOffers(active, page + 1, ctrl.signal, categoryId);
      if (ctrl.signal.aborted) return;
      setOffers((previous) => [...previous, ...rows.filter((row) => !previous.some((item) => item.id === row.id))]);
      setMore(rows.length === 24); setPage((p) => p + 1);
    } catch { if (!ctrl.signal.aborted) setError(true); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }

  function chooseTab(next?: MerchantServiceKind) {
    if (next === tab) return;
    setTab(next); setLoading(true); setOffers([]);
    track.current?.scrollTo({ left: 0 });
  }

  function chooseCategory(id: string) {
    if (id === (categoryId ?? "")) return;
    setCategoryFilter({ service: active, id }); setLoading(true); setOffers([]); setPage(1);
  }

  const scrollBy = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.9, behavior: "smooth" });
  const seeAll = TABS.find((x) => x.service === tab)?.href ?? "/express";
  const status = <>
    {loading && !offers.length && !error && (rail ? <OfferRailSkeleton /> : <OfferGridSkeleton />)}
    {error && <div className="card mt-5 flex flex-wrap items-center justify-between gap-3 p-4"><p role="alert" className="text-sm text-muted">{t("merchant.unavailable")}</p><button className="btn-outline text-sm" disabled={loading} onClick={() => { if (offers.length && !rail) void loadMore(); else { setLoading(true); setRetry((n) => n + 1); } }}>{t("merchant.retry")}</button></div>}
    {!loading && !error && !offers.length && <p className="card mt-5 p-5 text-sm text-muted">{t("merchant.noOffers")}</p>}
  </>;

  if (rail) return <section className="mt-12" aria-label={t("merchant.partners")}>
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0"><h2 className="text-2xl font-bold">{t("merchant.partners")}</h2><p className="mt-1 text-sm text-muted">{t("merchant.partnersIntro")}</p></div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={t("home.offersPrev")} className="hidden h-9 w-9 place-items-center rounded-full border border-border bg-surface text-lg transition hover:border-brand disabled:opacity-40 sm:grid">‹</button>
        <button type="button" onClick={() => scrollBy(1)} disabled={edges.end} aria-label={t("home.offersNext")} className="hidden h-9 w-9 place-items-center rounded-full border border-border bg-surface text-lg transition hover:border-brand disabled:opacity-40 sm:grid">›</button>
        <Link href={seeAll} className="-my-2 shrink-0 py-2 text-sm font-semibold text-brand">{t("home.seeAll")}</Link>
      </div>
    </div>
    <div role="group" aria-label={t("home.offersFilter")} className="mt-4 flex gap-2 overflow-x-auto pb-1">
      {TABS.map((x) => <button key={x.label} type="button" aria-pressed={tab === x.service} onClick={() => chooseTab(x.service)}
        className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${tab === x.service ? "border-brand bg-brand text-white dark:text-background" : "border-border bg-surface text-muted hover:border-brand hover:text-foreground"}`}>{t(x.label)}</button>)}
    </div>
    {offers.length > 0 && <div ref={track} className="rail-scroll -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-2">
      {offers.map((offer) => <div key={offer.id} className="w-[68%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"><MerchantOfferCard offer={offer} compact /></div>)}
    </div>}
    {status}
  </section>;

  return <section className="mt-12" aria-label={t("merchant.partners")}>
    <h2 className="text-2xl font-bold">{t("merchant.partners")}</h2>
    <p className="mt-1 text-sm text-muted">{t("merchant.partnersIntro")}</p>
    {!!categories.length && <div className="mt-4 space-y-2">
      <div role="group" aria-label={pick("Product categories", "ប្រភេទផលិតផល")} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={!categoryId} onClick={() => chooseCategory("")} className={`rounded-full border px-4 py-2 text-sm font-semibold ${!categoryId ? "border-brand bg-brand text-white" : "border-border bg-surface hover:bg-brand-soft"}`}>{t("browse.all")}</button>
        {categories.filter(c => !c.parentId).map(c => <button type="button" key={c.id} aria-pressed={parentId === c.id} onClick={() => chooseCategory(c.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${parentId === c.id ? "border-brand bg-brand text-white" : "border-border bg-surface hover:bg-brand-soft"}`}>{categoryLabel(c, lang)}</button>)}
      </div>
      {!!subcategories.length && <div role="group" aria-label={pick("Product subcategories", "ប្រភេទរងផលិតផល")} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={categoryId === parentId} onClick={() => chooseCategory(parentId ?? "")} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${categoryId === parentId ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>{pick("All in this category", "ទាំងអស់ក្នុងប្រភេទនេះ")}</button>
        {subcategories.map(c => <button type="button" key={c.id} aria-pressed={categoryId === c.id} onClick={() => chooseCategory(c.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${categoryId === c.id ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-brand-soft"}`}>{categoryLabel(c, lang)}</button>)}
      </div>}
    </div>}
    {offers.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{offers.map((offer) => <MerchantOfferCard key={offer.id} offer={offer}>{service === "GrabExpress" && <PartnerAddButton offer={offer} />}</MerchantOfferCard>)}</div>}
    {loading && offers.length > 0 && <OfferGridSkeleton count={3} className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3" />}
    {status}
    {more && !error && <button className="btn-outline mt-5" disabled={loading} onClick={loadMore}>{t("merchant.loadMore")}</button>}
    {service === "GrabExpress" && cart.merchantId && <PartnerCartBar merchantId={cart.merchantId} />}
  </section>;
}

"use client";

/**
 * GrabExpress product page in a marketplace layout:
 * photo (hover to zoom) · product info · sticky buy box on wide screens,
 * then Details / Specifications / Delivery tabs, more from the same store and similar products.
 * Phones get a buy bar pinned above the bottom navigation.
 */
import Link from "next/link";
import { useEffect, useId, useState, type CSSProperties, type MouseEvent } from "react";
import type { MerchantOffer } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useCategories } from "@/lib/categories";
import { categoryLabel } from "@/lib/category-types";
import { useT } from "@/lib/i18n";
import { merchantProductText } from "@/lib/merchant-content";
import { usePromotionLabel } from "@/lib/promotions";
import { formatRideWorkSchedule } from "@/lib/ride-work-schedule";
import { toast } from "@/lib/toast";
import CategoryBadge from "./CategoryBadge";
import Icon, { type IconName } from "./Icon";
import MerchantOfferCard from "./MerchantOfferCard";
import WishlistButton from "./WishlistButton";
import { PartnerCartBar, PartnerProductPurchase, PartnerStickyBuyBar } from "./PartnerCartControls";

type Tab = "details" | "specs" | "delivery";

export default function ExpressProductDetails({ offer, others }: { offer: MerchantOffer; others: MerchantOffer[] }) {
  const { t, lang, pick } = useT();
  const { api } = useAuth();
  const { title, description } = merchantProductText(offer.title, offer.description, offer.merchant.service, lang);
  const merchant = offer.merchant;
  const storeUrl = `/partners/${merchant.id}`;
  const category = useCategories().find((c) => c.id === offer.categoryId);
  const [imageFailed, setImageFailed] = useState(false);
  const [zoom, setZoom] = useState<CSSProperties | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [similar, setSimilar] = useState<MerchantOffer[]>([]);
  const tabsId = useId();
  const fromStore = others.filter((p) => p.id !== offer.id).slice(0, 4);
  // Stable across background refreshes, so "similar products" is fetched once per product, not every few seconds.
  const storeProductIds = others.map((p) => p.id).join(",");
  // "$1 off orders of $3+ · GROUP6 · Free delivery" → one chip each; all-caps words are promo codes.
  const promos = (usePromotionLabel(merchant.id, offer.id) ?? "").split(" · ").map((x) => x.trim()).filter(Boolean);

  // "Similar products": same category across all GrabExpress merchants (or the newest products when uncategorised).
  useEffect(() => {
    const ctrl = new AbortController();
    api.merchantOffers("GrabExpress", 1, ctrl.signal, offer.categoryId ?? undefined)
      .then((rows) => { const mine = new Set(storeProductIds.split(",")); if (!ctrl.signal.aborted) setSimilar(rows.filter((p) => p.id !== offer.id && !mine.has(p.id)).slice(0, 4)); })
      .catch(() => { /* optional section: leave it hidden */ });
    return () => ctrl.abort();
  }, [api, offer.id, offer.categoryId, storeProductIds]);

  function followZoom(e: MouseEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    setZoom({ transformOrigin: `${((e.clientX - box.left) / box.width) * 100}% ${((e.clientY - box.top) / box.height) * 100}%` });
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); toast(pick("Link copied", "បានចម្លងតំណ")); }
    } catch { /* share sheet closed */ }
  }

  const hours = merchant.openingHours ? formatRideWorkSchedule(merchant.openingHours, (day) => t(`merchant.day.${day}`)) : "";
  const specs: [string, string][] = [
    [pick("Category", "ប្រភេទ"), category ? categoryLabel(category, lang) : merchant.category || "—"],
    [pick("Sold by", "លក់ដោយ"), merchant.businessName],
    // The address usually already ends with the city, so only add the city when it is missing.
    [pick("Ships from", "ដឹកចេញពី"), merchant.address ? (merchant.city && !merchant.address.includes(merchant.city) ? `${merchant.address}, ${merchant.city}` : merchant.address) : merchant.city || "—"],
    [pick("Delivery", "ការដឹកជញ្ជូន"), pick("GrabExpress courier", "អ្នកដឹកជញ្ជូន GrabExpress")],
    [pick("Payment", "ការទូទាត់"), `${t("cart.cash")} · ${t("cart.card")}`],
    ...(hours ? [[t("merchant.hours"), hours] as [string, string]] : []),
  ];
  const highlights: { icon: IconName; title: string; text: string }[] = [
    { icon: "truck", title: pick("Delivered by GrabExpress", "ដឹកជញ្ជូនដោយ GrabExpress"), text: pick("Track your courier live from pickup to your door", "តាមដានអ្នកដឹកជញ្ជូនផ្ទាល់ រហូតដល់ទ្វារផ្ទះ") },
    { icon: "wallet", title: pick("Pay your way", "បង់ប្រាក់តាមចិត្ត"), text: `${t("cart.cash")} · ${t("cart.card")} · ${pick("secure checkout", "ការទូទាត់មានសុវត្ថិភាព")}` },
    { icon: "store", title: pick("Registered local merchant", "អាជីវករក្នុងស្រុកដែលបានចុះឈ្មោះ"), text: pick("Contact the seller any time about this item", "ទាក់ទងអ្នកលក់អំពីទំនិញនេះបានគ្រប់ពេល") },
  ];
  // Short labels on phones so all three tabs fit without scrolling.
  const tabs: { id: Tab; label: string; short: string }[] = [
    { id: "details", label: pick("Product details", "ព័ត៌មានទំនិញ"), short: pick("Details", "ព័ត៌មាន") },
    { id: "specs", label: pick("Specifications", "លក្ខណៈបច្ចេកទេស"), short: pick("Specs", "លក្ខណៈ") },
    { id: "delivery", label: pick("Delivery & payment", "ការដឹក និងការទូទាត់"), short: pick("Delivery", "ការដឹក") },
  ];

  return (
    <div className="express-detail mx-auto max-w-6xl px-4 pb-36 pt-5 sm:pt-7 lg:pb-16">
      <nav className="express-breadcrumb flex min-w-0 items-center gap-2 text-xs text-muted" aria-label={pick("Breadcrumb", "ទីតាំងទំព័រ")}>
        <Link href="/" className="shrink-0 hover:text-brand">{pick("Home", "ទំព័រដើម")}</Link><Icon name="chevron" className="h-3 w-3" />
        <Link href="/express" className="shrink-0 hover:text-brand">GrabExpress</Link><Icon name="chevron" className="h-3 w-3" />
        <Link href={storeUrl} className="max-w-[30%] truncate hover:text-brand">{merchant.businessName}</Link><Icon name="chevron" className="hidden h-3 w-3 sm:block" />
        <span aria-current="page" className="hidden truncate font-medium text-foreground sm:block">{title}</span>
      </nav>

      <div className="mt-4 grid gap-6 sm:mt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(300px,3fr)]">
        {/* Photo */}
        <div className="min-w-0 lg:row-span-2 xl:row-span-1">
          <div className="lg:sticky lg:top-24">
            <div className={`express-photo group relative aspect-square overflow-hidden rounded-[28px] border border-border bg-surface ${zoom ? "is-zooming" : ""}`}
              onMouseMove={offer.imageUrl && !imageFailed ? followZoom : undefined} onMouseLeave={() => setZoom(null)}>
              {offer.imageUrl && !imageFailed
                // Uploaded product photos are served by the backend.
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={offer.imageUrl} alt={title} decoding="async" onError={() => setImageFailed(true)} style={zoom ?? undefined} className="h-full w-full object-contain p-5 sm:p-8" />
                : <div className="grid h-full place-items-center bg-brand-soft text-brand"><Icon name="parcel" className="h-24 w-24 opacity-60" /></div>}
              <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs font-bold text-brand backdrop-blur"><Icon name="parcel" className="h-4 w-4" />GrabExpress</span>
              <div className="absolute right-3 top-3 flex flex-col gap-2">
                <WishlistButton offer={offer} className="border border-border bg-surface" />
                <button type="button" onClick={share} aria-label={pick("Share this product", "ចែករំលែកទំនិញនេះ")} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-foreground transition hover:text-brand"><Icon name="arrow" className="h-4 w-4 -rotate-45" /></button>
              </div>
              {offer.imageUrl && !imageFailed && <span className="express-zoom-hint pointer-events-none absolute bottom-4 right-4 hidden items-center max-lg:!hidden gap-1 rounded-lg bg-foreground/75 px-2.5 py-1.5 text-[11px] font-semibold text-background">
                <Icon name="search" className="h-3.5 w-3.5" />{pick("Hover to zoom", "ដាក់ម៉ៅស៍ដើម្បីពង្រីក")}</span>}
            </div>
          </div>
        </div>

        {/* Product info */}
        <section className="min-w-0" aria-labelledby="express-title">
          <Link href={storeUrl} className="inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><Icon name="store" className="h-4 w-4" /><span className="truncate">{merchant.businessName}</span></Link>
          <h1 id="express-title" className="mt-2 text-[28px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2"><CategoryBadge categoryId={offer.categoryId} />{merchant.city && <span className="flex items-center gap-1 text-xs text-muted"><Icon name="pin" className="h-3.5 w-3.5" />{merchant.city}</span>}</div>

          <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1 border-y border-border py-4">
            <span className="text-4xl font-extrabold tracking-tight text-brand">{money(offer.price)}</span>
            <span className="pb-1 text-sm text-muted">{pick("per item", "ក្នុងមួយមុខ")}</span>
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand"><span className="h-2 w-2 rounded-full bg-brand" />{pick("Available", "មានលក់")}</span>
          </div>

          {promos.length > 0 && <div className="mt-4 rounded-2xl border border-dashed border-brand/40 bg-brand-soft/60 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand"><Icon name="receipt" className="h-3.5 w-3.5" />{pick("Offers for you", "ការផ្ដល់ជូនសម្រាប់អ្នក")}</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {promos.map((p) => /^[A-Z0-9]{4,}$/.test(p)
                ? <li key={p} className="rounded-lg border border-dashed border-brand bg-surface px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-brand" title={pick("Promo code", "លេខកូដប្រូម៉ូសិន")}>{p}</li>
                : <li key={p} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-foreground">{p}</li>)}
            </ul>
          </div>}

          <ul className="mt-5 space-y-3">
            {highlights.map((h) => (
              <li key={h.icon} className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={h.icon} className="h-5 w-5" /></span>
                <span className="min-w-0 pt-0.5"><span className="block text-sm font-semibold">{h.title}</span><span className="block text-xs text-muted">{h.text}</span></span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <h2 className="text-sm font-bold">{pick("About this item", "អំពីទំនិញនេះ")}</h2>
            <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">{description}</p>
            <a href={`#${tabsId}-panel`} onClick={() => setTab("details")} className="mt-1 inline-block text-sm font-semibold text-brand">{pick("See full details", "មើលព័ត៌មានលម្អិត")} ↓</a>
          </div>
        </section>

        {/* Buy box */}
        <aside className="min-w-0" aria-label={pick("Buy this product", "ទិញទំនិញនេះ")}>
          <div className="express-buy-box card space-y-4 p-5 xl:sticky xl:top-24">
            <div className="flex items-baseline justify-between gap-3"><span className="text-2xl font-extrabold text-foreground">{money(offer.price)}</span><span className="text-xs font-semibold text-brand">{pick("In stock", "មានក្នុងស្តុក")}</span></div>
            <p className="flex items-start gap-2 rounded-xl bg-background p-3 text-xs text-muted"><Icon name="pin" className="mt-0.5 h-4 w-4 text-brand" /><span><span className="block font-semibold text-foreground">{pick("Deliver to your address", "ដឹកជូនដល់អាសយដ្ឋានរបស់អ្នក")}</span>{pick("Choose the drop-off at checkout. Delivery fee and promotions are shown before you pay.", "ជ្រើសរើសទីតាំងនៅពេលបញ្ជាទិញ។ ថ្លៃដឹក និងប្រូម៉ូសិនបង្ហាញមុនពេលបង់ប្រាក់។")}</span></p>
            <PartnerProductPurchase key={offer.id} offer={offer} buyNow />
            <div className="border-t border-border pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{pick("Sold by", "លក់ដោយ")}</p>
              <Link href={storeUrl} className="group mt-2 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-lg font-bold text-brand">{merchant.businessName.trim().slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold group-hover:text-brand">{merchant.businessName}</span><span className="block truncate text-xs text-muted">{[merchant.category, merchant.city].filter(Boolean).join(" · ")}</span></span>
                <Icon name="chevron" className="h-4 w-4 text-muted" />
              </Link>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={storeUrl} className="btn-outline h-10 text-xs">{pick("Visit store", "ចូលមើលហាង")}</Link>
                {merchant.contactPhone ? <a href={`tel:${merchant.contactPhone}`} className="btn-outline h-10 text-xs">{pick("Call seller", "ហៅអ្នកលក់")}</a> : <Link href={storeUrl} className="btn-outline h-10 text-xs">{t("merchant.contact")}</Link>}
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-muted"><Icon name="check" className="h-3.5 w-3.5 text-brand" />{pick("Secure checkout · Live order tracking", "ការទូទាត់មានសុវត្ថិភាព · តាមដានការបញ្ជាទិញផ្ទាល់")}</p>
          </div>
        </aside>
      </div>

      {/* Details / specifications / delivery */}
      <section className="mt-10 sm:mt-14" aria-label={pick("More about this product", "ព័ត៌មានបន្ថែមអំពីទំនិញ")}>
        <div role="tablist" aria-label={pick("Product information", "ព័ត៌មានទំនិញ")} className="rail-scroll flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((x) => (
            <button key={x.id} type="button" role="tab" id={`${tabsId}-${x.id}`} aria-selected={tab === x.id} aria-controls={`${tabsId}-panel`} onClick={() => setTab(x.id)}
              className={`-mb-px flex-1 shrink-0 border-b-2 px-2 py-3 text-sm font-semibold transition sm:flex-none sm:px-4 ${tab === x.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground"}`}><span className="sm:hidden">{x.short}</span><span className="hidden sm:inline">{x.label}</span></button>
          ))}
        </div>
        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="scroll-mt-28 py-6">
          {tab === "details" && <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-muted [overflow-wrap:anywhere]">{description}</p>}
          {tab === "specs" && (
            <dl className="card max-w-3xl divide-y divide-border overflow-hidden p-0">
              {specs.map(([k, v]) => <div key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-3 text-sm sm:grid-cols-[200px_minmax(0,1fr)]"><dt className="text-muted">{k}</dt><dd className="font-medium [overflow-wrap:anywhere]">{v}</dd></div>)}
            </dl>
          )}
          {tab === "delivery" && (
            <ol className="grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                ["bag", pick("Place your order", "ដាក់ការបញ្ជាទិញ"), pick("Add to cart and choose your drop-off address.", "ដាក់ក្នុងកន្ត្រក ហើយជ្រើសរើសអាសយដ្ឋាន។")],
                ["store", pick("Seller prepares it", "អ្នកលក់រៀបចំ"), pick("The merchant accepts and packs your item.", "អាជីវករទទួល និងវេចខ្ចប់ទំនិញ។")],
                ["truck", pick("Courier delivers", "អ្នកដឹកជញ្ជូនដឹកជូន"), pick("Follow the delivery live until it arrives. Pay by cash or card.", "តាមដានការដឹកផ្ទាល់រហូតដល់មកដល់។ បង់ជាសាច់ប្រាក់ ឬកាត។")],
              ].map(([icon, h, text], i) => (
                <li key={h} className="card flex gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon as IconName} className="h-5 w-5" /></span><span><span className="block text-sm font-bold">{i + 1}. {h}</span><span className="mt-0.5 block text-xs text-muted">{text}</span></span></li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <ProductRow title={pick(`More from ${merchant.businessName}`, `ទំនិញផ្សេងទៀតពី ${merchant.businessName}`)} href={storeUrl} linkLabel={pick("Visit store", "ចូលមើលហាង")} items={fromStore} />
      <ProductRow title={pick("Similar products", "ទំនិញស្រដៀងគ្នា")} href="/express" linkLabel={pick("Browse GrabExpress", "រកមើល GrabExpress")} items={similar} />

      <PartnerStickyBuyBar offer={offer} title={title} />
      {/* Phones use the pinned buy bar above; wider screens keep the floating cart. */}
      <div className="hidden lg:block"><PartnerCartBar merchantId={merchant.id} /></div>
    </div>
  );
}

function ProductRow({ title, href, linkLabel, items }: { title: string; href: string; linkLabel: string; items: MerchantOffer[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8 border-t border-border pt-8 sm:mt-10 sm:pt-10">
      <div className="flex items-end justify-between gap-4"><h2 className="min-w-0 truncate text-xl font-bold sm:text-2xl">{title}</h2><Link href={href} className="shrink-0 text-sm font-semibold text-brand">{linkLabel} →</Link></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{items.map((item) => <MerchantOfferCard key={item.id} offer={item} compact />)}</div>
    </section>
  );
}

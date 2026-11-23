"use client";

import Link from "next/link";
import { useState } from "react";
import type { MerchantOffer } from "@/lib/api";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { merchantProductText } from "@/lib/merchant-content";
import CategoryBadge from "./CategoryBadge";
import PromotionBadge from "./PromotionBadge";
import Icon from "./Icon";
import MerchantOfferCard from "./MerchantOfferCard";
import WishlistButton from "./WishlistButton";
import { PartnerCartBar, PartnerProductPurchase } from "./PartnerCartControls";

export default function FoodProductDetails({ offer, others }: { offer: MerchantOffer; others: MerchantOffer[] }) {
  const { t, lang, pick } = useT();
  const { title, description } = merchantProductText(offer.title, offer.description, offer.merchant.service, lang);
  const [imageFailed, setImageFailed] = useState(false);
  const merchant = offer.merchant; const storeUrl = `/partners/${merchant.id}`;
  const related = others.filter(p => p.id !== offer.id).slice(0, 4);
  return <div className="food-detail-page">
    <nav className="food-detail-breadcrumb" aria-label={pick("Breadcrumb", "ទីតាំងទំព័រ")}><Link href="/food">GrabFood</Link><span aria-hidden>/</span><Link href={storeUrl}>{merchant.businessName}</Link><span aria-hidden>/</span><span aria-current="page">{title}</span></nav>
    <div className="food-detail-grid">
      <div className="food-detail-visual">
        <div className={`food-detail-photo ${!offer.imageUrl || imageFailed ? "is-placeholder" : ""}`}>
          {offer.imageUrl && !imageFailed
            // Uploaded product photos are served by the backend.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={offer.imageUrl} alt={title} decoding="async" onError={() => setImageFailed(true)} />
            : <div className="food-detail-placeholder"><Icon name="food" /><span>GrabFood</span></div>}
          <span className="food-detail-service"><Icon name="food" />GrabFood</span>
          <Link href={storeUrl} className="food-detail-back" aria-label={pick("Back to restaurant", "ត្រឡប់ទៅហាងអាហារ")}><Icon name="arrow" /></Link>
        </div>
        <Link href={storeUrl} className="food-restaurant-card"><span className="food-restaurant-avatar">{merchant.businessName.trim().slice(0, 1).toUpperCase()}</span><span className="food-restaurant-copy"><small>{pick("FROM THE RESTAURANT", "ពីហាងអាហារ")}</small><strong>{merchant.businessName}</strong>{merchant.city && <span><Icon name="pin" />{merchant.city}</span>}</span><span className="food-restaurant-arrow"><Icon name="arrow" /></span></Link>
      </div>
      <section className="food-detail-info" aria-labelledby="food-detail-title">
        <div className="food-detail-eyebrow"><span className="food-detail-dot" />{pick("A little something delicious", "អាហារឆ្ងាញ់សម្រាប់អ្នក")}</div>
        <CategoryBadge categoryId={offer.categoryId} />
        <div className="flex items-start justify-between gap-3"><h1 id="food-detail-title">{title}</h1><WishlistButton offer={offer} className="mt-1 shrink-0 border border-border" /></div>
        <div className="food-detail-price"><strong>{money(offer.price)}</strong><span>{pick("per item", "ក្នុងមួយមុខ")}</span></div>
        <div className="food-detail-promotions"><PromotionBadge storeId={merchant.id} productId={offer.id} /></div>
        <div className="food-dish-description"><h2>{pick("About this dish", "អំពីម្ហូបនេះ")}</h2><p>{description}</p></div>
        <div className="food-order-details"><div><span className="food-detail-icon"><Icon name="parcel" /></span><span><strong>{pick("Delivered to your door", "ដឹកជូនដល់ទ្វារផ្ទះ")}</strong><small>{pick("Choose your address at checkout", "ជ្រើសរើសអាសយដ្ឋាននៅពេលបញ្ជាទិញ")}</small></span></div><div><span className="food-detail-icon"><Icon name="wallet" /></span><span><strong>{pick("Your preferred way to pay", "បង់ប្រាក់តាមរបៀបដែលអ្នកចូលចិត្ត")}</strong><small>{t("cart.cash")} · {t("cart.card")}</small></span></div></div>
        <PartnerProductPurchase key={offer.id} offer={offer} />
      </section>
    </div>
    {related.length > 0 && <section className="food-related" aria-labelledby="food-related-title"><div className="food-related-heading"><div><span>{pick("KEEP EXPLORING", "ស្វែងរកបន្ថែម")}</span><h2 id="food-related-title">{pick("More from this restaurant", "ម្ហូបផ្សេងទៀតពីហាងនេះ")}</h2></div><Link href={storeUrl}>{pick("View full menu", "មើលមុខម្ហូបទាំងអស់")} <span aria-hidden>→</span></Link></div><div className="food-related-grid">{related.map(item => <MerchantOfferCard key={item.id} offer={item} compact />)}</div></section>}
    <PartnerCartBar merchantId={merchant.id} />
  </div>;
}

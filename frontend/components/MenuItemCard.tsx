"use client";

import { useState } from "react";
import Image from "next/image";
import { money } from "@/lib/brand";
import type { MenuItem } from "@/lib/catalog";
import { STORES } from "@/lib/catalog";
import { addToCart, lineKey, setQty, useShop } from "@/lib/cart";
import { askReplaceCart, withReplaceConfirm } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import ItemOptionsDialog from "./ItemOptionsDialog";
import PromotionBadge from "./PromotionBadge";

/**
 * One dish/product on a store page, as a shop-style product card (photo on top, price and
 * add-to-cart at the bottom). Clicking the photo or name opens the quick-view dialog.
 * - No options: "Add" puts one in the cart, then − 1 + change the amount.
 * - With options (size, spice...): "Choose" opens the options pop-up; a badge shows how many are in the cart.
 * - `closed`: the store is closed, so nothing can be added.
 */
export default function MenuItemCard({ storeId, item, closed = false }: { storeId: string; item: MenuItem; closed?: boolean }) {
  const { t, pick } = useT();
  const { cart } = useShop();
  const [dialogOpen, setDialogOpen] = useState(false);
  const name = pick(item.name, item.km?.name);
  const hasOptions = !!item.options?.length;
  const store = STORES.find((store) => store.id === storeId);
  const photo = item.photo ?? (store?.items[0]?.id === item.id ? store.photo : undefined);
  const inThisStore = cart.storeId === storeId;
  const totalQty = inThisStore ? cart.lines.filter((l) => l.itemId === item.id).reduce((n, l) => n + l.qty, 0) : 0;
  const plainKey = lineKey({ itemId: item.id });
  const plainQty = inThisStore ? cart.lines.find((l) => lineKey(l) === plainKey)?.qty ?? 0 : 0;

  async function add(options: string[] = [], qty = 1) {
    const added = await withReplaceConfirm((confirmReplace) => addToCart(storeId, item.id, confirmReplace, options, qty), askReplaceCart(t));
    if (added) toast(t("store.added", { name }));
    return added;
  }

  return (
    // min-w-0 lets this card shrink inside the grid so long text truncates instead of widening the page.
    <article className={`menu-item-card storefront-product ${closed ? "is-closed" : ""}`}>
      <button type="button" onClick={() => setDialogOpen(true)} aria-haspopup="dialog" aria-label={`${t("partner.viewDetails")}: ${name}`} className="menu-item-details-trigger storefront-product-main">
        <span className="storefront-product-media" aria-hidden>
          {photo ? <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 260px, 50vw" className="object-cover" /> : <span className="storefront-product-emoji">{item.emoji}</span>}
          {item.popular && <span className="storefront-badge">★ {pick("Best seller", "លក់ដាច់")}</span>}
          {totalQty > 0 && <span className="storefront-in-cart">×{totalQty}</span>}
          <span className="storefront-quick-view">{pick("Quick view", "មើលលម្អិត")}</span>
        </span>
        <span className="storefront-product-copy">
          <span className="storefront-product-name">{name}</span>
          <span className="storefront-product-desc">{pick(item.description, item.km?.description)}</span>
        </span>
      </button>
      <div className="storefront-product-tags">
        {hasOptions && <span className="storefront-option-tag">{t("options.customisable")}</span>}
        <PromotionBadge storeId={storeId} productId={item.id} productOnly />
      </div>

      <div className="storefront-product-foot">
        <span className="storefront-price">{hasOptions && <small>{pick("from", "ចាប់ពី")}</small>}{money(item.price)}</span>
        {hasOptions ? (
          <button
            type="button" onClick={() => setDialogOpen(true)} disabled={closed}
            aria-label={totalQty > 0 ? `${t("store.add", { name })} (${t("options.inCart", { n: totalQty })})` : t("store.add", { name })} aria-haspopup="dialog"
            className="storefront-add"
          ><span aria-hidden>+</span>{pick("Choose", "ជ្រើសរើស")}</button>
        ) : plainQty === 0 ? (
          <button type="button" onClick={() => add()} disabled={closed} aria-label={t("store.add", { name })} className="storefront-add">
            <span aria-hidden>+</span>{pick("Add", "បន្ថែម")}
          </button>
        ) : (
          <div className="storefront-stepper">
            <button type="button" onClick={() => setQty(plainKey, plainQty - 1)} aria-label={t("store.decrease")}>−</button>
            <span aria-live="polite">{plainQty}</span>
            <button type="button" onClick={() => setQty(plainKey, plainQty + 1)} disabled={closed} aria-label={t("store.increase")}>+</button>
          </div>
        )}
      </div>

      {dialogOpen && (
        <ItemOptionsDialog
          item={item}
          open={dialogOpen}
          storeName={store?.name}
          imageUrl={photo?.src}
          closed={closed}
          onClose={() => setDialogOpen(false)}
          onAdd={async (options, qty) => { if (await add(options, qty)) setDialogOpen(false); }}
        />
      )}
    </article>
  );
}

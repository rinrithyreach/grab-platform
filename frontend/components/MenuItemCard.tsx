"use client";

import { useState } from "react";
import Image from "next/image";
import { money } from "@/lib/brand";
import type { MenuItem } from "@/lib/catalog";
import { STORES } from "@/lib/catalog";
import { addToCart, lineKey, setQty, useShop } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import ItemOptionsDialog from "./ItemOptionsDialog";
import PromotionBadge from "./PromotionBadge";

const roundBtn = "grid h-8 w-8 place-items-center rounded-full font-bold disabled:cursor-not-allowed disabled:opacity-40";

/**
 * One dish/product on a store page.
 * - No options: "+" adds it, then − 1 + buttons change the amount.
 * - With options (size, spice...): "+" opens the options pop-up; the number shows how many are in the cart.
 * - `closed`: the store is closed, so nothing can be added.
 */
export default function MenuItemCard({ storeId, item, closed = false }: { storeId: string; item: MenuItem; closed?: boolean }) {
  const { t, pick } = useT();
  const { cart } = useShop();
  const [dialogOpen, setDialogOpen] = useState(false);
  const name = pick(item.name, item.km?.name);
  const hasOptions = !!item.options?.length;
  const store = STORES.find((store) => store.id === storeId);
  const photo = store?.items[0]?.id === item.id ? store.photo : undefined;
  const inThisStore = cart.storeId === storeId;
  const totalQty = inThisStore ? cart.lines.filter((l) => l.itemId === item.id).reduce((n, l) => n + l.qty, 0) : 0;
  const plainKey = lineKey({ itemId: item.id });
  const plainQty = inThisStore ? cart.lines.find((l) => lineKey(l) === plainKey)?.qty ?? 0 : 0;

  function add(options: string[] = [], qty = 1) {
    const added = addToCart(storeId, item.id, (otherName) => window.confirm(t("cart.replace", { store: otherName })), options, qty);
    if (added) toast(t("store.added", { name }));
    return added;
  }

  return (
    // min-w-0 lets this card shrink inside the grid so long text truncates instead of widening the page.
    <div className={`menu-item-card card flex min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4 ${closed ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setDialogOpen(true)} aria-haspopup="dialog" aria-label={`${t("partner.viewDetails")}: ${name}`} className="menu-item-details-trigger flex w-full min-w-0 items-center gap-3 text-left sm:gap-4">
          <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-soft text-3xl sm:h-20 sm:w-20" aria-hidden>{photo ? <Image src={photo.src} alt="" fill sizes="80px" className="object-cover" /> : item.emoji}</span>
          <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{name}</span><span className="line-clamp-2 text-sm text-muted">{pick(item.description, item.km?.description)}</span><span className="mt-1 block font-semibold text-brand">{money(item.price)}{hasOptions && <span className="ml-2 text-xs font-normal text-muted">{t("options.customisable")}</span>}</span></span>
        </button>
        <div className="pl-[76px] sm:pl-24"><PromotionBadge storeId={storeId} productId={item.id} /></div>
      </div>

      {hasOptions ? (
        <div className="flex shrink-0 items-center gap-2">
          {totalQty > 0 && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-sm font-semibold text-brand" aria-label={t("options.inCart", { n: totalQty })}>×{totalQty}</span>}
          <button
            onClick={() => setDialogOpen(true)} disabled={closed}
            aria-label={t("store.add", { name })} aria-haspopup="dialog"
            className={`${roundBtn} h-9 w-9 bg-brand text-xl text-white hover:bg-brand-strong dark:text-background`}
          >+</button>
        </div>
      ) : plainQty === 0 ? (
        <button
          onClick={() => add()} disabled={closed}
          aria-label={t("store.add", { name })}
          className={`${roundBtn} h-9 w-9 bg-brand text-xl text-white hover:bg-brand-strong dark:text-background`}
        >+</button>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button onClick={() => setQty(plainKey, plainQty - 1)} aria-label={t("store.decrease")} className={`${roundBtn} border border-border hover:bg-brand-soft`}>−</button>
          <span className="w-5 text-center font-semibold">{plainQty}</span>
          <button onClick={() => setQty(plainKey, plainQty + 1)} disabled={closed} aria-label={t("store.increase")} className={`${roundBtn} bg-brand text-white hover:bg-brand-strong dark:text-background`}>+</button>
        </div>
      )}

      {dialogOpen && (
        <ItemOptionsDialog
          item={item}
          open={dialogOpen}
          storeName={store?.name}
          imageUrl={photo?.src}
          closed={closed}
          onClose={() => setDialogOpen(false)}
          onAdd={(options, qty) => { if (add(options, qty)) setDialogOpen(false); }}
        />
      )}
    </div>
  );
}

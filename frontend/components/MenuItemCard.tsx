"use client";

import { money } from "@/lib/brand";
import { getStore, type MenuItem } from "@/lib/catalog";
import { addToCart, setQty, useShop } from "@/lib/cart";
import { useT } from "@/lib/i18n";

export default function MenuItemCard({ storeId, item }: { storeId: string; item: MenuItem }) {
  const { t, pick } = useT();
  const { cart } = useShop();
  const qty = cart.storeId === storeId ? cart.lines.find((l) => l.itemId === item.id)?.qty ?? 0 : 0;
  const name = pick(item.name, item.km?.name);

  function add() {
    addToCart(storeId, item.id, (otherId) =>
      window.confirm(t("cart.replace", { store: getStore(otherId)?.name ?? "" })));
  }

  return (
    // min-w-0 lets this card shrink inside the grid so long text truncates instead of widening the page.
    <div className="card flex min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-soft text-3xl sm:h-16 sm:w-16">{item.emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{name}</p>
        <p className="line-clamp-2 text-sm text-muted">{pick(item.description, item.km?.description)}</p>
        <p className="mt-1 font-semibold text-brand">{money(item.price)}</p>
      </div>
      {qty === 0 ? (
        <button
          onClick={add}
          aria-label={t("store.add", { name })}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-xl font-bold text-white dark:text-background hover:bg-brand-strong"
        >
          +
        </button>
      ) : (
        <div className="flex shrink-0 flex-col-reverse items-center gap-1 sm:flex-row sm:gap-2">
          <button onClick={() => setQty(item.id, qty - 1)} aria-label={t("store.decrease")} className="grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">−</button>
          <span className="w-5 text-center font-semibold">{qty}</span>
          <button onClick={() => setQty(item.id, qty + 1)} aria-label={t("store.increase")} className="grid h-8 w-8 place-items-center rounded-full bg-brand font-bold text-white dark:text-background hover:bg-brand-strong">+</button>
        </div>
      )}
    </div>
  );
}

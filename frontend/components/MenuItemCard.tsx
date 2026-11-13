"use client";

import { money } from "@/lib/brand";
import type { MenuItem } from "@/lib/catalog";
import { addToCart, setQty, useShop } from "@/lib/cart";

export default function MenuItemCard({ storeId, item }: { storeId: string; item: MenuItem }) {
  const { cart } = useShop();
  const qty = cart.storeId === storeId ? cart.lines.find((l) => l.itemId === item.id)?.qty ?? 0 : 0;

  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-soft text-3xl">{item.emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.name}</p>
        <p className="truncate text-sm text-muted">{item.description}</p>
        <p className="mt-1 font-semibold text-brand">{money(item.price)}</p>
      </div>
      {qty === 0 ? (
        <button
          onClick={() => addToCart(storeId, item.id)}
          aria-label={`Add ${item.name}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-xl font-bold text-white dark:text-background hover:bg-brand-strong"
        >
          +
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setQty(item.id, qty - 1)} aria-label="Decrease" className="grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">−</button>
          <span className="w-5 text-center font-semibold">{qty}</span>
          <button onClick={() => setQty(item.id, qty + 1)} aria-label="Increase" className="grid h-8 w-8 place-items-center rounded-full bg-brand font-bold text-white dark:text-background hover:bg-brand-strong">+</button>
        </div>
      )}
    </div>
  );
}

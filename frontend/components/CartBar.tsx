"use client";

import Link from "next/link";
import { money } from "@/lib/brand";
import { cartDetails, useShop } from "@/lib/cart";
import { useT } from "@/lib/i18n";

/** Floating "View cart" bar shown at the bottom of store pages. */
export default function CartBar() {
  const { t } = useT();
  const { cart } = useShop();
  const { count, subtotal, store } = cartDetails(cart);
  if (!count) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Link
        href="/cart"
        className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-white shadow-xl hover:bg-brand-strong dark:text-background"
      >
        <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-white/20 px-2 font-bold">{count}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-semibold">{t("store.viewCart")}</span>
          <span className="block truncate text-sm opacity-85">{store?.name} · {t("store.items", { n: count })}</span>
        </span>
        <span className="shrink-0 text-lg font-bold">{money(subtotal)}</span>
      </Link>
    </div>
  );
}

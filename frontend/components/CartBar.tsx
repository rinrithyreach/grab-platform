"use client";

import Link from "next/link";
import { money } from "@/lib/brand";
import { cartDetails, useShop } from "@/lib/cart";

/** Floating "View cart" bar shown at the bottom of store pages. */
export default function CartBar() {
  const { cart } = useShop();
  const { count, subtotal, store } = cartDetails(cart);
  if (!count) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-20 px-4">
      <Link
        href="/cart"
        className="mx-auto flex max-w-xl items-center justify-between rounded-full bg-brand px-6 py-3.5 font-semibold text-white shadow-xl hover:bg-brand-strong dark:text-background"
      >
        <span>🛒 {count} item{count > 1 ? "s" : ""} · {store?.name}</span>
        <span>View cart · {money(subtotal)}</span>
      </Link>
    </div>
  );
}

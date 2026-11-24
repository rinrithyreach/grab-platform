"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/brand";
import { cartDetails, setQty, useShop } from "@/lib/cart";
import { getItem } from "@/lib/catalog";
import { useT } from "@/lib/i18n";
import { partnerTotals, setPartnerQty, usePartnerCart } from "@/lib/partner-cart";
import { chosenOptions } from "@/lib/pricing";
import Icon from "./Icon";

/** How many lines the preview lists before "+N more items". */
const SHOWN = 3;

interface PreviewLine { key: string; name: string; detail: string; qty: number; total: number; emoji?: string; imageUrl?: string }

/**
 * The header's cart icon. Hovering it with a mouse (or focusing it with the keyboard) shows a
 * small summary of the cart; clicking goes to the full /cart page. Touch taps go straight to /cart.
 */
export default function CartPreview({ active }: { active: boolean }) {
  const { t, pick } = useT();
  const { cart } = useShop();
  const partner = usePartnerCart();
  const food = cartDetails(cart);
  const partnerSum = partnerTotals(partner);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Only one of the two carts holds items at a time (see lib/cart.ts).
  const isPartner = partner.lines.length > 0;
  const count = food.count + partnerSum.count;
  const subtotal = isPartner ? partnerSum.subtotal : food.subtotal;
  const from = isPartner ? partner.merchantName : food.store?.name;
  const fromHref = isPartner ? undefined : food.store && `/store/${food.store.id}`;
  const lines: PreviewLine[] = isPartner
    ? partner.lines.map((l) => ({ key: l.listingId, name: l.title, detail: money(l.price), qty: l.qty, total: l.price * l.qty, imageUrl: l.imageUrl }))
    : food.lines.map((l) => {
        const item = food.store ? getItem(food.store.id, l.itemId) : undefined;
        const options = item ? chosenOptions(item, l.optionIds).map((o) => pick(o.choice.name, o.choice.km)) : [];
        return { key: l.key, name: pick(l.name, item?.km?.name), detail: [money(l.price), ...options].join(" · "), qty: l.qty, total: l.price * l.qty, emoji: item?.emoji };
      });

  const remove = (key: string) => (isPartner ? setPartnerQty(key, 0) : setQty(key, 0));

  const show = () => { clearTimeout(timer.current); setOpen(true); };
  // A short delay lets the pointer cross the gap between the icon and the panel.
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 150); };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") hide(); }}
      onFocus={show}
      // Only close when focus moves somewhere else on the page: deleting an item removes the
      // focused button (relatedTarget null) and the preview should stay open.
      onBlur={(e) => { if (e.relatedTarget && !ref.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <Link
        href="/cart"
        aria-label={count > 0 ? `${t("nav.cart")} (${count})` : t("nav.cart")}
        aria-current={active ? "page" : undefined}
        aria-expanded={open}
        aria-controls="cart-preview"
        onClick={() => setOpen(false)}
        className={`relative grid h-10 w-10 place-items-center rounded-full hover:bg-brand-soft ${open ? "bg-brand-soft text-brand" : ""}`}
      >
        <Icon name="bag" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-black">
            {count}
          </span>
        )}
      </Link>

      {open && (
        <div
          id="cart-preview"
          onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
          className="card absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] p-4 shadow-xl"
        >
          {/* Invisible bridge over the gap so the panel doesn't close on the way down. */}
          <span aria-hidden className="absolute inset-x-0 -top-2 h-2" />

          {count === 0 ? (
            <div className="py-4 text-center">
              <div aria-hidden className="text-4xl">🛒</div>
              <p className="mt-2 font-semibold">{t("cart.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted">{t("cart.emptyText")}</p>
              <Link href="/food" className="btn-outline mt-4 w-full">{t("cart.browseFood")}</Link>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">{t("cart.title")}</p>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{count}</span>
              </div>
              {from && (
                <p className="mt-0.5 truncate text-sm text-muted">
                  {t("cart.from")}{" "}
                  {fromHref ? <Link href={fromHref} className="font-medium text-brand">{from}</Link> : <span className="font-medium text-foreground">{from}</span>}
                </p>
              )}

              <ul className="mt-3 divide-y divide-border border-y border-border">
                {lines.slice(0, SHOWN).map((l) => (
                  <li key={l.key} className="group flex items-center gap-2 py-2.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-soft text-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.imageUrl ? <img src={l.imageUrl} alt="" className="h-full w-full object-cover" /> : <span aria-hidden>{l.emoji ?? "🛍️"}</span>}
                    </span>
                    <span className="ml-1 min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{l.name}</span>
                      <span className="block truncate text-xs text-muted">{l.qty} × {l.detail}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{money(l.total)}</span>
                    <button
                      type="button"
                      onClick={() => remove(l.key)}
                      aria-label={t("cart.removeItem", { name: l.name })}
                      title={t("cart.removeItem", { name: l.name })}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted opacity-0 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {lines.length > SHOWN && (
                <p className="mt-2 text-xs text-muted">{t("cart.moreItems", { n: lines.length - SHOWN })}</p>
              )}

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted">{t("cart.subtotal")}</span>
                <span className="font-bold tabular-nums">{money(subtotal)}</span>
              </div>
              <Link href="/cart" className="btn-primary mt-3 w-full">
                {t("cart.view")}<Icon name="arrow" />
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

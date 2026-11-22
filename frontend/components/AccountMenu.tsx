"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { money } from "@/lib/brand";
import Icon, { type IconName } from "./Icon";

const ITEMS: { href: string; key: MessageKey; icon: IconName }[] = [
  { href: "/rides", key: "nav.myRides", icon: "car" },
  { href: "/orders", key: "nav.myOrders", icon: "receipt" },
  { href: "/deliveries", key: "nav.deliveries", icon: "truck" },
  { href: "/favorites", key: "fav.title", icon: "heart" },
  { href: "/wallet", key: "nav.wallet", icon: "wallet" },
];

/**
 * One avatar button in the navbar that holds everything about the signed-in user:
 * profile, their rides/orders/deliveries, favourites, wallet, merchant and log out.
 */
export default function AccountMenu({ name, avatarUrl, accountHref, accountLabel, merchant, onLogout, isActive, walletBalance }: {
  name: string;
  /** Wallet balance shown beside the Wallet item. */
  walletBalance?: number;
  avatarUrl?: string | null;
  accountHref: string;
  accountLabel: string;
  merchant: boolean;
  onLogout: () => void;
  /** Marks the link for the page being viewed (aria-current). */
  isActive: (href: string) => boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-brand-soft hover:text-brand";
  const avatar = (size: string) => avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={avatarUrl} alt="" className={`${size} rounded-full object-cover`} />
    : <span className={`${size} grid place-items-center rounded-full bg-brand-soft text-brand`}><Icon name="user" /></span>;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        aria-label={accountLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-10 w-10 place-items-center rounded-full transition-shadow hover:ring-2 hover:ring-brand-soft ${open || isActive(accountHref) ? "ring-2 ring-brand" : ""}`}
      >
        {avatar("h-9 w-9")}
      </button>
      {open && (
        <div role="menu" onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) setOpen(false); }} className="card absolute right-0 top-full z-40 mt-2 w-72 p-2 shadow-xl">
          <Link href={accountHref} role="menuitem" aria-current={isActive(accountHref) ? "page" : undefined} className="flex items-center gap-3 rounded-xl p-3 hover:bg-brand-soft">
            {avatar("h-11 w-11")}
            <span className="min-w-0">
              <span className="block truncate font-semibold">{name}</span>
              <span className="block text-xs text-muted">{accountLabel}</span>
            </span>
          </Link>
          <div className="my-1 border-t border-border" />
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href} role="menuitem" aria-current={isActive(i.href) ? "page" : undefined} className={`${item} ${isActive(i.href) ? "text-brand" : ""}`}><Icon name={i.icon} className="text-muted" /><span className="flex-1">{t(i.key)}</span>{i.href === "/wallet" && walletBalance !== undefined && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold tabular-nums text-brand">{money(walletBalance)}</span>}</Link>
          ))}
          {!merchant && (
            <>
              <div className="my-1 border-t border-border" />
              <Link href="/merchant" role="menuitem" aria-current={isActive("/merchant") ? "page" : undefined} className={`${item} text-brand`}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft"><Icon name="store" className="h-4 w-4" /></span>
                {t("nav.merchant")}
              </Link>
            </>
          )}
          <div className="my-1 border-t border-border" />
          <button type="button" role="menuitem" onClick={onLogout} className={`${item} w-full text-left`}><Icon name="logout" className="text-muted" />{t("nav.logout")}</button>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { cartDetails, useShop } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import SettingsMenu from "./SettingsMenu";

const LINKS: { href: string; key: MessageKey }[] = [
  { href: "/ride", key: "nav.ride" },
  { href: "/food", key: "nav.food" },
  { href: "/mart", key: "nav.mart" },
  { href: "/rides", key: "nav.myRides" },
  { href: "/orders", key: "nav.myOrders" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { t } = useT();
  const { user, logout } = useAuth();
  const { cart } = useShop();
  const { count } = cartDetails(cart);
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-brand">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-base text-white dark:text-background">{BRAND.name[0]}</span>
          {BRAND.name}
        </Link>

        <ul className="ml-6 hidden gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-soft ${
                  isActive(l.href) ? "bg-brand-soft text-brand" : "text-muted"
                }`}
              >
                {t(l.key)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1">
          <SettingsMenu />
          <Link href="/cart" aria-label={t("nav.cart")} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-brand-soft">
            <span className="text-xl">🛒</span>
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-black">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="ml-1 hidden items-center gap-2 sm:flex">
              <span className="text-sm text-muted">{t("nav.hi", { name: user.fullName.split(" ")[0] })}</span>
              <button onClick={logout} className="btn-outline h-9 px-4 text-sm">{t("nav.logout")}</button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary ml-1 hidden h-9 px-4 text-sm sm:inline-flex">{t("nav.login")}</Link>
          )}
          <button
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-brand-soft lg:hidden"
            aria-label={t("nav.menu")}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
      </nav>

      {open && (
        <ul className="border-t border-border px-4 py-2 lg:hidden" onClick={() => setOpen(false)}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`block rounded-lg px-3 py-2.5 font-medium hover:bg-brand-soft ${isActive(l.href) ? "text-brand" : ""}`}
              >
                {t(l.key)}
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-border pt-2">
            {user ? (
              <button onClick={logout} className="w-full rounded-lg px-3 py-2.5 text-left font-medium hover:bg-brand-soft">
                {t("nav.logout")} ({user.fullName})
              </button>
            ) : (
              <Link href="/login" className="block rounded-lg px-3 py-2.5 font-medium text-brand hover:bg-brand-soft">{t("nav.login")}</Link>
            )}
          </li>
        </ul>
      )}
    </header>
  );
}

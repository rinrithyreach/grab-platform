"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { cartDetails, useShop } from "@/lib/cart";
import { STORES, type StoreKind } from "@/lib/catalog";
import { useT, type MessageKey } from "@/lib/i18n";
import SettingsMenu from "./SettingsMenu";

const LINKS: { href: string; key: MessageKey }[] = [
  { href: "/ride", key: "nav.ride" },
  { href: "/food", key: "nav.food" },
  { href: "/mart", key: "nav.mart" },
  { href: "/rides", key: "nav.myRides" },
  { href: "/orders", key: "nav.myOrders" },
];

/** Food and Mart open with + / − in the mobile drawer to list their stores. */
const EXPANDABLE: Partial<Record<string, StoreKind>> = { "/food": "food", "/mart": "mart" };

export default function Navbar() {
  const pathname = usePathname();
  const { t } = useT();
  const { user, logout } = useAuth();
  const { cart } = useShop();
  const { count } = cartDetails(cart);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const close = () => setOpen(false);

  // While the drawer is open: Escape closes it and the page behind can't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const row = "flex w-full items-center justify-between border-b border-border px-5 py-4 text-left text-sm font-semibold uppercase tracking-wider";

  return (
    <>
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
            <Link href="/profile" aria-label={t("nav.profile")} title={t("nav.profile")} className={`hidden h-10 w-10 place-items-center rounded-full text-lg hover:bg-brand-soft sm:grid ${isActive("/profile") ? "bg-brand-soft" : ""}`}>
              <span aria-hidden>👤</span>
            </Link>
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
              className="grid h-10 w-10 place-items-center rounded-full text-lg hover:bg-brand-soft lg:hidden"
              aria-label={t("nav.menu")}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(true)}
            >
              ☰
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer. Lives outside <header>: the header's blur would trap a fixed element inside it. */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} inert={!open}>
        {/* Dimmed page on the left; tap it to close */}
        <div
          aria-hidden
          onClick={close}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          id="mobile-menu"
          aria-label={t("nav.menu")}
          onClick={(e) => { if ((e.target as HTMLElement).closest("a")) close(); }}
          className={`absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col bg-surface shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Top bar: greeting (or brand) + close */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="min-w-0 truncate text-sm text-muted">
              {user ? <><span className="text-brand">●</span> {t("nav.hi", { name: user.fullName })}</> : BRAND.name}
            </span>
            <button onClick={close} aria-label={t("nav.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-accent hover:bg-brand-soft">✕</button>
          </div>

          <nav className="flex-1 overflow-y-auto">
            <ul>
              <li><Link href="/" className={`${row} ${pathname === "/" ? "text-brand" : ""}`}>{t("nav.home")}</Link></li>
              {LINKS.map((l) => {
                const kind = EXPANDABLE[l.href];
                if (!kind) {
                  return (
                    <li key={l.href}>
                      <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={`${row} ${isActive(l.href) ? "text-brand" : ""}`}>
                        {t(l.key)}
                      </Link>
                    </li>
                  );
                }
                const isOpen = expanded === l.href;
                return (
                  <li key={l.href}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : l.href)}
                      className={`${row} ${isActive(l.href) ? "text-brand" : ""}`}
                    >
                      {t(l.key)}
                      <span aria-hidden className="text-lg font-normal leading-none">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && (
                      <ul className="border-b border-border bg-background py-1">
                        <li>
                          <Link href={l.href} className="block px-5 py-2.5 text-sm font-medium text-brand">
                            {t(kind === "food" ? "nav.allFood" : "nav.allMart")}
                          </Link>
                        </li>
                        {STORES.filter((s) => s.kind === kind).map((s) => (
                          <li key={s.id}>
                            <Link
                              href={`/store/${s.id}`}
                              className={`block px-5 py-2.5 text-sm hover:text-brand ${pathname === `/store/${s.id}` ? "font-semibold text-brand" : ""}`}
                            >
                              {s.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
              <li><Link href="/wallet" className={`${row} ${pathname === "/wallet" ? "text-brand" : ""}`}>{t("nav.wallet")}</Link></li>
              <li><Link href="/profile" className={`${row} ${pathname === "/profile" ? "text-brand" : ""}`}>{t("nav.profile")}</Link></li>
              <li>
                <Link href="/cart" className={`${row} ${pathname === "/cart" ? "text-brand" : ""}`}>
                  {t("nav.cart")}
                  {count > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-black">{count}</span>}
                </Link>
              </li>
            </ul>
          </nav>

          <div className="border-t border-border p-5">
            {user ? (
              <button onClick={() => { logout(); close(); }} className="btn-outline w-full">{t("nav.logout")}</button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" className="btn-primary">{t("nav.login")}</Link>
                <Link href="/register" className="btn-outline">{t("footer.signUp")}</Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

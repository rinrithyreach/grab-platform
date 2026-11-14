"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { BRAND, PROJECT, SOCIAL_LINKS } from "@/lib/brand";
import { cartDetails, useShop } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import { SOCIAL_ICON_PATHS } from "./social-icon-paths";

function FooterLinks({ title, links }: { title: MessageKey; links: { href: string; label: string }[] }) {
  const { t } = useT();
  return (
    <div>
      <p className="font-semibold">{t(title)}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="hover:text-brand">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { t } = useT();
  const { user } = useAuth();
  const pathname = usePathname();
  const { cart } = useShop();
  // Store pages show a floating "View cart" bar; leave room so it doesn't cover the footer.
  const cartBarVisible = pathname.startsWith("/store/") && cartDetails(cart).count > 0;

  return (
    <footer className={`mt-16 border-t border-border bg-surface ${cartBarVisible ? "pb-24" : ""}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
        <div className="col-span-2 lg:col-span-1">
          <p className="flex items-center gap-2 text-lg font-extrabold text-brand">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white dark:text-background">{BRAND.name[0]}</span>
            {BRAND.name}
          </p>
          <p className="mt-3 max-w-xs text-sm text-muted">{t("brand.tagline")}</p>
        </div>

        <FooterLinks
          title="footer.services"
          links={[
            { href: "/ride", label: t("footer.bookRide") },
            { href: "/food", label: t("footer.foodDelivery") },
            { href: "/mart", label: t("nav.mart") },
          ]}
        />

        <FooterLinks
          title="footer.account"
          links={[
            { href: "/rides", label: t("nav.myRides") },
            { href: "/orders", label: t("nav.myOrders") },
            { href: "/cart", label: t("nav.cart") },
            ...(user ? [] : [
              { href: "/login", label: t("nav.login") },
              { href: "/register", label: t("footer.signUp") },
            ]),
          ]}
        />

        <div className="col-span-2 lg:col-span-1">
          <p className="font-semibold">{t("footer.contact")}</p>
          <p className="mt-3 text-sm text-muted">{t("footer.contactText")}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.network}>
                <a
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-brand hover:text-white dark:hover:text-background"
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px] fill-current">
                    <path d={SOCIAL_ICON_PATHS[s.network]} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year: PROJECT.year, brand: BRAND.name, team: PROJECT.team })}</p>
          <p>{t("footer.disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { BRAND, PROJECT, SOCIAL_LINKS } from "@/lib/brand";
import { cartDetails, useShop } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import { useHydratedPathname } from "@/lib/navigation";
import { SOCIAL_ICON_PATHS } from "./social-icon-paths";
import { usePlatformSettings } from "@/lib/platform";
import BrandMark from "./BrandMark";

function FooterLinks({ title, links, className = "", listClassName = "" }: {
  title: MessageKey;
  links: { href: string; label: string }[];
  className?: string;
  listClassName?: string;
}) {
  const { t } = useT();
  return (
    <div className={className}>
      <p className="font-semibold">{t(title)}</p>
      <ul className={`mt-3 grid gap-x-4 gap-y-2 text-sm text-muted ${listClassName}`}>
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="inline-block hover:text-brand">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { t } = useT();
  const { user } = useAuth();
  const platform = usePlatformSettings();
  const merchant = user?.role === "Merchant";
  const pathname = useHydratedPathname();
  const { cart } = useShop();
  // Store pages show a floating "View cart" bar; leave room so it doesn't cover the footer.
  const cartBarVisible = pathname.startsWith("/store/") && cartDetails(cart).count > 0;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <footer className={`app-footer mt-14 border-t border-border bg-surface ${cartBarVisible ? "pb-24" : ""}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-7 px-4 py-10 lg:grid-cols-[1.3fr_0.8fr_1.5fr_1.3fr]">
        <div className="col-span-2 lg:col-span-1">
          <p className="flex items-center gap-2 text-lg font-extrabold text-brand">
            <BrandMark />
          </p>
          <p className="mt-3 max-w-xs text-sm text-muted">{t("brand.tagline")}</p>
        </div>

        <FooterLinks
          title="footer.services"
          className="col-span-2 lg:col-span-1"
          listClassName="grid-cols-3 lg:grid-cols-1"
          links={[
            { href: "/ride", label: t("footer.bookRide") },
            { href: "/food", label: t("footer.foodDelivery") },
            { href: "/express", label: t("nav.express") },
          ]}
        />

        <FooterLinks
          title="footer.account"
          className="col-span-2 lg:col-span-1"
          listClassName="grid-cols-3 lg:grid-cols-2"
          links={[
            { href: "/rides", label: t("nav.myRides") },
            { href: "/orders", label: t("nav.myOrders") },
            { href: "/deliveries", label: t("nav.deliveries") },
            { href: "/cart", label: t("nav.cart") },
            { href: "/wallet", label: t("nav.wallet") },
            ...(merchant ? [{ href: "/merchant", label: t("nav.myMerchant") }] : [
              { href: "/profile", label: t("nav.profile") },
              { href: "/merchant", label: t("nav.merchant") },
            ]),
            ...(user ? [] : [
              { href: "/login", label: t("nav.login") },
              { href: "/register", label: t("footer.signUp") },
            ]),
          ]}
        />

        <div className="col-span-2 lg:col-span-1">
          <p className="font-semibold">{t("footer.contact")}</p>
          <p className="mt-3 text-sm text-muted">{t("footer.contactText")}</p>
          {platform && <address className="mt-3 space-y-1.5 break-words text-sm not-italic text-muted">
            {platform.supportEmail && <a className="block hover:text-brand" href={`mailto:${platform.supportEmail}`}>{platform.supportEmail}</a>}
            {platform.supportPhone && <a className="block hover:text-brand" href={`tel:${platform.supportPhone}`}>{platform.supportPhone}</a>}
            {platform.supportHours && <p>{platform.supportHours}</p>}
            {platform.officeAddress && <p>{platform.officeAddress}</p>}
          </address>}
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
          <p>{t("footer.disclaimer")} · <Link href="/credits" className="underline hover:text-brand">{t("footer.credits")}</Link></p>
        </div>
      </div>
    </footer>
  );
}

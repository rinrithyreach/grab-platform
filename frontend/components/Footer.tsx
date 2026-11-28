"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { BRAND, PROJECT, SOCIAL_LINKS } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { useHydratedPathname } from "@/lib/navigation";
import { SOCIAL_ICON_PATHS } from "./social-icon-paths";
import { usePlatformSettings } from "@/lib/platform";
import BrandMark from "./BrandMark";
import Icon from "./Icon";

function FooterSection({ title, children }: { title: MessageKey; children: ReactNode }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return (
    <section className="min-w-0 border-t border-border sm:border-0">
      <h2 className="font-semibold">
        <button type="button" aria-expanded={expanded} aria-controls={panelId}
          onClick={() => setExpanded(!expanded)}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-sm sm:hidden">
          {t(title)}
          <Icon name="chevron" className={`size-4 text-muted ${expanded ? "-rotate-90" : "rotate-90"}`} />
        </button>
        <span className="hidden sm:inline">{t(title)}</span>
      </h2>
      <div id={panelId} className={`${expanded ? "block" : "hidden"} pb-2 sm:block sm:pb-0`}>
        {children}
      </div>
    </section>
  );
}

function FooterLinks({ title, links, listClassName }: {
  title: MessageKey;
  links: { href: string; label: string }[];
  listClassName: string;
}) {
  const { t } = useT();
  return (
    <FooterSection title={title}>
      <nav aria-label={t(title)}>
        <ul className={`grid gap-x-4 text-sm text-muted sm:mt-2 lg:mt-3 lg:gap-y-2 ${listClassName}`}>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="flex min-h-11 items-center py-1 leading-relaxed hover:text-brand lg:min-h-0 lg:py-0">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </FooterSection>
  );
}

export default function Footer() {
  const { t } = useT();
  const { user } = useAuth();
  const platform = usePlatformSettings();
  const merchant = user?.role === "Merchant";
  const pathname = useHydratedPathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <footer className="app-footer mt-3 border-t border-border bg-surface wrap-anywhere sm:mt-6 lg:mt-14">
      <div className="mx-auto grid max-w-6xl grid-cols-1 px-4 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4 sm:py-5 lg:grid-cols-[1.3fr_0.8fr_1.5fr_1.3fr] lg:py-8">
        <div className="flex items-center gap-3 py-3 sm:block sm:py-0">
          <BrandMark />
          <p className="max-w-xs text-sm text-muted sm:mt-2">{t("brand.tagline")}</p>
        </div>

        <FooterLinks
          title="footer.services"
          listClassName="grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] lg:grid-cols-1"
          links={[
            { href: "/ride", label: t("footer.bookRide") },
            { href: "/food", label: t("footer.foodDelivery") },
            { href: "/express", label: t("nav.express") },
          ]}
        />

        <FooterLinks
          title="footer.account"
          listClassName="grid-cols-2"
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

        <FooterSection title="footer.contact">
          <p className="text-sm text-muted sm:mt-2">{t("footer.contactText")}</p>
          {platform && <address className="mt-3 space-y-1.5 text-sm not-italic text-muted">
            {platform.supportEmail && <a className="flex min-h-11 items-center hover:text-brand lg:min-h-0" href={`mailto:${platform.supportEmail}`}>{platform.supportEmail}</a>}
            {platform.supportPhone && <a className="flex min-h-11 items-center hover:text-brand lg:min-h-0" href={`tel:${platform.supportPhone}`}>{platform.supportPhone}</a>}
            {platform.supportHours && <p>{platform.supportHours}</p>}
            {platform.officeAddress && <p>{platform.officeAddress}</p>}
          </address>}
          <ul className="mt-4 flex flex-wrap gap-1 sm:gap-2">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.network}>
                <a
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-brand hover:text-white lg:size-10 dark:hover:text-background"
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px] fill-current">
                    <path d={SOCIAL_ICON_PATHS[s.network]} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </FooterSection>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl py-3 pr-20 pl-4 text-xs text-muted lg:px-4 lg:py-6">
          {t("footer.copyright", { year: PROJECT.year, brand: BRAND.name, team: PROJECT.team })}
        </p>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { useHydratedPathname } from "@/lib/navigation";
import { useT } from "@/lib/i18n";
import Icon, { type IconName } from "./Icon";

export default function MobileNav({ accountHref }: { accountHref: string }) {
  const pathname = useHydratedPathname();
  const { t, pick } = useT();
  const links: { href: string; label: string; icon: IconName; active?: boolean }[] = [
    { href: "/", label: t("nav.home"), icon: "home" },
    { href: "/ride", label: t("nav.ride"), icon: "car", active: pathname === "/ride" || pathname === "/rides" },
    { href: "/food", label: t("nav.food"), icon: "food" },
    { href: "/express", label: t("nav.express"), icon: "parcel" },
    { href: accountHref, label: pick("Account", "គណនី"), icon: "user" },
  ];
  return <nav className="mobile-bottom-nav" aria-label={pick("Quick navigation", "ការរុករករហ័ស")} style={{ viewTransitionName: "bottom-navigation" }}>
    {links.map((link) => {
      const active = link.active ?? (pathname === link.href || pathname.startsWith(`${link.href}/`));
      return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}><span className="bottom-icon"><Icon name={link.icon} filled={active && link.icon === "heart"} /></span><span>{link.label}</span></Link>;
    })}
  </nav>;
}

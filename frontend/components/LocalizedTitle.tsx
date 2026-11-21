"use client";

import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { useHydratedPathname } from "@/lib/navigation";

const TITLES: Record<string, MessageKey> = {
  "/": "nav.home",
  "/cart": "cart.title",
  "/credits": "credits.title",
  "/deliveries": "nav.deliveries",
  "/express": "express.title",
  "/food": "food.title",
  "/favorites": "fav.title",
  "/login": "nav.login",
  "/mart": "mart.title",
  "/merchant": "nav.merchant",
  "/merchant/register": "merchant.register",
  "/orders": "orders.title",
  "/profile": "profile.title",
  "/register": "register.title",
  "/ride": "ride.title",
  "/rides": "rides.title",
  "/wallet": "wallet.name",
};

/** Metadata stays available to crawlers; this follows the visitor's local language choice. */
export default function LocalizedTitle() {
  const pathname = useHydratedPathname();
  const { t } = useT();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/store/") || pathname === "/admin" || pathname.startsWith("/admin/")) return;
    const key = TITLES[pathname]
      ?? (pathname.startsWith("/partners/") ? pathname.includes("/products/") ? "partner.viewDetails" : "merchant.offers" : "notFound.title");
    document.title = `${t(key)} · ${BRAND.name}`;
  }, [pathname, t]);
  return null;
}

"use client";

/** ♡ on a merchant product: saves it to the wishlist for price-drop and restock alerts. */
import type { MerchantOffer } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { merchantProductTitle } from "@/lib/merchant-content";
import { toast } from "@/lib/toast";
import { toggleWishlist, useWishlist } from "@/lib/wishlist";
import Icon from "./Icon";

export default function WishlistButton({ offer, className = "" }: { offer: MerchantOffer; className?: string }) {
  const { t, lang } = useT();
  const saved = useWishlist().some((item) => item.listingId === offer.id);
  const name = merchantProductTitle(offer.title, lang, offer.merchant.service);
  const label = t(saved ? "wish.remove" : "wish.add", { name });
  return (
    <button
      type="button"
      onClick={(e) => {
        // Cards are links: saving must not also open the product.
        e.preventDefault(); e.stopPropagation();
        const now = toggleWishlist(offer);
        toast(t(now ? "wish.added" : "wish.removed"), now ? "success" : "info", { action: now ? { label: t("wish.title"), href: "/favorites" } : undefined });
      }}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`favorite-button grid h-10 w-10 place-items-center rounded-full bg-surface/95 shadow-sm backdrop-blur ${saved ? "text-red-500" : "text-muted"} ${className}`}
    >
      <Icon name="heart" filled={saved} />
    </button>
  );
}

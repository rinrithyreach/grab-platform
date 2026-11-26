"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT, type MessageKey } from "@/lib/i18n";
import { hasInAppHistory } from "@/lib/navigation";

/**
 * "← Back" returns to the page the user came from inside the site (e.g. Ride → Food → Back
 * lands on Ride). When they arrived directly (no earlier page here), it goes UP to `href`.
 */
export default function BackButton({ href = "/", label = "common.back" }: { href?: string; label?: MessageKey }) {
  const { t } = useT();
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !hasInAppHistory()) return;
        e.preventDefault();
        router.back();
      }}
      className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand"
    >
      {t(label)}
    </Link>
  );
}

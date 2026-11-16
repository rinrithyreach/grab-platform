"use client";

import Link from "next/link";
import { useT, type MessageKey } from "@/lib/i18n";

/**
 * "← Back" goes UP one level to the page's parent (e.g. store → Food, Food → Home),
 * no matter how the user got here. The browser's own back button still retraces history.
 */
export default function BackButton({ href = "/", label = "common.back" }: { href?: string; label?: MessageKey }) {
  const { t } = useT();
  return (
    <Link
      href={href}
      className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand"
    >
      {t(label)}
    </Link>
  );
}

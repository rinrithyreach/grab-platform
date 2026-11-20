"use client";

import Link from "next/link";
import type { CustomerReturnPage } from "@/lib/auth-destination";
import { useT, type MessageKey } from "@/lib/i18n";

export default function LoginRequired({ what, returnTo }: { what: MessageKey; returnTo?: CustomerReturnPage }) {
  const { t } = useT();
  return (
    <div className="card mx-auto mt-6 max-w-md p-8 text-center">
      <p className="text-5xl">🔒</p>
      <p className="mt-3 font-semibold">{t("loginRequired.title", { what: t(what) })}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href={returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login"} className="btn-primary">{t("nav.login")}</Link>
        <Link href={returnTo ? `/register?next=${encodeURIComponent(returnTo)}` : "/register"} className="btn-outline">{t("register.submit")}</Link>
      </div>
    </div>
  );
}

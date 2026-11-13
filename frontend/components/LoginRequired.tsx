"use client";

import Link from "next/link";
import { useT, type MessageKey } from "@/lib/i18n";

export default function LoginRequired({ what }: { what: MessageKey }) {
  const { t } = useT();
  return (
    <div className="card mx-auto mt-6 max-w-md p-8 text-center">
      <p className="text-5xl">🔒</p>
      <p className="mt-3 font-semibold">{t("loginRequired.title", { what: t(what) })}</p>
      <p className="mt-1 text-sm text-muted">{t("loginRequired.note")}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/login" className="btn-primary">{t("nav.login")}</Link>
        <Link href="/register" className="btn-outline">{t("register.submit")}</Link>
      </div>
    </div>
  );
}

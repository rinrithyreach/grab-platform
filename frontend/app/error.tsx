"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

/**
 * Shown instead of a page that crashed, keeping the navbar and footer.
 * Next.js 16 passes `retry` (re-fetch and re-render the page), see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md
 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="text-6xl" aria-hidden>😵</p>
      <h1 className="mt-6 text-2xl font-bold">{t("errorPage.title")}</h1>
      <p className="mt-2 text-muted">{t("errorPage.text")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={() => retry()} className="btn-primary">{t("errorPage.retry")}</button>
        <Link href="/" className="btn-outline">{t("notFound.home")}</Link>
      </div>
    </div>
  );
}

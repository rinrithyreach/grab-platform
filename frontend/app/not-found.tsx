import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";

export const metadata: Metadata = { title: "Page not found" };

/** Shown for unknown URLs and when a page calls notFound() (e.g. a store that doesn't exist). */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="text-7xl font-extrabold text-brand">404</p>
      <p className="mt-2 text-5xl" aria-hidden>🛵💨</p>
      <h1 className="mt-6 text-2xl font-bold"><T k="notFound.title" /></h1>
      <p className="mt-2 text-muted"><T k="notFound.text" /></p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary"><T k="notFound.home" /></Link>
        <Link href="/food" className="btn-outline"><T k="cart.browseFood" /></Link>
      </div>
    </div>
  );
}

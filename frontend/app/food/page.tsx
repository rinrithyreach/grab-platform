import type { Metadata } from "next";
import { Suspense } from "react";
import { T } from "@/lib/i18n";
import StoreBrowser from "@/components/StoreBrowser";
import BackButton from "@/components/BackButton";
import MerchantOffers from "@/components/MerchantOffers";

export const metadata: Metadata = { title: "Food delivery" };

type Search = Promise<{ category?: string | string[] }>;

/** Reads ?category= (from the home page's "Shop by category") without blocking the rest of the page. */
async function FoodStores({ searchParams }: { searchParams: Search }) {
  const { category } = await searchParams;
  const initial = typeof category === "string" ? category : undefined;
  // Keyed so a new ?category= link re-selects the chip even when the page is reused.
  return <StoreBrowser key={initial ?? ""} kind="food" initialCategory={initial} />;
}

export default function FoodPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold"><T k="food.title" /></h1>
      <p className="mt-1 text-muted"><T k="food.subtitle" /></p>
      <div className="mt-6"><Suspense fallback={<StoreBrowser kind="food" />}><FoodStores searchParams={searchParams} /></Suspense></div>
      <MerchantOffers service="GrabFood" />
    </div>
  );
}

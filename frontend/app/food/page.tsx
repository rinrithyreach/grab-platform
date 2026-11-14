import type { Metadata } from "next";
import { T } from "@/lib/i18n";
import StoreBrowser from "@/components/StoreBrowser";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = { title: "Food delivery" };

export default function FoodPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold"><T k="food.title" /></h1>
      <p className="mt-1 text-muted"><T k="food.subtitle" /></p>
      <div className="mt-6"><StoreBrowser kind="food" /></div>
    </div>
  );
}

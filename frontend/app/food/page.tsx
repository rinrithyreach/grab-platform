import type { Metadata } from "next";
import StoreBrowser from "@/components/StoreBrowser";

export const metadata: Metadata = { title: "Food delivery" };

export default function FoodPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Food delivery</h1>
      <p className="mt-1 text-muted">Hungry? Your favourite local spots, delivered.</p>
      <div className="mt-6"><StoreBrowser kind="food" /></div>
    </div>
  );
}

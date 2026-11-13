import type { Metadata } from "next";
import { T } from "@/lib/i18n";
import StoreBrowser from "@/components/StoreBrowser";

export const metadata: Metadata = { title: "Mart" };

export default function MartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold"><T k="mart.title" /></h1>
      <p className="mt-1 text-muted"><T k="mart.subtitle" /></p>
      <div className="mt-6"><StoreBrowser kind="mart" /></div>
    </div>
  );
}

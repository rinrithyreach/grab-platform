import type { Metadata } from "next";
import { Suspense } from "react";
import MerchantProductDetails from "@/components/MerchantProductDetails";
import { T } from "@/lib/i18n";

export const metadata: Metadata = { title: "Product details" };

export default function MerchantProductPage({ params }: { params: Promise<{ id: string; listingId: string }> }) {
  return <Suspense fallback={<p role="status" className="mx-auto max-w-5xl p-8 text-muted"><T k="merchant.loading" /></p>}><ProductContent params={params} /></Suspense>;
}

async function ProductContent({ params }: { params: Promise<{ id: string; listingId: string }> }) {
  const { id, listingId } = await params;
  return <MerchantProductDetails key={`${id}:${listingId}`} merchantId={id} listingId={listingId} />;
}

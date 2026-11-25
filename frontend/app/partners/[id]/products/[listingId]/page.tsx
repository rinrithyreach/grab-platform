import type { Metadata } from "next";
import { Suspense } from "react";
import MerchantProductDetails from "@/components/MerchantProductDetails";
import { ProductDetailSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Product details" };

export default function MerchantProductPage({ params }: { params: Promise<{ id: string; listingId: string }> }) {
  return <Suspense fallback={<ProductDetailSkeleton />}><ProductContent params={params} /></Suspense>;
}

async function ProductContent({ params }: { params: Promise<{ id: string; listingId: string }> }) {
  const { id, listingId } = await params;
  return <MerchantProductDetails key={`${id}:${listingId}`} merchantId={id} listingId={listingId} />;
}

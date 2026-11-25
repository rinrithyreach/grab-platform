import type { Metadata } from "next";
import { Suspense } from "react";
import MerchantStorefront from "@/components/MerchantStorefront";
import { StorefrontSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Merchant products & services" };

export default function MerchantCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<StorefrontSkeleton />}><MerchantContent params={params} /></Suspense>;
}

async function MerchantContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MerchantStorefront key={id} id={id} />;
}

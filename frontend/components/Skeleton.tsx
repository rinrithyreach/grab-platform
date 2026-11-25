"use client";

/**
 * Loading placeholders shaped like the content they stand in for, so the page
 * keeps its layout while data arrives instead of showing "Loading…" text.
 * Screen readers hear one "Loading…" status; the grey shapes are hidden from them.
 */
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

/** One shimmering block. Size and shape come from `className` (e.g. "h-4 w-32 rounded-full"). */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

/** Wraps placeholders: announces loading once and hides the shapes from assistive tech. */
export function SkeletonGroup({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  const { t } = useT();
  return (
    <div className={className} aria-busy="true">
      <span role="status" className="sr-only">{label ?? t("common.loading")}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

/** Same frame as MerchantOfferCard: 4:3 photo, title, merchant, price. */
export function OfferCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="card h-full overflow-hidden">
      <Bone className="aspect-4/3 w-full rounded-none" />
      <div className={compact ? "space-y-2.5 p-4" : "space-y-2.5 p-3 sm:p-5"}>
        {!compact && <div className="flex justify-between gap-3"><Bone className="h-3 w-16 rounded-full" /><Bone className="h-4 w-12 rounded-full" /></div>}
        <Bone className="h-4 w-4/5 rounded-full" />
        <Bone className="h-5 w-20 rounded-full" />
        <Bone className="h-3 w-1/2 rounded-full" />
        <div className="flex items-center justify-between pt-1"><Bone className="h-5 w-16 rounded-full" />{compact && <Bone className="h-3 w-12 rounded-full" />}</div>
      </div>
    </div>
  );
}

/** Home-page rail: same widths as the real swipeable row. */
export function OfferRailSkeleton() {
  return (
    <SkeletonGroup className="-mx-4 mt-4 overflow-hidden px-4 pb-2">
      <div className="flex w-full gap-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="w-[68%] shrink-0 sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"><OfferCardSkeleton compact /></div>)}
      </div>
    </SkeletonGroup>
  );
}

/** Service pages: the same 2/3-column grid as the loaded list. */
export function OfferGridSkeleton({ count = 6, className = "mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" }: { count?: number; className?: string }) {
  return (
    <SkeletonGroup>
      <div className={className}>{Array.from({ length: count }, (_, i) => <OfferCardSkeleton key={i} />)}</div>
    </SkeletonGroup>
  );
}

/** Home hero carousel frame while banners are fetched. */
export function HeroSkeleton() {
  return (
    <SkeletonGroup className="mx-auto max-w-6xl px-4">
      <div className="hero-skeleton relative flex h-56 w-full flex-col justify-center gap-3 overflow-hidden rounded-[20px] px-6 sm:h-80 sm:rounded-[26px] sm:px-14">
        <Bone className="h-5 w-32 rounded-lg" />
        <Bone className="h-8 w-3/5 rounded-xl sm:h-12" />
        <Bone className="h-8 w-2/5 rounded-xl sm:h-12" />
        <Bone className="mt-2 h-10 w-32 rounded-xl" />
        <Bone className="absolute right-[6%] top-1/2 hidden h-56 w-56 -translate-y-1/2 rounded-full sm:block" />
      </div>
    </SkeletonGroup>
  );
}

/** A merchant's storefront: info card, then their products. */
export function StorefrontSkeleton() {
  return (
    <SkeletonGroup className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <Bone className="h-4 w-24 rounded-full" />
      <div className="card mt-5 grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3"><Bone className="h-4 w-40 rounded-full" /><Bone className="h-9 w-3/4 rounded-xl" /><Bone className="mt-4 h-3 w-full rounded-full" /><Bone className="h-3 w-11/12 rounded-full" /><Bone className="h-3 w-2/3 rounded-full" /></div>
        <div className="space-y-3 rounded-xl bg-brand-soft/60 p-5"><Bone className="h-3 w-20 rounded-full" /><Bone className="h-4 w-4/5 rounded-full" /><Bone className="h-3 w-24 rounded-full" /><Bone className="h-4 w-3/5 rounded-full" /><Bone className="mt-4 h-11 w-full rounded-xl" /></div>
      </div>
      <Bone className="mt-10 h-7 w-48 rounded-xl" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <OfferCardSkeleton key={i} />)}</div>
    </SkeletonGroup>
  );
}

/** A product page: photo on one side, title, price, description and buttons on the other. */
export function ProductDetailSkeleton() {
  return (
    <SkeletonGroup className="mx-auto max-w-5xl px-4 pb-28 pt-8">
      <Bone className="h-10 w-10 rounded-full" />
      <div className="card mt-4 grid overflow-hidden lg:grid-cols-2">
        <Bone className="aspect-square w-full rounded-none" />
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <Bone className="h-4 w-1/2 rounded-full" />
          <Bone className="h-9 w-4/5 rounded-xl" />
          <Bone className="h-7 w-24 rounded-xl" />
          <Bone className="h-6 w-28 rounded-full" />
          <div className="space-y-2 pt-2"><Bone className="h-3 w-full rounded-full" /><Bone className="h-3 w-11/12 rounded-full" /><Bone className="h-3 w-3/5 rounded-full" /></div>
          <div className="mt-auto space-y-3 pt-6"><Bone className="h-12 w-full rounded-xl" /><Bone className="h-12 w-full rounded-xl" /></div>
        </div>
      </div>
    </SkeletonGroup>
  );
}

/** Stacked cards for orders, ride requests and receipts. */
export function ListSkeleton({ count = 3, className = "mt-6 grid gap-4 lg:grid-cols-2" }: { count?: number; className?: string }) {
  return (
    <SkeletonGroup>
      <div className={className}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="flex items-center justify-between gap-3"><Bone className="h-5 w-2/5 rounded-full" /><Bone className="h-6 w-20 rounded-full" /></div>
            <Bone className="h-3 w-3/5 rounded-full" />
            <div className="flex items-center gap-3 pt-2"><Bone className="h-12 w-12 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Bone className="h-3 w-4/5 rounded-full" /><Bone className="h-3 w-1/2 rounded-full" /></div></div>
            <div className="flex justify-between border-t border-border pt-3"><Bone className="h-4 w-16 rounded-full" /><Bone className="h-9 w-28 rounded-xl" /></div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/** Merchant dashboard: heading, stat tiles, then the listings grid. */
export function DashboardSkeleton() {
  return (
    <SkeletonGroup className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3"><Bone className="h-4 w-40 rounded-full" /><Bone className="h-9 w-64 rounded-xl" /><Bone className="h-3 w-72 max-w-full rounded-full" /></div>
        <Bone className="h-10 w-32 rounded-xl" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card space-y-3 p-5"><Bone className="h-3 w-20 rounded-full" /><Bone className="h-8 w-16 rounded-xl" /></div>)}</div>
      <div className="mt-6 flex gap-2">{Array.from({ length: 3 }, (_, i) => <Bone key={i} className="h-10 w-28 rounded-full" />)}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <OfferCardSkeleton key={i} />)}</div>
    </SkeletonGroup>
  );
}

/** Generic page body for route changes (app/loading.tsx). */
export function PageSkeleton() {
  return (
    <SkeletonGroup className="mx-auto max-w-6xl px-4 py-8">
      <Bone className="h-10 w-10 rounded-full" />
      <Bone className="mt-5 h-9 w-56 rounded-xl" />
      <Bone className="mt-3 h-4 w-80 max-w-full rounded-full" />
      <div className="mt-6 flex gap-3"><Bone className="h-12 flex-1 rounded-xl sm:max-w-sm" /><Bone className="h-12 w-32 rounded-xl" /></div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <OfferCardSkeleton key={i} />)}</div>
    </SkeletonGroup>
  );
}

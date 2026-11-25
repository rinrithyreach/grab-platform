/** Stand-in for components/Skeleton.tsx in component tests: loading placeholders render nothing. */
const source = ["Bone", "SkeletonGroup", "OfferCardSkeleton", "OfferRailSkeleton", "OfferGridSkeleton", "HeroSkeleton", "StorefrontSkeleton", "ProductDetailSkeleton", "ListSkeleton", "DashboardSkeleton", "PageSkeleton"]
  .map((name) => `export const ${name} = () => null;`).join("\n");
export const skeletonStub = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

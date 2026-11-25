import { PageSkeleton } from "@/components/Skeleton";

/** Shown while a page's code or data loads during navigation: the page's shape, not a spinner. */
export default function Loading() {
  return <PageSkeleton />;
}

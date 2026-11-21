import { BRAND } from "@/lib/brand";

export default function BrandMark({ className = "" }: { className?: string }) {
  return <span className={`brand-mark ${className}`}>{BRAND.name}<span className="brand-dot" /></span>;
}

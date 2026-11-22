"use client";

import { useCategories } from "@/lib/categories";
import { categoryPath } from "@/lib/category-types";
import { useT } from "@/lib/i18n";

export default function CategoryBadge({ categoryId }: { categoryId?: string | null }) {
  const { lang } = useT(); const path = categoryPath(useCategories(), categoryId, lang);
  return path ? <p className="text-xs text-muted">{path}</p> : null;
}

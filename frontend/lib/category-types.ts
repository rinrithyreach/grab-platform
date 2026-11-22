export type CategoryService = "GrabFood" | "GrabExpress";
export interface ProductCategory {
  id: string; service: CategoryService; name: string; khmerName: string | null;
  parentId: string | null; sortOrder: number; productCount?: number; subcategoryCount?: number;
}
export type SaveCategory = Omit<ProductCategory, "id" | "productCount" | "subcategoryCount"> & { reason: string };

export function categoryLabel(category: ProductCategory, lang: string) {
  return lang === "km" && category.khmerName ? category.khmerName : category.name;
}

export function categoryPath(categories: ProductCategory[], id: string | null | undefined, lang: string) {
  const category = categories.find(c => c.id === id);
  if (!category) return "";
  const parent = categories.find(c => c.id === category.parentId);
  return [parent && categoryLabel(parent, lang), categoryLabel(category, lang)].filter(Boolean).join(" / ");
}

"use client";

import { useCategories } from "@/lib/categories";
import { categoryLabel, type CategoryService } from "@/lib/category-types";
import { useT } from "@/lib/i18n";

export default function CategoryPicker({ service, value, onChange, admin = false, disabled = false }: {
  service: CategoryService; value: string | null; onChange: (value: string | null) => void; admin?: boolean; disabled?: boolean;
}) {
  const { pick, lang } = useT();
  const all = useCategories().filter(c => c.service === service);
  const selected = all.find(c => c.id === value);
  const parentId = selected?.parentId ?? selected?.id ?? value ?? "";
  const children = all.filter(c => c.parentId === parentId);
  const selectClass = admin ? undefined : "input";
  return <div className={admin ? "admin-form-columns" : "grid gap-4 sm:grid-cols-2"}>
    <input type="hidden" name="categoryId" value={value ?? ""} />
    <label className={admin ? undefined : "block text-sm font-medium"}>{pick("Category", "ប្រភេទ")}
      <select className={selectClass} value={parentId} disabled={disabled} onChange={e => onChange(e.target.value || null)}>
        <option value="">{pick("Uncategorized", "មិនទាន់មានប្រភេទ")}</option>
        {value && !selected && <option value={value}>{pick("Current category", "ប្រភេទបច្ចុប្បន្ន")}</option>}
        {all.filter(c => !c.parentId).map(c => <option key={c.id} value={c.id}>{categoryLabel(c, lang)}</option>)}
      </select>
    </label>
    <label className={admin ? undefined : "block text-sm font-medium"}>{pick("Subcategory (optional)", "ប្រភេទរង (មិនបាច់បំពេញ)")}
      <select className={selectClass} value={selected?.parentId ? selected.id : ""} disabled={disabled || !parentId || !children.length} onChange={e => onChange(e.target.value || parentId || null)}>
        <option value="">{pick("No subcategory", "គ្មានប្រភេទរង")}</option>{children.map(c => <option key={c.id} value={c.id}>{categoryLabel(c, lang)}</option>)}
      </select>
    </label>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useAdminT } from "@/lib/admin-i18n";
import { setCategories } from "@/lib/categories";
import { type CategoryService, type ProductCategory, type SaveCategory } from "@/lib/category-types";
import AdminIcon from "./AdminIcon";
import { useAdminDialog } from "./useAdminDialog";

const message = (err: unknown) => err instanceof TypeError ? "Cannot connect to the API. Check the backend and try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";
type Editing = { category: ProductCategory | null; parentId: string | null; service: CategoryService };

export default function AdminCategoriesPanel({ canManage, revision, onSaved }: { canManage: boolean; revision: number; onSaved: (text: string) => void }) {
  const { api } = useAuth(); const { a } = useAdminT();
  const [rows, setRows] = useState<ProductCategory[] | null>(null);
  const [service, setService] = useState<CategoryService>("GrabFood");
  const [search, setSearch] = useState(""); const [error, setError] = useState("");
  const [reload, setReload] = useState(0); const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<ProductCategory | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    api.adminCategories(ctrl.signal).then(data => { if (!ctrl.signal.aborted) { setRows(data); setCategories(data); setError(""); } })
      .catch(err => { if (!ctrl.signal.aborted) setError(message(err)); });
    return () => ctrl.abort();
  }, [api, revision, reload]);
  const done = (text: string) => { setEditing(null); setDeleting(null); setReload(n => n + 1); onSaved(a(text)); };
  const current = rows?.filter(c => c.service === service) ?? [];
  const term = search.trim().toLowerCase();
  const matches = (c: ProductCategory) => `${c.name} ${c.khmerName ?? ""}`.toLowerCase().includes(term);
  const visible = current.filter(c => !c.parentId).flatMap(root => {
    const children = current.filter(c => c.parentId === root.id);
    return matches(root) ? [root, ...children] : children.some(matches) ? [root, ...children.filter(matches)] : [];
  });
  return <section className="admin-panel" aria-labelledby="categories-title">
    <div className="admin-panel-heading"><div><h2 id="categories-title">{a("Categories & subcategories")}</h2><p>{a("Organize GrabFood and GrabExpress products. Each service has its own categories and one level of subcategories.")}</p></div>
      {canManage && <button className="admin-button primary" disabled={!rows} onClick={() => setEditing({ category: null, parentId: null, service })}><AdminIcon name="plus" size={17} />{a("Create category")}</button>}</div>
    <div className="admin-category-toolbar"><div className="admin-category-tabs" role="group" aria-label={a("Service")}>{(["GrabFood", "GrabExpress"] as const).map(s => <button type="button" key={s} className={`admin-button ${service === s ? "primary" : ""}`} aria-pressed={service === s} onClick={() => { setService(s); setSearch(""); }}>{s}</button>)}</div>
      <label><span className="sr-only">{a("Search categories")}</span><input type="search" placeholder={a("Search categories")} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <span className="admin-muted">{a("{n} categories · {sub} subcategories", { n: current.filter(c => !c.parentId).length, sub: current.filter(c => c.parentId).length })}</span></div>
    {error && <div className="admin-category-notice admin-error" role="alert">{a(error)} <button className="admin-text-link" onClick={() => setReload(n => n + 1)}>{a("Retry")}</button></div>}
    {!rows ? <div className="admin-loading" role="status"><span className="admin-spinner" />{a("Loading categories…")}</div>
      : !visible.length ? <div className="admin-empty"><AdminIcon name="categories" size={32} /><h3>{a("No categories found")}</h3><p>{a("Create a category for this service or change your search.")}</p></div>
      : <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{["Category", "Type", "Products", "Position", "Actions"].map(h => <th key={h} scope="col">{a(h)}</th>)}</tr></thead><tbody>{visible.map(c => <tr key={c.id}>
        <td><div className={c.parentId ? "admin-subcategory-name" : ""}>{c.parentId && <span aria-hidden>↳ </span>}<strong>{c.name}</strong>{c.khmerName && <small className="admin-category-detail">{c.khmerName}</small>}</div></td>
        <td><span className={`admin-status ${c.parentId ? "neutral" : "success"}`}>{a(c.parentId ? "Subcategory" : "Category")}</span></td><td>{c.productCount ?? 0}</td><td>{c.sortOrder}</td>
        <td><div className="admin-category-actions">{canManage && !c.parentId && <button className="admin-row-button" onClick={() => setEditing({ category: null, parentId: c.id, service })}>{a("Add subcategory")}</button>}
          <button className="admin-row-button" onClick={() => setEditing({ category: c, parentId: c.parentId, service })}>{a(canManage ? "Edit" : "View")}</button>
          {canManage && <button className="admin-row-button danger" onClick={() => setDeleting(c)}>{a("Delete")}</button>}</div></td>
      </tr>)}</tbody></table></div>}
    {editing && <CategoryDialog initial={editing} categories={rows ?? []} canManage={canManage} onClose={() => setEditing(null)} onSaved={done} />}
    {deleting && <DeleteCategory category={deleting} onClose={() => setDeleting(null)} onSaved={done} />}
  </section>;
}

function CategoryDialog({ initial, categories, canManage, onClose, onSaved }: { initial: Editing; categories: ProductCategory[]; canManage: boolean; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useAuth(); const { a } = useAdminT();
  const [service, setService] = useState(initial.service); const [parentId, setParentId] = useState(initial.parentId ?? "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const { ref, close } = useAdminDialog(onClose, busy); const category = initial.category;
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); const text = (key: string) => String(form.get(key) ?? "").trim();
    const body: SaveCategory = { service, name: text("name"), khmerName: text("khmerName") || null, parentId: parentId || null, sortOrder: Number(text("sortOrder")), reason: text("reason") };
    setBusy(true); setError("");
    try { await api.adminSaveCategory(body, category?.id); onSaved("Category saved. Product filters update within a few seconds."); }
    catch (err) { setError(message(err)); setBusy(false); }
  }
  return <dialog ref={ref} className="admin-record-dialog" aria-labelledby="category-dialog-title" onCancel={e => { e.preventDefault(); close(); }}><form className="admin-dialog-form" onSubmit={save}>
    <header><div><span className="admin-eyebrow">{a("Categories & subcategories")}</span><h2 id="category-dialog-title">{a(!canManage ? "Category details" : category ? "Edit category" : parentId ? "Create subcategory" : "Create category")}</h2></div><button type="button" className="admin-icon-button" disabled={busy} onClick={close} aria-label={a("Close")}><AdminIcon name="close" /></button></header>
    <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{a(error)}</div>}<fieldset className="admin-form" disabled={busy || !canManage}>
      <div className="admin-form-columns"><label>{a("Service")}<select value={service} onChange={e => { setService(e.target.value as CategoryService); setParentId(""); }}><option>GrabFood</option><option>GrabExpress</option></select></label>
        <label>{a("Parent category")}<select value={parentId} onChange={e => setParentId(e.target.value)}><option value="">{a("None (top-level category)")}</option>{categories.filter(c => c.service === service && !c.parentId && c.id !== category?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
      <label>{a("Category name")}<input name="name" required minLength={2} maxLength={100} defaultValue={category?.name ?? ""} /></label>
      <label>{a("Khmer name (optional)")}<input name="khmerName" lang="km" maxLength={100} defaultValue={category?.khmerName ?? ""} /></label>
      <label>{a("Position")}<input name="sortOrder" type="number" required min={0} max={999} step={1} defaultValue={category?.sortOrder ?? 0} /><span className="admin-field-help">{a("Lower positions appear first in product filters.")}</span></label>
      {canManage && <label>{a("Reason for change")}<textarea name="reason" required minLength={3} maxLength={300} rows={2} /><span className="admin-field-help">{a("Saved with your name in the activity log.")}</span></label>}
    </fieldset></div><footer><button type="button" className="admin-button" onClick={close} disabled={busy}>{a(canManage ? "Cancel" : "Close")}</button>{canManage && <button className="admin-button primary" disabled={busy}>{a(busy ? "Saving…" : "Save category")}</button>}</footer>
  </form></dialog>;
}

function DeleteCategory({ category, onClose, onSaved }: { category: ProductCategory; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useAuth(); const { a } = useAdminT(); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const { ref, close } = useAdminDialog(onClose, busy);
  const blocked = !!category.productCount || !!category.subcategoryCount;
  async function remove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim(); setBusy(true); setError("");
    try { await api.adminDeleteCategory(category.id, reason); onSaved("Category deleted."); }
    catch (err) { setError(message(err)); setBusy(false); }
  }
  return <dialog ref={ref} className="admin-record-dialog" aria-labelledby="category-delete-title" onCancel={e => { e.preventDefault(); close(); }}><form className="admin-dialog-form" onSubmit={remove}>
    <header><h2 id="category-delete-title">{a("Delete category?")}</h2><button type="button" className="admin-icon-button" disabled={busy} onClick={close} aria-label={a("Close")}><AdminIcon name="close" /></button></header>
    <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{a(error)}</div>}<p className="admin-notice">{category.service} · {category.name}</p>
      {blocked ? <p>{a("Reassign this category's products and move or delete its subcategories before deleting it.")}</p> : <fieldset className="admin-form" disabled={busy}><label>{a("Reason for change")}<textarea name="reason" required minLength={3} maxLength={300} rows={2} /></label></fieldset>}
    </div><footer><button type="button" className="admin-button" onClick={close} disabled={busy}>{a("Close")}</button>{!blocked && <button className="admin-button danger" disabled={busy}>{a(busy ? "Deleting…" : "Delete category")}</button>}</footer>
  </form></dialog>;
}

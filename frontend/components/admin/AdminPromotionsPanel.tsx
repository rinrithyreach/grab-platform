"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useAdminT } from "@/lib/admin-i18n";
import { STORES } from "@/lib/catalog";
import { money } from "@/lib/brand";
import { usePromotions } from "@/lib/promotions";
import { promotionStatus, setPromotionRules, type Promotion, type PromotionKind, type PromotionTarget, type SavePromotion } from "@/lib/promotion-rules";
import AdminIcon from "./AdminIcon";
import { useAdminDialog } from "./useAdminDialog";

const message = (err: unknown) => err instanceof TypeError ? "Cannot connect to the API. Check the backend and try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";
const demoTargets: PromotionTarget[] = STORES.flatMap(s => s.items.map(p => ({ storeId: s.id, storeName: s.name, productId: p.id, productName: p.name })));
const date = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh", dateStyle: "medium", timeStyle: "short" }) : "—";
const localDate = (value: string | null) => value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : "";

export default function AdminPromotionsPanel({ canManage, revision, onSaved }: { canManage: boolean; revision: number; onSaved: (text: string) => void }) {
  const { api } = useAuth();
  const { a } = useAdminT();
  usePromotions();
  const [rows, setRows] = useState<Promotion[] | null>(null);
  const [targets, setTargets] = useState(demoTargets);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Promotion | "create" | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([api.adminPromotions(ctrl.signal), api.adminPromotionTargets(ctrl.signal)])
      .then(([rules, products]) => { if (!ctrl.signal.aborted) { setRows(rules); setTargets([...demoTargets, ...products]); setError(""); setPromotionRules(rules); } })
      .catch(err => { if (!ctrl.signal.aborted) setError(message(err)); });
    return () => ctrl.abort();
  }, [api, revision, reload]);
  const done = (text: string) => { setEditing(null); setDeleting(null); setReload(n => n + 1); onSaved(a(text)); };
  const visible = rows?.filter(p => (!filter || promotionStatus(p) === filter || (filter === "codes" ? !!p.code : filter === "automatic" && !p.code))
    && `${p.name} ${p.code ?? ""} ${targets.find(t => t.storeId === p.storeId)?.storeName ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="admin-panel" aria-labelledby="promotions-title">
    <div className="admin-panel-heading"><div><h2 id="promotions-title">{a("Promotions & coupons")}</h2><p>{a("The best automatic discount applies, plus free delivery and one promo code. Times use Cambodia time (UTC+7).")}</p></div>
      {canManage && <button className="admin-button primary" disabled={!rows} onClick={() => setEditing("create")}><AdminIcon name="plus" size={17} />{a("Create promotion")}</button>}</div>
    <div className="admin-promotion-toolbar"><label><span className="sr-only">{a("Search promotions")}</span><input className="admin-promotion-search" type="search" placeholder={a("Search promotions")} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label><span className="sr-only">{a("Filter promotions")}</span><select value={filter} onChange={e => setFilter(e.target.value)}>{[["", "All promotions"], ["Active", "Active"], ["Paused", "Paused"], ["Scheduled", "Scheduled"], ["Expired", "Expired"], ["codes", "Promo codes"], ["automatic", "Automatic offers"]].map(([v, l]) => <option key={v} value={v}>{a(l)}</option>)}</select></label>
      <span className="admin-muted">{visible?.length ?? 0} / {rows?.length ?? 0}</span></div>
    {error && <div className="admin-promotion-notice admin-error" role="alert">{a(error)} <button className="admin-text-link" onClick={() => setReload(n => n + 1)}>{a("Retry")}</button></div>}
    {!rows ? <div className="admin-loading" role="status"><span className="admin-spinner" />{a("Loading promotions…")}</div>
      : !visible?.length ? <div className="admin-empty"><AdminIcon name="promotions" size={32} /><h3>{a("No promotions found")}</h3><p>{a("Create an offer or change your search and filters.")}</p></div>
      : <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{["Promotion", "Discount", "Applies to", "Schedule", "Status", "Actions"].map(h => <th key={h} scope="col">{a(h)}</th>)}</tr></thead><tbody>{visible.map(p => {
        const status = promotionStatus(p);
        const store = targets.find(t => t.storeId === p.storeId);
        const product = targets.find(t => t.storeId === p.storeId && t.productId === p.productId);
        return <tr key={p.id}><td><strong>{p.name}</strong><small className="admin-promotion-detail">{p.code ? <code>{p.code}</code> : a("Automatic offer")}{p.firstOrderOnly && ` · ${a("First order only")}`}</small></td>
          <td>{p.kind === "percent" ? `${p.value}%` : p.kind === "amount" ? money(p.value) : p.kind === "freeDelivery" ? a("Free delivery") : a("Buy {buy}, get {free} free", { buy: p.buyQuantity, free: p.freeQuantity })}<small className="admin-promotion-detail">{a("Min. spend")} {money(p.minSubtotal)}{p.maxDiscount !== null ? ` · ${a("Cap")} ${money(p.maxDiscount)}` : ""}</small></td>
          <td>{p.storeId ? store?.storeName ?? p.storeId : a("All stores")}<small className="admin-promotion-detail">{p.productId ? product?.productName ?? p.productId : a("All products")}</small></td>
          <td><small>{p.startsAt ? date(p.startsAt) : a("Starts immediately")}<br />{p.endsAt ? date(p.endsAt) : a("No end date")}</small></td>
          <td><span className={`admin-status ${status === "Active" ? "success" : status === "Expired" ? "neutral" : "warning"}`}>{a(status)}</span></td>
          <td><div className="admin-promotion-actions"><button className="admin-row-button" onClick={() => setEditing(p)}>{a(canManage ? "Edit" : "View")}</button>{canManage && <button className="admin-row-button danger" onClick={() => setDeleting(p)}>{a("Delete")}</button>}</div></td></tr>;
      })}</tbody></table></div>}
    {editing && <PromotionDialog promotion={editing === "create" ? null : editing} targets={targets} canManage={canManage} onClose={() => setEditing(null)} onSaved={done} />}
    {deleting && <DeletePromotion promotion={deleting} onClose={() => setDeleting(null)} onSaved={done} />}
  </section>;
}

function PromotionDialog({ promotion: p, targets, canManage, onClose, onSaved }: { promotion: Promotion | null; targets: PromotionTarget[]; canManage: boolean; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useAuth(); const { a } = useAdminT();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [kind, setKind] = useState<PromotionKind>(p?.kind ?? "percent");
  const [mode, setMode] = useState(p?.code ? "code" : "automatic");
  const [storeId, setStoreId] = useState(p?.storeId ?? "");
  const [productId, setProductId] = useState(p?.productId ?? "");
  const { ref, close } = useAdminDialog(onClose, busy);
  const stores = [...new Map(targets.map(t => [t.storeId, t.storeName])).entries()];
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget); const text = (k: string) => String(form.get(k) ?? "").trim();
    const body: SavePromotion = { name: text("name"), code: mode === "code" ? text("code").toUpperCase() : null,
      kind, value: Number(text("value")), minSubtotal: Number(text("minSubtotal")), maxDiscount: text("maxDiscount") ? Number(text("maxDiscount")) : null,
      buyQuantity: Number(text("buyQuantity") || 2), freeQuantity: Number(text("freeQuantity") || 1), storeId: storeId || null, productId: productId || null,
      firstOrderOnly: form.has("firstOrderOnly"), isActive: form.has("isActive"),
      startsAt: text("startsAt") ? new Date(text("startsAt") + ":00+07:00").toISOString() : null,
      endsAt: text("endsAt") ? new Date(text("endsAt") + ":00+07:00").toISOString() : null, reason: text("reason") };
    setBusy(true); setError("");
    try { await api.adminSavePromotion(body, p?.id); onSaved("Promotion saved. Customer offers update within 15 seconds."); }
    catch (err) { setError(message(err)); setBusy(false); }
  }
  return <dialog ref={ref} className="admin-record-dialog" aria-labelledby="promotion-dialog-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={save} className="admin-dialog-form"><header><div><span className="admin-eyebrow">{a("Promotions & coupons")}</span><h2 id="promotion-dialog-title">{a(!p ? "Create promotion" : canManage ? "Edit promotion" : "Promotion details")}</h2></div><button type="button" className="admin-icon-button" disabled={busy} onClick={close} aria-label={a("Close")}><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{a(error)}</div>}<fieldset disabled={busy || !canManage} className="admin-form">
        <label>{a("Promotion name")}<input name="name" required minLength={2} maxLength={100} defaultValue={p?.name ?? ""} placeholder={a("e.g. Weekend savings")} /></label>
        <div className="admin-form-columns"><label>{a("How customers redeem")}<select value={mode} onChange={e => setMode(e.target.value)}><option value="automatic">{a("Automatic offer")}</option><option value="code">{a("Coupon / promo code")}</option></select></label>
          <label>{a("Discount type")}<select value={kind} onChange={e => setKind(e.target.value as PromotionKind)}>{[["percent", "Percentage off"], ["amount", "Fixed amount off"], ["freeDelivery", "Free delivery"], ["buyGetFree", "Buy / get free"]].map(([v, l]) => <option key={v} value={v}>{a(l)}</option>)}</select></label></div>
        {mode === "code" && <label>{a("Promo code")}<input name="code" required minLength={2} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,31}" defaultValue={p?.code ?? ""} placeholder="SAVE20" autoCapitalize="characters" /><span className="admin-field-help">{a("Letters, numbers, underscores and hyphens. Codes ignore letter case.")}</span></label>}
        {(kind === "amount" || kind === "percent") && <label>{a(kind === "percent" ? "Discount (%)" : "Discount (USD)")}<input key={kind} name="value" type="number" required min={0.01} max={kind === "percent" ? 100 : 100000} step="0.01" defaultValue={p?.value || 10} /></label>}
        {kind === "buyGetFree" && <div className="admin-form-columns"><label>{a("Buy quantity")}<input name="buyQuantity" type="number" required min={1} max={50} defaultValue={p?.buyQuantity ?? 2} /></label><label>{a("Free quantity")}<input name="freeQuantity" type="number" required min={1} max={50} defaultValue={p?.freeQuantity ?? 1} /></label></div>}
        <div className="admin-form-columns"><label>{a("Minimum spend (USD)")}<input name="minSubtotal" type="number" required min={0} max={100000} step="0.01" defaultValue={p?.minSubtotal ?? 0} /></label><label>{a("Maximum discount (USD, optional)")}<input name="maxDiscount" type="number" min={0.01} max={100000} step="0.01" defaultValue={p?.maxDiscount ?? ""} /></label></div>
        <div className="admin-form-columns"><label>{a("Store")}<select value={storeId} onChange={e => { setStoreId(e.target.value); setProductId(""); }}><option value="">{a("All stores")}</option>{p?.storeId && !stores.some(([id]) => id === p.storeId) && <option value={p.storeId}>{p.storeId}</option>}{stores.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label>{a("Product")}<select value={productId} onChange={e => setProductId(e.target.value)} disabled={!storeId}><option value="">{a("All products")}</option>{p?.productId && !targets.some(t => t.storeId === storeId && t.productId === p.productId) && <option value={p.productId}>{p.productId}</option>}{targets.filter(t => t.storeId === storeId).map(t => <option key={t.productId} value={t.productId}>{t.productName}</option>)}</select></label></div>
        <div className="admin-form-columns"><label>{a("Starts at (optional)")}<input name="startsAt" type="datetime-local" defaultValue={localDate(p?.startsAt ?? null)} /></label><label>{a("Ends at (optional)")}<input name="endsAt" type="datetime-local" defaultValue={localDate(p?.endsAt ?? null)} /></label></div>
        <p className="admin-field-help">{a("Times use Cambodia time (UTC+7). Leave dates empty for no time limit.")}</p>
        <label className="admin-checkbox"><input name="firstOrderOnly" type="checkbox" defaultChecked={p?.firstOrderOnly ?? false} />{a("First order only")}</label>
        <label className="admin-checkbox"><input name="isActive" type="checkbox" defaultChecked={p?.isActive ?? true} />{a("Enable promotion")}</label>
        {canManage && <label>{a("Reason for change")}<textarea name="reason" required minLength={3} maxLength={300} rows={2} /><span className="admin-field-help">{a("Saved with your name in the activity log.")}</span></label>}
      </fieldset></div><footer><button type="button" className="admin-button" onClick={close} disabled={busy}>{a(canManage ? "Cancel" : "Close")}</button>{canManage && <button className="admin-button primary" disabled={busy}>{a(busy ? "Saving…" : "Save promotion")}</button>}</footer>
    </form></dialog>;
}

function DeletePromotion({ promotion, onClose, onSaved }: { promotion: Promotion; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useAuth(); const { a } = useAdminT();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const { ref, close } = useAdminDialog(onClose, busy);
  async function remove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    setBusy(true); setError("");
    try { await api.adminDeletePromotion(promotion.id, reason); onSaved("Promotion deleted. Existing order totals are preserved."); }
    catch (err) { setError(message(err)); setBusy(false); }
  }
  return <dialog ref={ref} className="admin-record-dialog" aria-labelledby="promotion-delete-title" onCancel={e => { e.preventDefault(); close(); }}><form className="admin-dialog-form" onSubmit={remove}>
    <header><h2 id="promotion-delete-title">{a("Delete promotion?")}</h2><button type="button" className="admin-icon-button" disabled={busy} onClick={close} aria-label={a("Close")}><AdminIcon name="close" /></button></header>
    <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{a(error)}</div>}<p className="admin-notice">{promotion.name}{promotion.code ? ` · ${promotion.code}` : ""}</p><p>{a("This removes the offer from future purchases. You can pause it by editing it instead.")}</p><fieldset className="admin-form" disabled={busy}><label>{a("Reason for change")}<textarea name="reason" required minLength={3} maxLength={300} rows={2} /></label></fieldset></div>
    <footer><button type="button" className="admin-button" onClick={close} disabled={busy}>{a("Cancel")}</button><button className="admin-button danger" disabled={busy}>{a(busy ? "Deleting…" : "Delete promotion")}</button></footer>
  </form></dialog>;
}

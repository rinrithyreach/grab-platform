"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { ADMIN_CONFIG, ADMIN_SECTIONS, adminActions, adminCsv, adminValue, type AdminOverview, type AdminPage, type AdminRecord, type AdminResource, type AdminSection } from "@/lib/admin";
import AdminIcon from "./AdminIcon";
import AdminSettingsPanel from "./AdminSettingsPanel";
import AdminProfilePanel from "./AdminProfilePanel";
import AdminTeamPanel from "./AdminTeamPanel";
import AdminRolesPanel from "./AdminRolesPanel";
import AdminCreateUserDialog from "./AdminCreateUserDialog";
import { adminCan, normalizeAdminProfile, type AdminProfile } from "@/lib/admin-settings";

const labels: Record<AdminSection, string> = { overview: "Overview", users: "Users & access", merchants: "Merchants", listings: "Listings & banners", rides: "Rides", orders: "Orders", deliveries: "Deliveries", drivers: "Drivers", payments: "Payments", reviews: "Reviews", audit: "Activity log", settings: "Settings", team: "Administrators", roles: "Roles & permissions", profile: "My profile" };
const navGroups: { label: string; items: AdminSection[] }[] = [
  { label: "WORKSPACE", items: ["overview"] },
  { label: "PLATFORM", items: ["users", "merchants", "listings"] },
  { label: "OPERATIONS", items: ["rides", "orders", "deliveries", "drivers"] },
  { label: "GOVERNANCE", items: ["payments", "reviews", "audit"] },
  { label: "ADMINISTRATION", items: ["settings", "team", "roles", "profile"] },
];
/** Heading copy for the sections that are not record tables. */
const pageCopy: Partial<Record<AdminSection, { title: string; description: string }>> = {
  overview: { title: "Dashboard overview", description: "A clear view of your people, partners and daily operations." },
  settings: { title: "Platform settings", description: "Configure your services, customer communications and platform availability." },
  team: { title: "Administrators", description: "Every administrator profile, their role, recent activity and access controls." },
  roles: { title: "Roles & permissions", description: "Create roles from permissions and decide what each administrator can see and change." },
  profile: { title: "My admin profile", description: "Your identity, account security, preferences and recent activity." },
};
const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" }) : "—";
const human = (value: unknown) => String(value ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, s => s.toUpperCase());
const text = (row: AdminRecord, key: string) => String(row[key] ?? "");
const message = (err: unknown) => err instanceof TypeError ? "Cannot connect to the API. Check the backend and try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";
function Badge({ children }: { children: unknown }) {
  const value = String(children ?? "");
  const tone = ["Active", "Published", "Available", "Visible", "Completed", "Delivered", "SimulatedSucceeded"].includes(value) ? "success"
    : ["Suspended", "Hidden", "Cancelled", "Rejected", "Failed"].includes(value) ? "danger"
      : ["Pending", "Scheduled", "Draft", "Unavailable"].includes(value) ? "warning" : "neutral";
  return <span className={`admin-status ${tone}`}>{value === "Admin" ? "Administrator" : human(value) || "—"}</span>;
}
function Loading() { return <div className="admin-loading" role="status"><span className="admin-spinner" />Loading workspace data…</div>; }
function Empty({ title = "Nothing here yet", description }: { title?: string; description: string }) {
  return <div className="admin-empty"><span className="admin-empty-icon"><AdminIcon name="listings" size={28} /></span><h3>{title}</h3><p>{description}</p></div>;
}

export default function AdminDashboard() {
  const { api, user, ready, logout } = useAuth();
  const params = useSearchParams();
  const requested = params.get("section") ?? "overview";
  const section: AdminSection = ADMIN_SECTIONS.includes(requested as AdminSection) ? requested as AdminSection : "overview";
  const [menu, setMenu] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const currentProfile = profile?.id === user?.id ? profile : null;
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = menuDialog.current;
    if (menu && dialog && !dialog.open) dialog.showModal();
    if (!menu && dialog?.open) dialog.close();
  }, [menu]);
  useEffect(() => {
    if (!ready || user?.role !== "Admin") return;
    const ctrl = new AbortController();
    api.adminProfile(ctrl.signal).then(data => { if (!ctrl.signal.aborted) { setProfile(normalizeAdminProfile(data)); setProfileError(""); } }).catch(err => { if (!ctrl.signal.aborted) setProfileError(message(err)); });
    return () => ctrl.abort();
  }, [api, ready, user?.id, user?.role, revision]);
  if (!ready) return <Loading />;
  if (!user || user.role !== "Admin") return <div className="admin-access"><AdminIcon name="shield" size={44} /><h1>Administrator access</h1><p>{user ? "This account does not have administrator access." : "Sign in with your administrator account to manage the platform."}</p>{user ? <button className="admin-button primary" onClick={logout}>Sign out and switch account</button> : <Link className="admin-button primary" href="/admin/login">Administrator sign in</Link>}<Link href="/">Back to {BRAND.name}</Link></div>;
  // My profile is always available; every other section needs its "view" permission.
  const allowed = (item: AdminSection) => item === "profile" || adminCan(currentProfile, item, "view");
  const groups = navGroups.map(g => ({ ...g, items: g.items.filter(allowed) })).filter(g => g.items.length > 0);
  const nav = (close?: () => void) => <>
    <div className="admin-brand"><span className="admin-logo">{BRAND.name[0]}</span><div><strong>{BRAND.name}</strong><small>Admin console</small></div></div>
    <nav aria-label="Admin navigation">
      {groups.map(g => <div key={g.label}><p className="admin-nav-label">{g.label}</p>{g.items.map(item => <Link key={item} href={item === "overview" ? "/admin" : `/admin?section=${item}`} className={`admin-nav-item ${section === item ? "selected" : ""}`} aria-current={section === item ? "page" : undefined} onClick={() => { close?.(); setNotice(""); }}><AdminIcon name={item} /><span>{labels[item]}</span></Link>)}</div>)}
    </nav>
    <div className="admin-sidebar-bottom"><div className="admin-permission"><AdminIcon name={currentProfile && !currentProfile.isSuperAdmin ? "roles" : "shield"} /><div><strong>{currentProfile?.roleName ?? "Administrator"}</strong><small>{!currentProfile ? "Loading access…" : currentProfile.isSuperAdmin ? "Full platform access" : `${currentProfile.permissions.length} permissions`}</small></div></div><Link href="/" className="admin-nav-item"><AdminIcon name="external" />View customer app</Link></div>
  </>;
  const firstAllowed = groups[0]?.items[0] ?? "profile";
  const onSaved = () => { setNotice("Changes saved. The activity log has been updated."); setRevision(v => v + 1); };
  const content = !currentProfile ? profileError ? <div className="admin-error" role="alert">{profileError}<button className="admin-button" onClick={() => setRevision(v => v + 1)}>Retry</button></div> : <Loading />
    : !allowed(section) ? <div className="admin-panel admin-empty"><span className="admin-empty-icon"><AdminIcon name="shield" size={28} /></span><h3>Your role doesn’t include this section</h3><p>{currentProfile.roleName} cannot view {labels[section]}. Ask a super administrator if you need access.</p><Link className="admin-button" href={firstAllowed === "overview" ? "/admin" : `/admin?section=${firstAllowed}`}>Go to {labels[firstAllowed]}</Link></div>
    : section === "overview" ? <Overview revision={revision} refreshSeconds={currentProfile.refreshSeconds} />
    : section === "settings" ? <AdminSettingsPanel key={user.id} revision={revision} canManage={adminCan(currentProfile, "settings", "manage")} onSaved={setNotice} />
    : section === "team" ? <AdminTeamPanel key={user.id} me={currentProfile} revision={revision} onSaved={setNotice} />
    : section === "roles" ? <AdminRolesPanel key={user.id} me={currentProfile} revision={revision} onSaved={setNotice} />
    : section === "profile" ? <AdminProfilePanel key={user.id} profile={currentProfile} onChanged={(data, savedMessage) => { setProfile(normalizeAdminProfile(data)); setNotice(savedMessage); }} />
    : <Resource key={`${section}:${user.id}`} section={section} me={currentProfile} revision={revision} onSaved={onSaved} onNotice={message => { setNotice(message); setRevision(v => v + 1); }} />;
  return <div className={`admin-shell ${currentProfile?.compactTables ? "admin-compact" : ""}`}>
    <aside className="admin-sidebar">{nav()}</aside>
    <dialog ref={menuDialog} className="admin-mobile-menu" onCancel={() => setMenu(false)} onClose={() => { setMenu(false); menuRef.current?.focus(); }}><button className="admin-icon-button admin-menu-close" aria-label="Close navigation" onClick={() => setMenu(false)}><AdminIcon name="close" /></button>{nav(() => setMenu(false))}</dialog>
    <div className="admin-workspace">
      <header className="admin-topbar"><div className="admin-breadcrumb"><button ref={menuRef} className="admin-icon-button admin-menu-toggle" onClick={() => setMenu(true)} aria-label="Open navigation"><AdminIcon name="menu" /></button><span>Workspace</span><span className="admin-slash">/</span><strong>{labels[section]}</strong></div><div className="admin-topbar-account"><Link href="/admin?section=profile" className="admin-profile-shortcut" aria-label="Open my admin profile"><span className="admin-avatar">{currentProfile?.avatarUrl ? <img src={currentProfile.avatarUrl} alt="" /> : user.fullName.slice(0, 1)}</span><span><strong>{user.fullName}</strong><small>{currentProfile?.jobTitle || currentProfile?.roleName || "Administrator"}</small></span></Link>{adminCan(currentProfile, "settings") && <Link className="admin-icon-button" href="/admin?section=settings" title="Settings" aria-label="Open admin settings"><AdminIcon name="settings" /></Link>}<button className="admin-icon-button" onClick={logout} title="Sign out" aria-label="Sign out"><AdminIcon name="logout" /></button></div></header>
      <div className="admin-content">
        <div className="admin-page-heading"><div><span className="admin-eyebrow">{section === "overview" ? "YOUR PLATFORM AT A GLANCE" : "PLATFORM MANAGEMENT"}</span><h1>{(pageCopy[section] ?? ADMIN_CONFIG[section as AdminResource]).title}</h1><p>{(pageCopy[section] ?? ADMIN_CONFIG[section as AdminResource]).description}</p></div>{section !== "settings" && section !== "profile" && <button className="admin-button" onClick={() => setRevision(v => v + 1)}><AdminIcon name="refresh" size={17} />Refresh</button>}</div>
        {notice && <div className="admin-success" role="status">{notice}<button className="admin-icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}><AdminIcon name="close" size={16} /></button></div>}
        {content}
        <footer className="admin-footnote"><span>{BRAND.name} administration</span><span>USD · Cambodia time (UTC+7)</span></footer>
      </div>
    </div>
  </div>;
}

function Overview({ revision, refreshSeconds }: { revision: number; refreshSeconds: number }) {
  const { api } = useAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const ctrl = new AbortController(); let busy = false;
    const refresh = async () => {
      if (busy) return; busy = true;
      try { const result = await api.adminOverview(ctrl.signal); if (!ctrl.signal.aborted) { setData(result); setError(""); } }
      catch (err) { if (!ctrl.signal.aborted) setError(message(err)); }
      finally { busy = false; if (!ctrl.signal.aborted) setLoading(false); }
    };
    void refresh(); const timer = refreshSeconds > 0 ? setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, refreshSeconds * 1000) : null;
    return () => { ctrl.abort(); if (timer) clearInterval(timer); };
  }, [api, revision, refreshSeconds]);
  if (loading) return <Loading />;
  if (!data) return <div className="admin-error" role="alert">{error || "Unable to load the dashboard."} Use Refresh to try again.</div>;
  const activityTotal = data.activity.reduce((sum, d) => sum + d.rides + d.orders + d.deliveries, 0);
  const chartMax = Math.max(1, ...data.activity.map(d => d.rides + d.orders + d.deliveries));
  const stats = [
    { label: "Total users", value: data.users, note: `${number.format(data.activeUsers)} active accounts`, icon: "users", href: "users" },
    { label: "Merchant partners", value: data.merchants, note: "Across rides, food & express", icon: "merchants", href: "merchants" },
    { label: "Active bookings", value: data.activeRides + data.activeOrders + data.activeDeliveries, note: "Rides, orders & parcel deliveries", icon: "orders", href: "orders" },
    { label: "Published listings", value: data.publishedListings, note: "Products available on the platform", icon: "listings", href: "listings" },
  ];
  return <>
    {error && <div className="admin-error" role="alert">{error} Showing data from {date(data.updatedAt)}.</div>}
    <div className="admin-stats">{stats.map(s => <Link href={`/admin?section=${s.href}`} className="admin-stat" key={s.label}><div className="admin-stat-top"><span>{s.label}</span><span className={`admin-stat-icon ${s.icon}`}><AdminIcon name={s.icon} /></span></div><strong>{number.format(s.value)}</strong><p>{s.note}</p></Link>)}</div>
    <div className="admin-overview-grid">
      <section className="admin-panel admin-activity"><div className="admin-panel-heading"><div><h2>Platform activity</h2><p>New bookings in the last 7 days</p></div><span className="admin-chip">Last 7 days</span></div><div className="admin-chart-total"><strong>{number.format(activityTotal)}</strong><span>total bookings</span></div>
        <div className="admin-chart" role="img" aria-label={`Bookings during the last seven days. ${data.activity.map(d => `${d.date}: ${d.rides} rides, ${d.orders} orders, ${d.deliveries} deliveries`).join(". ")}`}>
          {data.activity.map(d => <div className="admin-chart-column" key={d.date}><span className="admin-chart-number">{d.rides + d.orders + d.deliveries}</span><div className="admin-chart-track"><div className="admin-chart-stack" style={{ height: `${(d.rides + d.orders + d.deliveries) / chartMax * 100}%` }}><span className="deliveries" style={{ flexGrow: d.deliveries }} /><span className="orders" style={{ flexGrow: d.orders }} /><span className="rides" style={{ flexGrow: d.rides }} /></div></div><span className="admin-chart-day">{new Date(d.date + "T12:00:00+07:00").toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Phnom_Penh" })}</span></div>)}
        </div><div className="admin-legend"><span><i className="rides" />Rides</span><span><i className="orders" />Orders</span><span><i className="deliveries" />Deliveries</span></div>
      </section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Operations queue</h2><p>Bookings waiting for a response</p></div><AdminIcon name="orders" /></div><div className="admin-queue">{[{ name: "Ride requests", icon: "rides", count: data.pendingRides, active: data.activeRides, filter: "Pending" }, { name: "Store orders", icon: "orders", count: data.pendingOrders, active: data.activeOrders, filter: "Pending" }, { name: "Parcel deliveries", icon: "deliveries", count: data.pendingDeliveries, active: data.activeDeliveries, filter: "" }].map(item => <Link href={`/admin?section=${item.icon}&filter=${item.filter}`} key={item.name}><span className="admin-queue-icon"><AdminIcon name={item.icon} /></span><div><strong>{item.name}</strong><small>{item.active} active in total</small></div><span className={`admin-queue-count ${item.count > 0 ? "pending" : ""}`}>{item.count}</span></Link>)}</div><div className="admin-queue-note"><AdminIcon name="shield" size={18} /><p>All changes are protected by administrator permissions and recorded in your activity log.</p></div></section>
    </div>
    <div className="admin-overview-bottom"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Recent admin activity</h2><p>The latest changes to your platform</p></div><Link href="/admin?section=audit" className="admin-text-link">View all</Link></div>{data.recentAudit.length ? <div className="admin-audit-list">{data.recentAudit.map(row => <div key={row.id}><span className="admin-audit-icon"><AdminIcon name={text(row, "resource")} size={18} /></span><div><strong>{text(row, "action")}</strong><p>{text(row, "actorName")} · {text(row, "reason")}</p></div><time>{date(row.createdAt)}</time></div>)}</div> : <Empty title="A fresh start" description="Your team's admin changes will appear here as you manage the platform." />}</section>
      <section className="admin-panel admin-financial"><div className="admin-panel-heading"><div><h2>Transaction overview</h2><p>All-time totals · Demo payments</p></div><AdminIcon name="payments" /></div><div><span>Simulated ride payments</span><strong>{money.format(data.simulatedPayments)}</strong></div><div><span>Delivered order value</span><strong>{money.format(data.completedOrderValue)}</strong></div><p className="admin-muted">These totals describe demo activity. No real payments are processed.</p><Link href="/admin?section=payments" className="admin-text-link">View transactions</Link></section></div>
    <p className="admin-updated">Updated {date(data.updatedAt)} · {refreshSeconds ? `Refreshes every ${refreshSeconds} seconds` : "Manual refresh"}</p>
  </>;
}

function Resource({ section, me, revision, onSaved, onNotice }: { section: AdminResource; me: AdminProfile; revision: number; onSaved: () => void; onNotice: (message: string) => void }) {
  const { api } = useAuth();
  const canManage = adminCan(me, section, "manage");
  const [creatingUser, setCreatingUser] = useState(false);
  const params = useSearchParams();
  const config = ADMIN_CONFIG[section];
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(config.filters.includes(params.get("filter") ?? "") ? params.get("filter")! : "");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminRecord | "create" | null>(null);
  // Loading state is derived: the stored result belongs to one request key, and any other key is still loading.
  // This avoids setting state synchronously inside the effect.
  const requestKey = `${section}|${page}|${search}|${filter}|${revision}`;
  const [result, setResult] = useState<{ key: string; data: AdminPage | null; error: string }>({ key: "", data: null, error: "" });
  const busy = result.key !== requestKey;
  const error = busy ? "" : result.error;
  const data = result.data;
  useEffect(() => { const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    const ctrl = new AbortController();
    api.adminList(section, page, search, filter, ctrl.signal)
      .then(rows => { if (!ctrl.signal.aborted) setResult({ key: requestKey, data: rows, error: "" }); })
      .catch(err => { if (!ctrl.signal.aborted) setResult(prev => ({ key: requestKey, data: prev.data, error: message(err) })); });
    return () => ctrl.abort();
  }, [api, section, page, search, filter, requestKey]);
  function exportPage() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF", adminCsv(section, data.items)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `grab-${section}-page-${page}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="admin-panel admin-resource">
    <div className="admin-resource-toolbar"><div className="admin-search"><AdminIcon name="search" size={18} /><input aria-label={`Search ${labels[section]}`} placeholder={section === "payments" ? "Search transaction or ride ID…" : "Search records…"} value={query} onChange={e => setQuery(e.target.value)} maxLength={120} /></div><div className="admin-toolbar-actions">{config.filters.length > 0 && <select aria-label="Filter records" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">All {section === "users" ? "accounts" : "records"}</option>{config.filters.map(f => <option key={f} value={f}>{human(f)}</option>)}</select>}<button className="admin-button" onClick={exportPage} disabled={busy || !!error || !data?.items.length}><AdminIcon name="export" size={17} />Export page</button>{section === "drivers" && canManage && <button className="admin-button primary" onClick={() => setSelected("create")}><AdminIcon name="plus" size={17} />Add driver</button>}{section === "users" && canManage && <button className="admin-button primary" onClick={() => setCreatingUser(true)}><AdminIcon name="plus" size={17} />Create user</button>}</div></div>
    {error ? <div className="admin-error" role="alert">{error} Use Refresh to try again.</div> : busy ? <Loading /> : !data?.items.length ? <Empty title={search || filter ? "No matching records" : "No records yet"} description={search || filter ? "Try a different search or choose another filter." : `New ${section === "audit" ? "admin changes" : section} will appear here when added to the platform.`} /> : <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{config.columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}>{config.columns.map(c => { const value = adminValue(row, c.key); return <td key={c.key}>{c.format === "status" ? <Badge>{value}</Badge> : c.format === "money" ? <span className="admin-money">{money.format(Number(value))}</span> : c.format === "date" ? <span className="admin-table-date">{date(value)}</span> : c.format === "id" ? <span className="admin-record-id" title={String(value)}>#{String(value).slice(0, 8).toUpperCase()}</span> : <span className="admin-cell-text" title={String(value ?? "")}>{String(value ?? "—") || "—"}</span>}</td>; })}<td><button className="admin-row-button" onClick={() => setSelected(row)} aria-label={`Manage ${text(row, "fullName") || text(row, "title") || text(row, "businessName") || row.id}`}>{["payments", "audit"].includes(section) || !canManage ? "View" : "Manage"}</button></td></tr>)}</tbody></table></div>}
    {data && !busy && !error && <div className="admin-pagination"><span>{data.total === 0 ? "0 records" : `${number.format((page - 1) * data.pageSize + 1)}–${number.format(Math.min(page * data.pageSize, data.total))} of ${number.format(data.total)} records`}</span><div><button className="admin-button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><button className="admin-button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)}>Next</button></div></div>}
    {selected && <RecordDialog section={section} row={selected} canManage={canManage} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onSaved(); }} />}
    {creatingUser && <AdminCreateUserDialog me={me} onClose={() => setCreatingUser(false)} onSaved={message => { setCreatingUser(false); onNotice(message); }} />}
  </section>;
}

function RecordDialog({ section, row, canManage, onClose, onSaved }: { section: AdminResource; row: AdminRecord | "create"; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const { api, user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = row === "create";
  const record: AdminRecord = create ? { id: "" } : row;
  const actions = create || !canManage ? [] : adminActions(section, record);
  const editable = canManage && ["users", "merchants", "listings"].includes(section);
  const canSave = create || editable || actions.length > 0;
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    const reason = get("reason");
    if (reason.length < 3) { setError("Enter a reason of at least 3 characters."); return; }
    setBusy(true); setError("");
    try {
      if (create) await api.adminCreateDriver({ userId: get("userId"), vehicleType: get("vehicleType"), vehiclePlate: get("vehiclePlate"), reason });
      else if (section === "users") await api.adminUpdate("users", record.id, { fullName: get("fullName"), role: get("role") || record.role, isActive: record.id === user?.id ? true : form.has("isActive"), reason });
      else if (section === "listings") await api.adminUpdate("listings", record.id, { title: get("title"), description: get("description"), price: Number(get("price")), isPublished: form.has("isPublished"), showInSlideshow: form.has("showInSlideshow"), reason });
      else if (section === "merchants") {
        const ride = record.service === "GrabRide";
        await api.adminUpdate("merchants", record.id, { reason, profile: { service: record.service, businessName: ride ? get("ownerName") : get("businessName"), ownerName: get("ownerName"), contactPhone: get("contactPhone"), email: get("email") || null, address: get("address"), city: ride ? "" : get("city"), category: ride ? get("vehicleType") : get("category"), description: ride ? "" : get("description"), openingHours: get("openingHours"), motorcycleLicensePlate: ride ? get("motorcycleLicensePlate") : null, vehicleType: ride ? get("vehicleType") : null } });
      } else await api.adminAction(section, record.id, get("action"), reason);
      onSaved();
    } catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }
  const input = (key: string, label: string, max = 120, required = true, type = "text", min = 2) => <label>{label}<input name={key} type={type} defaultValue={text(record, key)} required={required} maxLength={max} minLength={required ? min : undefined} /></label>;
  const textarea = (key: string, label: string, max = 1500, required = false) => <label>{label}<textarea name={key} defaultValue={text(record, key)} maxLength={max} required={required} rows={3} /></label>;
  return <dialog ref={dialog} className="admin-record-dialog" aria-labelledby="record-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={save} className="admin-dialog-form"><header><div><span className="admin-eyebrow">{labels[section]}</span><h2 id="record-title">{create ? "Add a driver" : editable ? "Manage record" : "Record details"}</h2>{!create && <p className="admin-record-full-id">{record.id}</p>}</div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close record"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{error}</div>}<fieldset disabled={busy} className="admin-form">
        {create ? <><p className="admin-notice">Use a dedicated customer account with no booking history. Copy its full ID from Users & access. The account becomes a driver and must sign in again.</p>{input("userId", "Customer account ID", 36, true, "text", 36)}<div className="admin-form-columns">{input("vehicleType", "Vehicle type", 50)}{input("vehiclePlate", "License plate", 30)}</div></> : section === "users" ? <>
          <p className="admin-notice">{text(record, "email") || text(record, "phoneNumber")}</p>{input("fullName", "Full name")}
          <label>Account role<select name="role" defaultValue={text(record, "role")} disabled={record.id === user?.id || ["Driver", "Merchant"].includes(text(record, "role"))}>{["Driver", "Merchant"].includes(text(record, "role")) ? <option value={text(record, "role")}>{text(record, "role")}</option> : <><option value="Customer">Customer</option><option value="Admin">Super administrator</option></>}</select></label>
          <p className="admin-field-help">Super administrators can access all platform records and controls. Role changes end the affected account’s current session.</p><label className="admin-checkbox"><input name="isActive" type="checkbox" defaultChecked={Boolean(record.isActive)} disabled={record.id === user?.id} />Account active</label><p className="admin-field-help">Suspension blocks sign-in and hides a merchant’s public offers. Your own admin account stays active.</p>
        </> : section === "listings" ? <>{input("title", "Listing title")}{textarea("description", "Description")}<label>Price (USD)<input name="price" type="number" min="0.01" max="999999.99" step="0.01" defaultValue={Number(record.price)} required /></label><label className="admin-checkbox"><input name="isPublished" type="checkbox" defaultChecked={Boolean(record.isPublished)} />Published on the customer app</label><label className="admin-checkbox"><input name="showInSlideshow" type="checkbox" defaultChecked={Boolean(record.showInSlideshow)} />Feature in homepage slideshow</label><p className="admin-field-help">Only published listings appear in the slideshow. Existing orders keep their original prices.</p></> : section === "merchants" ? <>
          <div className="admin-notice"><Badge>{record.service}</Badge><p>Account ID: {text(record, "userId")}</p></div>
          {record.service !== "GrabRide" && input("businessName", "Business name")}{input("ownerName", "Owner / partner name")}<div className="admin-form-columns">{input("contactPhone", "Contact phone", 30, true, "tel")}{record.service !== "GrabRide" && input("email", "Business email", 254, false, "email")}</div>{input("address", "Address", 300)}
          {record.service === "GrabRide" ? <div className="admin-form-columns"><label>Vehicle type<select name="vehicleType" defaultValue={text(record, "category")}><option>Motorcycle</option><option>Rickshaw</option><option>Classic</option></select></label>{input("motorcycleLicensePlate", "License plate", 30)}</div> : <><div className="admin-form-columns">{input("city", "City", 100)}{input("category", "Category", 100)}</div>{textarea("description", "Business description", 1500, true)}</>}
          {input("openingHours", "Opening / work schedule", 200, false)}<p className="admin-field-help">Weekly format: Mon 08:00-17:00; Tue 08:00-17:00. Leave empty for no scheduled opening days.</p>
        </> : <RecordDetails record={record} />}
        {actions.length > 0 && <label>Action<select name="action" defaultValue={actions[0].value}>{actions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></label>}
        {canSave && <label>Reason for change<textarea name="reason" placeholder="Explain why this change is needed…" required minLength={3} maxLength={300} rows={3} /><span className="admin-field-help">Saved with your name in the activity log.</span></label>}
      </fieldset></div><footer><button className="admin-button" type="button" disabled={busy} onClick={close}>{canSave ? "Cancel" : "Close"}</button>{canSave && <button className="admin-button primary" disabled={busy}>{busy ? "Saving…" : create ? "Create driver profile" : "Save changes"}</button>}</footer>
    </form>
  </dialog>;
}

function RecordDetails({ record }: { record: AdminRecord }) {
  return <dl className="admin-details">{Object.entries(record).filter(([key]) => key !== "id").map(([key, value]) => <div key={key}><dt>{human(key)}</dt><dd>{Array.isArray(value) ? <div className="admin-nested-records">{value.map((item, i) => <dl key={i}>{Object.entries(item as Record<string, unknown>).map(([k, v]) => <div key={k}><dt>{human(k)}</dt><dd>{typeof v === "boolean" ? v ? "Yes" : "No" : String(v ?? "—")}</dd></div>)}</dl>)}</div> : value === null ? "—" : typeof value === "boolean" ? value ? "Yes" : "No" : key.endsWith("At") ? date(value) : key === "status" ? <Badge>{value}</Badge> : String(value)}</dd></div>)}</dl>;
}

/** The admin area keeps its own loading look (see admin.css) instead of the customer page skeleton. */
export default function AdminLoading() {
  return <div className="admin-loading" role="status">Loading admin workspace…</div>;
}

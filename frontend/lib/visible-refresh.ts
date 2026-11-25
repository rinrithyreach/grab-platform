/** Refresh a mounted view on a timer, and catch up when the user returns or reconnects. */
export function refreshWhileVisible(read: (signal: AbortSignal) => Promise<void>, intervalMs = 5000) {
  const controller = new AbortController();
  let busy = false;
  async function refresh() {
    if (busy || controller.signal.aborted) return;
    busy = true;
    try { await read(controller.signal); }
    finally { busy = false; }
  }
  const visible = () => { if (document.visibilityState !== "hidden") void refresh(); };
  void refresh();
  const timer = setInterval(visible, intervalMs);
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("focus", visible);
  window.addEventListener("online", visible);
  return () => {
    controller.abort();
    clearInterval(timer);
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("focus", visible);
    window.removeEventListener("online", visible);
  };
}

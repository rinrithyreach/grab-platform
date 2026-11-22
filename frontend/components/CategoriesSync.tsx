"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { setCategories } from "@/lib/categories";

export default function CategoriesSync() {
  const { api } = useAuth();
  useEffect(() => {
    const ctrl = new AbortController(); let busy = false;
    const refresh = async () => {
      if (busy) return; busy = true;
      try { const rows = await api.categories(undefined, ctrl.signal); if (!ctrl.signal.aborted) setCategories(rows); }
      catch { /* Keep the last list while the API reconnects. */ }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [api]);
  return null;
}

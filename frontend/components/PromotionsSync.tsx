"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { getPromotionRules, setPromotionRules } from "@/lib/promotion-rules";

export default function PromotionsSync() {
  const { api } = useAuth();
  useEffect(() => {
    const ctrl = new AbortController(); let busy = false;
    const refresh = async () => {
      if (busy) return; busy = true;
      try { const rows = await api.promotions(ctrl.signal); if (!ctrl.signal.aborted) setPromotionRules(rows); }
      catch { if (!ctrl.signal.aborted) setPromotionRules([...getPromotionRules()]); }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 15000);
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [api]);
  return null;
}

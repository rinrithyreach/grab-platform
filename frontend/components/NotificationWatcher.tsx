"use client";

/**
 * Runs in the background on every page and turns changes into notifications + toasts:
 *  - customers: their orders and rides changing status (accepted, on the way, delivered…)
 *  - merchants: new orders, orders the customer cancelled, and new ride requests
 *  - guests and customers: newly published products, and saved (wishlist) products that drop
 *    in price, sell out or come back in stock (lib/wishlist.ts)
 *  - everyone: logging out, an expired session, and losing / regaining the internet
 *
 * It remembers the last status it saw for each order and ride (per account, in this browser),
 * so the first check after logging in records the current state without alerting.
 */
import { useEffect, useRef } from "react";
import { ApiError, type MerchantOffer, type MerchantOrder, type MerchantRideInbox, type Ride } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { merchantProductTitle } from "@/lib/merchant-content";
import { LOGOUT_EVENT, notify, notifyPrefs, selectNotificationOwner, type NotifyInput } from "@/lib/notifications";
import { fillWishItem, setWishStatus, WISHLIST_CHANGED, wishlistItems, wishStatus, type WishStatus } from "@/lib/wishlist";
import { toast, type ToastTone } from "@/lib/toast";

const VISIBLE_MS = 8_000;
const HIDDEN_MS = 30_000;
const PRODUCT_VISIBLE_MS = 30_000;
const PRODUCT_HIDDEN_MS = 120_000;
/** Remembered product ids (newest first) so a product is only "new" once. */
const MAX_SEEN_PRODUCTS = 400;
/** More new products than this at once become one summary notification. */
const MAX_SINGLE_ALERTS = 3;
/** Stores checked per round for saved products. */
const MAX_WISHLIST_STORES = 10;

type Seen = Record<string, string>;
type Source = "orders" | "rides" | "merchantOrders" | "rideRequests";

function readSeen(key: string): Seen {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Seen : {};
  } catch { return {}; }
}
function writeSeen(key: string, seen: Seen) {
  try { window.localStorage.setItem(key, JSON.stringify(seen)); } catch { /* alerts may repeat after a refresh */ }
}

/** Replace one source's entries in the snapshot and return the previous ones. */
function swap(seen: Seen, source: Source, next: Record<string, string>) {
  const prefix = `${source}:`;
  const before: Record<string, string> = {};
  for (const key of Object.keys(seen)) if (key.startsWith(prefix)) { before[key.slice(prefix.length)] = seen[key]; delete seen[key]; }
  for (const [id, value] of Object.entries(next)) seen[prefix + id] = value;
  const initialised = seen[`init:${source}`] === "1";
  seen[`init:${source}`] = "1";
  return { before, initialised };
}

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;
const ORDER_TONE: Record<MerchantOrder["status"], ToastTone> = { Pending: "info", Accepted: "success", OnTheWay: "info", Delivered: "success", Rejected: "error", Cancelled: "info" };
const RIDE_TONE: Record<Ride["status"], ToastTone> = { Pending: "info", Accepted: "success", InProgress: "info", Completed: "success", Cancelled: "warning" };

export default function NotificationWatcher() {
  const { api, user, ready } = useAuth();
  const { t, lang } = useT();
  const userId = user?.id ?? null;
  const role = user?.role ?? null;

  // Each account has its own inbox.
  useEffect(() => { if (ready) selectNotificationOwner(userId); }, [ready, userId]);

  // Logged out on purpose, or the session ran out / was revoked?
  const previousUser = useRef<string | null>(null);
  const manualLogout = useRef(false);
  useEffect(() => {
    const onLogout = () => { manualLogout.current = true; };
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const before = previousUser.current;
    previousUser.current = userId;
    if (!before || userId) return;
    if (manualLogout.current) toast(t("notify.loggedOut"), "info", { key: "session" });
    else toast(t("notify.sessionExpired"), "warning", { key: "session", duration: 0, action: { label: t("nav.login"), href: "/login" } });
    manualLogout.current = false;
  }, [ready, userId, t]);

  // Browser connectivity.
  useEffect(() => {
    const offline = () => toast(t("notify.offline"), "warning", { key: "network", duration: 0 });
    const online = () => toast(t("notify.online"), "success", { key: "network" });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [t]);

  // Order and ride status changes.
  useEffect(() => {
    if (!ready || !userId || (role !== "Customer" && role !== "Merchant")) return;
    const ctrl = new AbortController();
    const seenKey = `grab-notify-seen:${userId}`;
    const disabled = new Set<Source>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;

    const alert = (input: NotifyInput & { id: string }, tone: ToastTone, showToast = true) => {
      if (!notify(input) || !showToast) return;
      toast(input.body, tone, { title: input.title, action: input.href ? { label: t("notify.view"), href: input.href } : undefined });
    };

    /** Runs one API read; a 4xx (other than 401) means this account can't use it, so stop asking. */
    async function load<T>(source: Source, read: () => Promise<T>): Promise<T | null> {
      if (disabled.has(source)) return null;
      try { return await read(); }
      catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) disabled.add(source);
        return null;
      }
    }

    function customerOrders(seen: Seen, orders: MerchantOrder[]) {
      const { before, initialised } = swap(seen, "orders", Object.fromEntries(orders.map((o) => [o.id, o.status])));
      if (!initialised) return;
      for (const o of orders) {
        const previous = before[o.id];
        if (!previous || previous === o.status) continue;
        alert({
          id: `order:${o.id}:${o.status}`, kind: "order",
          title: t("notify.orderTitle", { store: o.merchantName }),
          body: t(`orders.status.${o.status}` as MessageKey),
          href: `/orders?partner=${encodeURIComponent(o.id)}`,
        }, ORDER_TONE[o.status], o.status !== "Cancelled"); // the customer cancelled it themselves
      }
    }

    function customerRides(seen: Seen, rides: Ride[]) {
      const { before, initialised } = swap(seen, "rides", Object.fromEntries(rides.map((r) => [r.id, r.status])));
      if (!initialised) return;
      for (const r of rides) {
        const previous = before[r.id];
        if (!previous || previous === r.status) continue;
        alert({
          id: `ride:${r.id}:${r.status}`, kind: "ride", title: t("notify.rideTitle"),
          body: t("notify.rideBody", { status: t(`rides.${r.status}` as MessageKey), destination: r.destination }),
          href: "/rides",
        }, RIDE_TONE[r.status]);
      }
    }

    function merchantOrders(seen: Seen, orders: MerchantOrder[]) {
      const { before, initialised } = swap(seen, "merchantOrders", Object.fromEntries(orders.map((o) => [o.id, o.status])));
      if (!initialised) return;
      for (const o of orders) {
        const previous = before[o.id];
        if (!previous && o.status === "Pending") {
          alert({
            id: `merchant-order:${o.id}`, kind: "merchant",
            title: `${t("notify.newOrderTitle")} ${shortId(o.id)}`,
            body: t("notify.newOrder", { count: o.items.reduce((n, i) => n + i.quantity, 0), total: money(o.total), address: o.deliveryAddress }),
            href: "/merchant",
          }, "info");
        } else if (previous && previous !== "Cancelled" && o.status === "Cancelled") {
          alert({
            id: `merchant-order:${o.id}:Cancelled`, kind: "merchant", title: t("notify.orderTitle", { store: o.merchantName }),
            body: t("notify.orderCancelledByCustomer", { id: shortId(o.id) }), href: "/merchant",
          }, "warning");
        }
      }
    }

    function rideRequests(seen: Seen, inbox: MerchantRideInbox) {
      const { before, initialised } = swap(seen, "rideRequests", Object.fromEntries(inbox.requests.map((r) => [r.ride.id, "1"])));
      if (!initialised) return;
      for (const { ride, customerName } of inbox.requests) {
        if (before[ride.id]) continue;
        alert({
          id: `ride-request:${ride.id}`, kind: "ride", title: t("notify.newRideTitle"),
          body: t("notify.newRide", { customer: customerName, pickup: ride.pickupLocation, destination: ride.destination }),
          href: "/merchant",
        }, "info");
      }
    }

    async function check() {
      if (role === "Customer") {
        const [orders, rides] = await Promise.all([
          load("orders", () => api.myOrders(1, ctrl.signal)),
          load("rides", () => api.myRides(1, ctrl.signal)),
        ]);
        if (ctrl.signal.aborted) return;
        const seen = readSeen(seenKey);
        if (orders) customerOrders(seen, orders);
        if (rides) customerRides(seen, rides);
        writeSeen(seenKey, seen);
      } else {
        const [orders, inbox] = await Promise.all([
          load("merchantOrders", () => api.merchantOrders(1, ctrl.signal)),
          load("rideRequests", () => api.merchantRideInbox(ctrl.signal)),
        ]);
        if (ctrl.signal.aborted) return;
        const seen = readSeen(seenKey);
        if (orders) merchantOrders(seen, orders);
        if (inbox) rideRequests(seen, inbox);
        writeSeen(seenKey, seen);
      }
    }

    const schedule = () => {
      if (ctrl.signal.aborted) return;
      timer = setTimeout(run, document.visibilityState === "hidden" ? HIDDEN_MS : VISIBLE_MS);
    };
    async function run() {
      if (busy || ctrl.signal.aborted) return;
      busy = true;
      clearTimeout(timer);
      try { await check(); } catch { /* the next check retries */ }
      finally { busy = false; schedule(); }
    }
    // Check straight away when the person comes back to the tab.
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVisible);
    void run();
    return () => { ctrl.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [api, ready, userId, role, t]);

  // New products and wishlist changes (guests and customers; merchants and admins don't shop).
  useEffect(() => {
    if (!ready || (role !== null && role !== "Customer")) return;
    const ctrl = new AbortController();
    const seenKey = `grab-notify-products:${userId ?? "guest"}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    const productHref = (merchantId: string, listingId: string) => `/partners/${encodeURIComponent(merchantId)}/products/${encodeURIComponent(listingId)}`;
    const name = (o: MerchantOffer) => merchantProductTitle(o.title, lang, o.merchant.service);
    const alert = (input: NotifyInput & { id: string }, tone: ToastTone) => {
      if (notify(input)) toast(input.body, tone, { title: input.title, action: input.href ? { label: t("notify.view"), href: input.href } : undefined });
    };

    async function newProducts() {
      const offers = (await api.merchantOffers(undefined, 1, ctrl.signal)).filter((o) => o.merchant.service !== "GrabRide");
      if (ctrl.signal.aborted) return;
      let saved: { ids?: unknown } | null = null;
      try { saved = JSON.parse(window.localStorage.getItem(seenKey) ?? "null"); } catch { /* start fresh */ }
      const known = Array.isArray(saved?.ids) ? (saved.ids as unknown[]).filter((id): id is string => typeof id === "string") : null;
      const seen = new Set(known ?? []);
      // First visit on this device: remember what is there without alerting.
      const fresh = known ? offers.filter((o) => !seen.has(o.id)) : [];
      const ids = [...new Set([...offers.map((o) => o.id), ...(known ?? [])])].slice(0, MAX_SEEN_PRODUCTS);
      try { window.localStorage.setItem(seenKey, JSON.stringify({ ids })); } catch { /* alerts may repeat after a refresh */ }
      if (!fresh.length || !notifyPrefs().newProducts) return;
      if (fresh.length > MAX_SINGLE_ALERTS) {
        alert({
          id: `product:new:${fresh.map((o) => o.id).sort().join(",")}`, kind: "product",
          title: t("notify.newProductsTitle"), body: t("notify.newProducts", { n: fresh.length }), href: "/",
        }, "info");
        return;
      }
      for (const o of fresh) alert({
        id: `product:new:${o.id}`, kind: "product", title: t("notify.newProductTitle", { store: o.merchant.businessName }),
        body: `${name(o)} · ${money(o.price)}`, href: productHref(o.merchant.id, o.id),
      }, "info");
    }

    async function wishlist() {
      const items = wishlistItems();
      if (!items.length) return;
      const merchants = [...new Set(items.map((item) => item.merchantId))].slice(0, MAX_WISHLIST_STORES);
      const listings = new Map<string, MerchantOffer>();
      const checked = new Set<string>();
      await Promise.all(merchants.map(async (id) => {
        try {
          const store = await api.merchantStorefront(id, ctrl.signal);
          store.listings.forEach((o) => listings.set(o.id, o));
          checked.add(id);
        } catch (err) {
          // A store that no longer exists means everything saved from it is sold out.
          if (err instanceof ApiError && err.status === 404) checked.add(id);
        }
      }));
      if (ctrl.signal.aborted) return;
      const prefs = notifyPrefs();
      const before = wishStatus();
      const next: Record<string, WishStatus> = {};
      const now = new Date().toISOString();
      const minute = now.slice(0, 16);
      for (const item of items) {
        const previous = before[item.listingId];
        if (!checked.has(item.merchantId)) { if (previous) next[item.listingId] = previous; continue; }
        const offer = listings.get(item.listingId);
        next[item.listingId] = { available: !!offer, price: offer?.price ?? previous?.price ?? item.price, checkedAt: now };
        if (offer) fillWishItem(offer);
        // A product saved from its page starts as available; "Notify me when it's back" (no title yet) starts sold out.
        if (!previous && item.title) continue;
        const wasAvailable = previous ? previous.available : false;
        const title = offer ? name(offer) : item.title || t("wish.untitled");
        const store = offer?.merchant.businessName ?? item.merchantName;
        const href = productHref(item.merchantId, item.listingId);
        if (offer && !wasAvailable) {
          if (prefs.restock) alert({ id: `restock:${item.listingId}:${minute}`, kind: "wishlist", title: t("notify.restockTitle"), body: t("notify.restock", { title, store }), href }, "success");
        } else if (!offer && wasAvailable) {
          if (prefs.wishlist) alert({ id: `soldout:${item.listingId}:${minute}`, kind: "wishlist", title: t("notify.soldOutTitle"), body: t("notify.soldOut", { title, store }), href }, "warning");
        } else if (offer && previous && offer.price < previous.price && prefs.wishlist) {
          alert({
            id: `pricedrop:${item.listingId}:${offer.price}`, kind: "wishlist", title: t("notify.priceDropTitle"),
            body: t("notify.priceDrop", { title, price: money(offer.price), was: money(previous.price) }), href,
          }, "success");
        }
      }
      setWishStatus(next);
    }

    const schedule = () => {
      if (ctrl.signal.aborted) return;
      timer = setTimeout(run, document.visibilityState === "hidden" ? PRODUCT_HIDDEN_MS : PRODUCT_VISIBLE_MS);
    };
    async function run() {
      if (busy || ctrl.signal.aborted) return;
      busy = true;
      clearTimeout(timer);
      try { await Promise.all([newProducts().catch(() => {}), wishlist().catch(() => {})]); }
      finally { busy = false; schedule(); }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    // Saving a product checks it straight away, so its status is known before the next round.
    const onWishlist = () => { void run(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(WISHLIST_CHANGED, onWishlist);
    void run();
    return () => { ctrl.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener(WISHLIST_CHANGED, onWishlist); };
  }, [api, ready, userId, role, t, lang]);

  return null;
}

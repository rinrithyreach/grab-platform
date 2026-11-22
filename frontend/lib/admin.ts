export const ADMIN_SECTIONS = ["overview", "users", "merchants", "listings", "categories", "promotions", "rides", "orders", "express", "deliveries", "drivers", "payments", "reviews", "audit", "settings", "team", "roles", "profile"] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export type AdminResource = Exclude<AdminSection, "overview" | "settings" | "team" | "roles" | "profile" | "promotions" | "categories">;
export interface AdminRecord { id: string; [key: string]: unknown }
export interface AdminPage { items: AdminRecord[]; total: number; page: number; pageSize: number }
export interface AdminOverview {
  users: number; activeUsers: number; merchants: number; drivers: number; publishedListings: number;
  pendingRides: number; pendingOrders: number; pendingDeliveries: number;
  /** GrabExpress share of the store-order counts (older APIs omit them). */
  pendingExpressOrders?: number; activeExpressOrders?: number;
  activeRides: number; activeOrders: number; activeDeliveries: number;
  simulatedPayments: number; completedOrderValue: number; updatedAt: string;
  activity: { date: string; rides: number; orders: number; deliveries: number }[];
  recentAudit: AdminRecord[];
}
type Column = { key: string; label: string; format?: "money" | "date" | "status" | "id" };
export const ADMIN_CONFIG: Record<AdminResource, { title: string; description: string; filters: string[]; columns: Column[] }> = {
  users: { title: "Users & access", description: "Manage accounts, administrator access and account status.", filters: ["Active", "Suspended", "Customer", "Merchant", "Driver", "Admin"], columns: [{ key: "fullName", label: "Name" }, { key: "contact", label: "Sign-in account" }, { key: "role", label: "Role", format: "status" }, { key: "accountStatus", label: "Status", format: "status" }, { key: "createdAt", label: "Joined", format: "date" }] },
  merchants: { title: "Merchants", description: "Manage business profiles across all three services.", filters: ["GrabFood", "GrabRide", "GrabExpress"], columns: [{ key: "businessName", label: "Business / partner" }, { key: "service", label: "Service", format: "status" }, { key: "ownerName", label: "Owner" }, { key: "contactPhone", label: "Contact" }, { key: "accountStatus", label: "Account", format: "status" }] },
  listings: { title: "Listings & banners", description: "Upload homepage banners, edit products, manage publishing and choose homepage features.", filters: ["Published", "Draft", "Featured"], columns: [{ key: "title", label: "Listing" }, { key: "merchantName", label: "Merchant" }, { key: "price", label: "Price", format: "money" }, { key: "publicationStatus", label: "Visibility", format: "status" }, { key: "updatedAt", label: "Updated", format: "date" }] },
  rides: { title: "Ride operations", description: "Monitor all rides and cancel active bookings when support is needed.", filters: ["Pending", "Accepted", "InProgress", "Completed", "Cancelled"], columns: [{ key: "id", label: "Ride", format: "id" }, { key: "pickupLocation", label: "Pickup" }, { key: "destination", label: "Destination" }, { key: "fare", label: "Fare", format: "money" }, { key: "status", label: "Status", format: "status" }] },
  orders: { title: "Food orders", description: "Review GrabFood orders and manage each one through delivery.", filters: ["Pending", "Accepted", "OnTheWay", "Delivered", "Rejected", "Cancelled"], columns: [{ key: "id", label: "Order", format: "id" }, { key: "merchantName", label: "Merchant" }, { key: "customerName", label: "Customer" }, { key: "total", label: "Total", format: "money" }, { key: "status", label: "Status", format: "status" }] },
  express: { title: "Express orders", description: "Review GrabExpress shop orders and manage each one through delivery.", filters: ["Pending", "Accepted", "OnTheWay", "Delivered", "Rejected", "Cancelled"], columns: [{ key: "id", label: "Order", format: "id" }, { key: "merchantName", label: "Store" }, { key: "customerName", label: "Customer" }, { key: "total", label: "Total", format: "money" }, { key: "status", label: "Status", format: "status" }] },
  deliveries: { title: "Parcel deliveries", description: "Track courier assignments, delivery stops and exceptions.", filters: ["Pending", "Scheduled", "Accepted", "PickedUp", "InTransit", "Delivered", "Failed", "Cancelled"], columns: [{ key: "id", label: "Delivery", format: "id" }, { key: "pickupName", label: "Sender" }, { key: "pickupAddress", label: "Pickup address" }, { key: "totalFare", label: "Fare", format: "money" }, { key: "status", label: "Status", format: "status" }] },
  drivers: { title: "Drivers", description: "Onboard dedicated driver accounts and manage availability.", filters: ["Available", "Unavailable"], columns: [{ key: "fullName", label: "Driver" }, { key: "phoneNumber", label: "Phone" }, { key: "vehicleType", label: "Vehicle" }, { key: "vehiclePlate", label: "License plate" }, { key: "availability", label: "Availability", format: "status" }] },
  payments: { title: "Payments", description: "Inspect simulated ride transactions. These records do not represent real money transfers.", filters: [], columns: [{ key: "id", label: "Transaction", format: "id" }, { key: "rideId", label: "Ride", format: "id" }, { key: "amount", label: "Amount", format: "money" }, { key: "status", label: "Status", format: "status" }, { key: "createdAt", label: "Created", format: "date" }] },
  reviews: { title: "Review moderation", description: "Review driver feedback and hide or restore public reviews.", filters: ["Visible", "Hidden"], columns: [{ key: "customerName", label: "Customer" }, { key: "rating", label: "Rating / 5" }, { key: "comment", label: "Review" }, { key: "reviewStatus", label: "Visibility", format: "status" }] },
  audit: { title: "Activity log", description: "A permanent record of changes made through the admin console.", filters: ["users", "merchants", "listings", "rides", "orders", "express", "deliveries", "drivers", "reviews", "categories", "promotions", "settings", "team", "roles", "profile"], columns: [{ key: "actorName", label: "Administrator" }, { key: "resource", label: "Section" }, { key: "action", label: "Change" }, { key: "reason", label: "Reason" }, { key: "createdAt", label: "Time", format: "date" }] },
};
export function adminValue(row: AdminRecord, key: string): unknown {
  if (key === "contact") return row.email || row.phoneNumber;
  if (key === "accountStatus") return row.isActive ? "Active" : "Suspended";
  if (key === "publicationStatus") return !row.isPublished ? "Draft" : row.showInSlideshow ? "Featured" : "Published";
  if (key === "availability") return row.isAvailable ? "Available" : "Unavailable";
  if (key === "reviewStatus") return row.isHidden ? "Hidden" : "Visible";
  return row[key];
}
export function adminActions(section: AdminResource, row: AdminRecord): { value: string; label: string }[] {
  const status = String(row.status);
  if (section === "rides" && ["Pending", "Accepted", "InProgress"].includes(status)) return [{ value: "Cancelled", label: "Cancel ride" }];
  if (section === "orders" || section === "express") {
    const next: Record<string, { value: string; label: string }> = { Pending: { value: "Accepted", label: "Accept order" }, Accepted: { value: "OnTheWay", label: "Mark on the way" }, OnTheWay: { value: "Delivered", label: "Mark delivered" } };
    return next[status] ? [next[status], { value: "Rejected", label: status === "Pending" ? "Reject order" : "Cancel order" }] : [];
  }
  if (section === "deliveries") {
    if (["Pending", "Scheduled", "Accepted"].includes(status)) return [{ value: "Cancelled", label: "Cancel delivery" }];
    if (["PickedUp", "InTransit"].includes(status)) return [{ value: "Failed", label: "Mark delivery failed" }];
  }
  if (section === "drivers") return [{ value: row.isAvailable ? "Unavailable" : "Available", label: row.isAvailable ? "Set unavailable" : "Set available" }];
  if (section === "reviews") return [{ value: row.isHidden ? "Restore" : "Hide", label: row.isHidden ? "Restore review" : "Hide review" }];
  return [];
}
export function adminCsv(section: AdminResource, rows: AdminRecord[]): string {
  const columns = ADMIN_CONFIG[section].columns;
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return [columns.map(c => cell(c.label)).join(","), ...rows.map(row => columns.map(c => cell(adminValue(row, c.key))).join(","))].join("\r\n");
}
/** The permission that guards a console section. Express lists GrabExpress shop orders, so it uses the Orders permission. */
export const adminPermissionSection = (section: AdminSection): string => section === "express" ? "orders" : section;

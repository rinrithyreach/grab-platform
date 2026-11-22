export interface PlatformSettings {
  supportEmail: string; supportPhone: string; supportHours: string; officeAddress: string;
  announcementEnabled: boolean; announcement: string; maintenanceMode: boolean; maintenanceMessage: string;
  ridesEnabled: boolean; foodEnabled: boolean; expressEnabled: boolean;
  customerRegistrationEnabled: boolean; merchantRegistrationEnabled: boolean;
}
export interface AdminSettings extends PlatformSettings { updatedAt: string | null; version: string }
export interface AdminProfile {
  id: string; fullName: string; email: string | null; contactPhone: string; jobTitle: string; bio: string;
  avatarUrl: string | null; refreshSeconds: number; compactTables: boolean;
  createdAt: string; lastLoginAt: string | null; passwordChangedAt: string | null; version: string;
  roleId: string | null; roleName: string; isSuperAdmin: boolean; permissions: string[];
}
export interface AdminPermissionSection { key: string; label: string; viewDescription: string; manageDescription: string | null }
export interface AdminRole {
  id: string; name: string; description: string; permissions: string[];
  administrators: number; activeAdministrators: number; createdAt: string; updatedAt: string; version: string;
}
export interface AdminRoles { roles: AdminRole[]; superAdministrators: number; catalog: AdminPermissionSection[] }
export interface SaveAdminRole { name: string; description: string; permissions: string[]; version?: string; reason: string }
export interface CreateUser { fullName: string; phoneNumber: string; email: string; password: string; reason: string }
export type PermissionLevel = "view" | "manage";

/** Whether the signed-in administrator's role grants a permission. Super administrators hold every permission. */
export function adminCan(profile: Pick<AdminProfile, "isSuperAdmin" | "permissions"> | null | undefined, section: string, level: PermissionLevel = "view"): boolean {
  if (!profile) return false;
  return profile.isSuperAdmin === true || (profile.permissions ?? []).includes(`${section}.${level}`);
}

/**
 * Fills in role fields the API may omit. An API that predates roles sends no permission list; on such an API every
 * administrator has full access, so that case is treated as Super administrator. The API still enforces access itself.
 */
export function normalizeAdminProfile(profile: AdminProfile): AdminProfile {
  const legacy = !Array.isArray(profile.permissions) && profile.isSuperAdmin === undefined;
  const isSuperAdmin = typeof profile.isSuperAdmin === "boolean" ? profile.isSuperAdmin : legacy;
  return { ...profile, isSuperAdmin, permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
    roleId: profile.roleId ?? null, roleName: profile.roleName || (isSuperAdmin ? "Super administrator" : "Administrator") };
}

/** Toggles one permission in a role draft: granting "manage" also grants "view", and removing "view" also removes "manage". */
export function togglePermission(current: string[], section: string, level: PermissionLevel, on: boolean): string[] {
  const set = new Set(current);
  const view = `${section}.view`, manage = `${section}.manage`;
  if (on) { set.add(`${section}.${level}`); set.add(view); }
  else if (level === "manage") set.delete(manage);
  else { set.delete(view); set.delete(manage); }
  return [...set];
}

/** True when every permission in `wanted` is also held by the administrator (so granting it is not an escalation). */
export function adminCovers(profile: Pick<AdminProfile, "isSuperAdmin" | "permissions"> | null | undefined, wanted: string[]): boolean {
  return !!profile && (profile.isSuperAdmin === true || wanted.every(p => (profile.permissions ?? []).includes(p)));
}
export interface AdminTeamMember {
  id: string; fullName: string; email: string | null; jobTitle: string; contactPhone: string; bio: string;
  avatarUrl: string | null; isActive: boolean; isYou: boolean; createdAt: string; lastLoginAt: string | null;
  passwordChangedAt: string | null; lastActivityAt: string | null; changesLast30Days: number;
  roleId: string | null; roleName: string;
}
export interface CreateAdmin { fullName: string; email: string; jobTitle: string; temporaryPassword: string; reason: string; adminRoleId: string | null }
export interface AdminActivity { id: string; resource: string; targetId: string; action: string; reason: string; createdAt: string }
export type SaveAdminProfile =Pick<AdminProfile, "fullName" | "contactPhone" | "jobTitle" | "bio" | "refreshSeconds" | "compactTables" | "version"> & { email: string | null; currentPassword?: string };

export function platformNotice(settings: PlatformSettings | null, pathname: string): string[] {
  if (!settings || pathname === "/admin" || pathname.startsWith("/admin/")) return [];
  const messages: string[] = [];
  if (settings.maintenanceMode) messages.push(settings.maintenanceMessage);
  else {
    if (!settings.ridesEnabled && pathname === "/ride") messages.push("GrabRide is temporarily paused for new bookings.");
    if (!settings.foodEnabled && ["/food", "/cart"].includes(pathname)) messages.push("GrabFood is temporarily paused for new orders.");
    if (!settings.expressEnabled && ["/express", "/cart"].includes(pathname)) messages.push("GrabExpress is temporarily paused for new bookings and orders.");
    if (!settings.customerRegistrationEnabled && pathname === "/register") messages.push("New customer registrations are temporarily paused.");
    if (!settings.merchantRegistrationEnabled && pathname === "/merchant/register") messages.push("New merchant registrations are temporarily paused.");
  }
  if (settings.announcementEnabled && settings.announcement) messages.push(settings.announcement);
  return messages;
}

/** Filters the administrator directory by free text (name, email, title, phone) and account status. */
export function filterAdminTeam(team: AdminTeamMember[], query: string, status: "" | "Active" | "Suspended"): AdminTeamMember[] {
  const q = query.trim().toLowerCase();
  return team.filter(m => (!status || (status === "Active") === m.isActive)
    && (!q || [m.fullName, m.email ?? "", m.jobTitle, m.contactPhone, m.roleName ?? ""].some(v => v.toLowerCase().includes(q))));
}
/** Initials for avatar placeholders: first letters of the first and last name. */
export function adminInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

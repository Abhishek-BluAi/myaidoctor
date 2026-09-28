/**
 * Central permission definitions for the entire application.
 * Every sidebar item, page, and action is defined here.
 */

export interface PermissionResource {
  key: string;
  label: string;
  group: "platform" | "admin" | "super_admin";
  sidebarPath?: string; // if this controls a sidebar item
  actions: string[];
}

export const PERMISSION_RESOURCES: PermissionResource[] = [
  // ── Platform ────────────────────────────────────────────
  { key: "dashboard", label: "Dashboard", group: "platform", sidebarPath: "/dashboard", actions: ["view"] },
  { key: "patients", label: "Patients", group: "platform", sidebarPath: "/patients", actions: ["view", "create", "edit", "delete"] },
  { key: "appointments", label: "Appointments", group: "platform", sidebarPath: "/appointments", actions: ["view", "create", "edit", "delete"] },
  { key: "pre_visit", label: "Pre-Visit Briefs", group: "platform", sidebarPath: "/pre-visit", actions: ["view", "create", "edit", "delete"] },
  { key: "pre_visit_workflow", label: "Pre-Visit Workflow", group: "platform", actions: ["view", "create", "edit"] },
  { key: "clinical_soap", label: "SOAP Notes", group: "platform", actions: ["view", "create", "export"] },
  { key: "voice_calls", label: "Voice AI Calls", group: "platform", sidebarPath: "/voice-calls", actions: ["view", "create", "edit"] },
  { key: "messaging", label: "Patient Messaging", group: "platform", sidebarPath: "/messaging", actions: ["view", "send", "bulk_send"] },
  { key: "inbound_calls", label: "Inbound Calls", group: "platform", sidebarPath: "/inbound-calls", actions: ["view", "process"] },
  { key: "voice_ai_monitor", label: "Voice AI Monitor", group: "platform", actions: ["view"] },
  { key: "settings", label: "Settings", group: "platform", sidebarPath: "/settings", actions: ["view", "edit"] },
  // ── Admin ───────────────────────────────────────────────
  { key: "admin_users", label: "User Management", group: "admin", sidebarPath: "/admin", actions: ["view", "approve", "reject", "invite"] },
  // ── Super Admin ─────────────────────────────────────────
  { key: "sa_overview", label: "SA Overview", group: "super_admin", sidebarPath: "/super-admin", actions: ["view"] },
  { key: "sa_users", label: "SA User Management", group: "super_admin", sidebarPath: "/super-admin/users", actions: ["view", "create", "edit", "delete", "reset_password", "reset_mfa"] },
  { key: "sa_roles", label: "SA Roles & Permissions", group: "super_admin", sidebarPath: "/super-admin/roles", actions: ["view", "create", "edit", "delete"] },
  { key: "sa_role_builder", label: "SA Role Builder", group: "super_admin", sidebarPath: "/super-admin/role-builder", actions: ["view", "edit"] },
  { key: "sa_organizations", label: "SA Organizations", group: "super_admin", sidebarPath: "/super-admin/organizations", actions: ["view", "create", "edit", "delete"] },
  { key: "sa_branding", label: "SA Branding & Theme", group: "super_admin", sidebarPath: "/super-admin/branding", actions: ["view", "edit"] },
  { key: "sa_settings", label: "SA System Settings", group: "super_admin", sidebarPath: "/super-admin/settings", actions: ["view", "edit"] },
  { key: "sa_api_management", label: "SA API Management", group: "super_admin", sidebarPath: "/super-admin/api-management", actions: ["view", "create", "edit", "delete"] },
  { key: "sa_audit_logs", label: "SA Audit Logs", group: "super_admin", sidebarPath: "/super-admin/audit-logs", actions: ["view", "export"] },
];

export const ALL_ACTIONS = ["view", "create", "edit", "delete", "approve", "reject", "invite", "reset_password", "reset_mfa", "export"];

/** Permission entry as stored in CustomRole.permissions JSON */
export interface PermissionEntry {
  resource: string;
  actions: string[];
}

/** Check if a permission set includes a specific resource+action */
export function hasPermission(
  permissions: PermissionEntry[],
  resource: string,
  action: string = "view"
): boolean {
  const entry = permissions.find((p) => p.resource === resource);
  return entry?.actions.includes(action) ?? false;
}

/** Check if a permission set allows viewing a sidebar path */
export function canViewPath(permissions: PermissionEntry[], path: string): boolean {
  const resource = PERMISSION_RESOURCES.find((r) => r.sidebarPath === path);
  if (!resource) return true; // no restriction defined
  return hasPermission(permissions, resource.key, "view");
}

/** Get all permissions (full access) */
export function fullPermissions(): PermissionEntry[] {
  return PERMISSION_RESOURCES.map((r) => ({
    resource: r.key,
    actions: [...r.actions],
  }));
}

/** Default permissions for built-in roles */
export function defaultPermissionsForRole(role: string): PermissionEntry[] {
  switch (role) {
    case "SUPER_ADMIN":
      return fullPermissions();

    case "ADMIN":
      return PERMISSION_RESOURCES
        .filter((r) => r.group !== "super_admin")
        .map((r) => ({ resource: r.key, actions: [...r.actions] }));

    case "PROVIDER":
      return [
        { resource: "dashboard", actions: ["view"] },
        { resource: "patients", actions: ["view", "create", "edit"] },
        { resource: "appointments", actions: ["view", "create", "edit"] },
        { resource: "pre_visit", actions: ["view", "create", "edit"] },
        { resource: "clinical_soap", actions: ["view", "create", "export"] },
        { resource: "voice_calls", actions: ["view"] },
        { resource: "messaging", actions: ["view", "send"] },
        { resource: "settings", actions: ["view"] },
      ];

    case "NURSE":
      return [
        { resource: "dashboard", actions: ["view"] },
        { resource: "patients", actions: ["view", "edit"] },
        { resource: "appointments", actions: ["view", "edit"] },
        { resource: "pre_visit", actions: ["view"] },
        { resource: "voice_calls", actions: ["view"] },
        { resource: "messaging", actions: ["view", "send"] },
        { resource: "settings", actions: ["view"] },
      ];

    case "FRONT_DESK":
      return [
        { resource: "dashboard", actions: ["view"] },
        { resource: "patients", actions: ["view", "create"] },
        { resource: "appointments", actions: ["view", "create", "edit", "delete"] },
        { resource: "voice_calls", actions: ["view", "create"] },
        { resource: "messaging", actions: ["view", "send", "bulk_send"] },
        { resource: "settings", actions: ["view"] },
      ];

    case "BILLING":
      return [
        { resource: "dashboard", actions: ["view"] },
        { resource: "patients", actions: ["view"] },
        { resource: "appointments", actions: ["view"] },
        { resource: "settings", actions: ["view"] },
      ];

    case "PATIENT":
      // Patients have NO platform access — they use the patient portal exclusively
      return [];

    default:
      return [{ resource: "dashboard", actions: ["view"] }];
  }
}

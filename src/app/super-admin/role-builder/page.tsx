"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, Plus, Loader2, Save, Trash2, Users, Eye, ChevronRight,
  LayoutDashboard, UserIcon, CalendarDays, FileText, Phone, Settings,
  ShieldCheck, Check,
} from "lucide-react";
import {
  PERMISSION_RESOURCES, PermissionEntry, PermissionResource,
  defaultPermissionsForRole,
} from "@/lib/permissions";

interface RoleData {
  id: string; name: string; description: string | null;
  permissions: PermissionEntry[]; isSystem: boolean; isActive: boolean;
  _count: { users: number };
}

interface UserData {
  id: string; email: string; firstName: string; lastName: string;
  role: string; customRole: { id: string; name: string } | null;
}

const SIDEBAR_ICONS: Record<string, any> = {
  "/dashboard": LayoutDashboard, "/patients": UserIcon,
  "/appointments": CalendarDays, "/pre-visit": FileText,
  "/voice-calls": Phone, "/settings": Settings,
  "/admin": ShieldCheck, "/super-admin": ShieldCheck,
};

const BUILT_IN_ROLES = ["SUPER_ADMIN", "ADMIN", "PROVIDER", "NURSE", "FRONT_DESK", "BILLING"];

export default function RoleBuilderPage() {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Currently selected role
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedBuiltIn, setSelectedBuiltIn] = useState<string | null>(null);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPerms, setEditPerms] = useState<PermissionEntry[]>([]);
  const [isNew, setIsNew] = useState(false);

  // User assignment tab
  const [showUsers, setShowUsers] = useState(false);

  const load = useCallback(async () => {
    const [r, u] = await Promise.all([
      fetch("/api/super-admin/roles").then((r) => r.json()),
      fetch("/api/super-admin/users").then((r) => r.json()),
    ]);
    setRoles(r.roles || []);
    setUsers(u.users || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectCustomRole(role: RoleData) {
    setSelectedRoleId(role.id);
    setSelectedBuiltIn(null);
    setEditName(role.name);
    setEditDesc(role.description || "");
    setEditPerms(Array.isArray(role.permissions) ? [...role.permissions as PermissionEntry[]] : []);
    setIsNew(false);
    setShowUsers(false);
  }

  function selectBuiltInRole(roleName: string) {
    setSelectedRoleId(null);
    setSelectedBuiltIn(roleName);
    setEditName(roleName);
    setEditDesc(`Built-in ${roleName.toLowerCase().replace(/_/g, " ")} role`);
    setEditPerms(defaultPermissionsForRole(roleName));
    setIsNew(false);
    setShowUsers(false);
  }

  function startNew() {
    setSelectedRoleId(null);
    setSelectedBuiltIn(null);
    setEditName("");
    setEditDesc("");
    setEditPerms([{ resource: "dashboard", actions: ["view"] }]);
    setIsNew(true);
    setShowUsers(false);
  }

  function getPermsForResource(resource: string): string[] {
    return editPerms.find((p) => p.resource === resource)?.actions || [];
  }

  function togglePerm(resource: string, action: string) {
    setEditPerms((prev) => {
      const existing = prev.find((p) => p.resource === resource);
      if (!existing) {
        return [...prev, { resource, actions: [action] }];
      }
      const newActions = existing.actions.includes(action)
        ? existing.actions.filter((a) => a !== action)
        : [...existing.actions, action];
      if (newActions.length === 0) {
        return prev.filter((p) => p.resource !== resource);
      }
      return prev.map((p) =>
        p.resource === resource ? { ...p, actions: newActions } : p
      );
    });
  }

  function toggleResource(resource: string, allActions: string[]) {
    const current = getPermsForResource(resource);
    if (current.length === allActions.length) {
      setEditPerms((prev) => prev.filter((p) => p.resource !== resource));
    } else {
      setEditPerms((prev) => {
        const filtered = prev.filter((p) => p.resource !== resource);
        return [...filtered, { resource, actions: [...allActions] }];
      });
    }
  }

  function toggleGroup(group: string) {
    const groupResources = PERMISSION_RESOURCES.filter((r) => r.group === group);
    const allGranted = groupResources.every(
      (r) => getPermsForResource(r.key).length === r.actions.length
    );
    if (allGranted) {
      setEditPerms((prev) =>
        prev.filter((p) => !groupResources.find((r) => r.key === p.resource))
      );
    } else {
      setEditPerms((prev) => {
        const keys = groupResources.map((r) => r.key);
        const filtered = prev.filter((p) => !keys.includes(p.resource));
        return [
          ...filtered,
          ...groupResources.map((r) => ({ resource: r.key, actions: [...r.actions] })),
        ];
      });
    }
  }

  async function handleSave() {
    if (!editName.trim()) { setMsg("Role name is required"); return; }
    if (selectedBuiltIn) { setMsg("Built-in roles cannot be edited — create a custom role instead"); return; }
    setSaving(true);

    const body = isNew
      ? { action: "create", name: editName, description: editDesc, permissions: editPerms }
      : { action: "update", roleId: selectedRoleId, name: editName, description: editDesc, permissions: editPerms };

    const res = await fetch("/api/super-admin/roles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMsg("Role saved");
      setIsNew(false);
      load();
    } else {
      const d = await res.json();
      setMsg(d.error || "Failed to save");
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleDelete() {
    if (!selectedRoleId || !confirm("Delete this role? Users will be unassigned.")) return;
    await fetch("/api/super-admin/roles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", roleId: selectedRoleId }),
    });
    setSelectedRoleId(null);
    load();
  }

  async function assignUser(userId: string, customRoleId: string | null) {
    await fetch("/api/super-admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", userId, customRoleId }),
    });
    load();
  }

  // Sidebar preview items
  const previewItems = PERMISSION_RESOURCES.filter(
    (r) => r.sidebarPath && getPermsForResource(r.key).includes("view")
  );

  const usersWithRole = selectedRoleId
    ? users.filter((u) => u.customRole?.id === selectedRoleId)
    : selectedBuiltIn
    ? users.filter((u) => u.role === selectedBuiltIn && !u.customRole)
    : [];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  const selected = selectedRoleId || selectedBuiltIn || isNew;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Role Builder</h1>
          <p className="text-sm text-slate-400 mt-1">
            Define granular permissions for every page, action, and sidebar item
          </p>
        </div>
        <button onClick={startNew} className="btn-primary"><Plus className="w-4 h-4" />New Custom Role</button>
      </div>

      {msg && <div className="p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300">{msg}</div>}

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Role List */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Built-in Roles</p>
            {BUILT_IN_ROLES.map((r) => {
              const count = users.filter((u) => u.role === r && !u.customRole).length;
              return (
                <button key={r} onClick={() => selectBuiltInRole(r)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    selectedBuiltIn === r ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-midnight-800"
                  }`}>
                  <span>{r.replace(/_/g, " ")}</span>
                  <span className={`text-xs ${selectedBuiltIn === r ? "text-brand-100" : "text-slate-600"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Custom Roles</p>
            {roles.map((r) => (
              <button key={r.id} onClick={() => selectCustomRole(r)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  selectedRoleId === r.id ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-midnight-800"
                }`}>
                <span>{r.name}</span>
                <span className={`text-xs ${selectedRoleId === r.id ? "text-brand-100" : "text-slate-600"}`}>{r._count.users}</span>
              </button>
            ))}
            {roles.length === 0 && <p className="text-xs text-slate-600 px-3 py-2">No custom roles yet</p>}
          </div>
        </div>

        {/* Center: Permission Matrix */}
        <div className="col-span-6">
          {!selected ? (
            <div className="card p-12 text-center">
              <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a role or create a new one</p>
            </div>
          ) : (
            <div className="card p-5 space-y-5">
              {/* Role name/desc */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Role Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    readOnly={!!selectedBuiltIn} placeholder="e.g. Clinical Staff"
                    className="input-field" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Description</label>
                  <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                    readOnly={!!selectedBuiltIn} placeholder="Optional description"
                    className="input-field" />
                </div>
              </div>

              {/* Permission matrix by group */}
              {(["platform", "admin", "super_admin"] as const).map((group) => {
                const groupResources = PERMISSION_RESOURCES.filter((r) => r.group === group);
                const groupLabel = group === "platform" ? "Platform Pages" : group === "admin" ? "Admin Features" : "Super Admin Features";
                const allGranted = groupResources.every(
                  (r) => getPermsForResource(r.key).length === r.actions.length
                );

                return (
                  <div key={group}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{groupLabel}</p>
                      <button onClick={() => toggleGroup(group)} disabled={!!selectedBuiltIn}
                        className="text-[11px] text-brand-400 hover:text-brand-300 disabled:text-slate-600">
                        {allGranted ? "Revoke All" : "Grant All"}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {groupResources.map((resource) => {
                        const currentActions = getPermsForResource(resource.key);
                        const allChecked = currentActions.length === resource.actions.length;
                        return (
                          <div key={resource.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-midnight-800/40">
                            {/* Resource toggle */}
                            <input type="checkbox" checked={allChecked}
                              onChange={() => toggleResource(resource.key, resource.actions)}
                              disabled={!!selectedBuiltIn}
                              className="w-4 h-4 rounded border-midnight-600 bg-midnight-800 text-brand-500 focus:ring-brand-500" />
                            <span className="text-sm text-slate-200 w-40 truncate">{resource.label}</span>
                            {/* Individual actions */}
                            <div className="flex items-center gap-2 flex-1 flex-wrap">
                              {resource.actions.map((action) => (
                                <label key={action}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                                    currentActions.includes(action)
                                      ? "bg-brand-900/60 text-brand-300 border border-brand-700/40"
                                      : "bg-midnight-800/60 text-slate-500 border border-midnight-700/30"
                                  } ${selectedBuiltIn ? "cursor-not-allowed opacity-60" : ""}`}>
                                  <input type="checkbox" checked={currentActions.includes(action)}
                                    onChange={() => togglePerm(resource.key, action)}
                                    disabled={!!selectedBuiltIn}
                                    className="sr-only" />
                                  {action}
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Actions */}
              {!selectedBuiltIn && (
                <div className="flex items-center gap-3 pt-2 border-t border-midnight-800/50">
                  <button onClick={handleSave} disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isNew ? "Create Role" : "Save Changes"}
                  </button>
                  {selectedRoleId && (
                    <button onClick={handleDelete} className="px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="w-4 h-4 inline mr-1" />Delete
                    </button>
                  )}
                </div>
              )}
              {selectedBuiltIn && (
                <p className="text-xs text-slate-500 italic pt-2 border-t border-midnight-800/50">
                  Built-in role permissions are read-only. Create a custom role to define custom permissions.
                </p>
              )}
            </div>
          )}

          {/* User Assignment */}
          {selected && !isNew && (
            <div className="card p-5 mt-4 space-y-3">
              <button onClick={() => setShowUsers(!showUsers)}
                className="flex items-center gap-2 text-sm font-semibold text-white w-full">
                <Users className="w-4 h-4 text-brand-400" />
                Users with this role ({usersWithRole.length})
                <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${showUsers ? "rotate-90" : ""}`} />
              </button>
              {showUsers && (
                <div className="space-y-2">
                  {usersWithRole.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-midnight-800/40">
                      <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-[10px] font-bold text-brand-100">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                      {selectedRoleId && (
                        <button onClick={() => assignUser(u.id, null)}
                          className="text-xs text-red-400 hover:bg-red-900/20 px-2 py-1 rounded">Remove</button>
                      )}
                    </div>
                  ))}
                  {usersWithRole.length === 0 && <p className="text-xs text-slate-500">No users assigned</p>}

                  {/* Assign user */}
                  {selectedRoleId && (
                    <div className="pt-2 border-t border-midnight-800/30">
                      <p className="text-xs text-slate-500 mb-2">Assign a user to this role:</p>
                      <select onChange={(e) => { if (e.target.value) { assignUser(e.target.value, selectedRoleId); e.target.value = ""; } }}
                        className="input-field text-sm" defaultValue="">
                        <option value="" disabled>Select user to assign...</option>
                        {users.filter((u) => u.customRole?.id !== selectedRoleId).map((u) => (
                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email}) — {u.role}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Sidebar Preview */}
        <div className="col-span-1 lg:col-span-3">
          {selected && (
            <div className="card p-4 space-y-3 sticky top-20">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Eye className="w-4 h-4 text-brand-400" />Sidebar Preview
              </div>
              <div className="bg-midnight-950 rounded-lg p-3 space-y-1 border border-midnight-800">
                {previewItems.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-4">No sidebar items visible</p>
                ) : (
                  previewItems.map((item) => {
                    const Icon = SIDEBAR_ICONS[item.sidebarPath!] || Shield;
                    return (
                      <div key={item.key}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-300">
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                        {item.label.replace("SA ", "")}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                This shows which sidebar items a user with this role will see.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

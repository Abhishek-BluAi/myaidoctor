"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Loader2, Trash2, Save } from "lucide-react";

const RESOURCES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "patients", label: "Patients" },
  { key: "appointments", label: "Appointments" },
  { key: "pre_visit", label: "Pre-Visit Briefs" },
  { key: "voice_calls", label: "Voice AI Calls" },
  { key: "settings", label: "Settings" },
  { key: "admin", label: "Admin Panel" },
  { key: "reports", label: "Reports" },
];

const ACTIONS = ["view", "create", "edit", "delete"];

interface RoleItem {
  id: string; name: string; description: string | null; permissions: any;
  isActive: boolean; isSystem: boolean; _count: { users: number };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editRole, setEditRole] = useState<RoleItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/super-admin/roles").then(r => r.json());
    setRoles(data.roles || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function togglePerm(resource: string, action: string) {
    setPermissions(prev => {
      const current = prev[resource] || [];
      return { ...prev, [resource]: current.includes(action) ? current.filter(a => a !== action) : [...current, action] };
    });
  }

  function toggleAllForResource(resource: string) {
    setPermissions(prev => {
      const current = prev[resource] || [];
      return { ...prev, [resource]: current.length === ACTIONS.length ? [] : [...ACTIONS] };
    });
  }

  function startEdit(role: RoleItem) {
    setEditRole(role); setName(role.name); setDescription(role.description || "");
    const perms: Record<string, string[]> = {};
    if (Array.isArray(role.permissions)) {
      (role.permissions as any[]).forEach((p: any) => { perms[p.resource] = p.actions || []; });
    }
    setPermissions(perms); setShowCreate(true);
  }

  function startNew() {
    setEditRole(null); setName(""); setDescription(""); setPermissions({}); setShowCreate(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const permArray = Object.entries(permissions).filter(([, a]) => a.length > 0).map(([resource, actions]) => ({ resource, actions }));
    const body = editRole
      ? { action: "update", roleId: editRole.id, name, description, permissions: permArray }
      : { action: "create", name, description, permissions: permArray };
    const res = await fetch("/api/super-admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowCreate(false); setMsg("Saved"); load(); } else { const d = await res.json(); setMsg(d.error); }
    setSaving(false); setTimeout(() => setMsg(""), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this role?")) return;
    await fetch("/api/super-admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", roleId: id }) });
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl sm:text-2xl font-display font-bold text-white">Roles & Permissions</h1>
        <p className="text-sm text-slate-400 mt-1">Define custom roles with granular page and action permissions</p></div>
        <button onClick={startNew} className="btn-primary"><Plus className="w-4 h-4" />New Role</button>
      </div>

      {msg && <div className="p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300">{msg}</div>}

      {showCreate && (
        <form onSubmit={handleSave} className="card p-5 space-y-5">
          <p className="font-semibold text-white">{editRole ? `Edit: ${editRole.name}` : "Create Custom Role"}</p>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Role name *" required value={name} onChange={e => setName(e.target.value)} className="input-field" />
            <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="input-field" />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-300 mb-3">Permissions Matrix</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase border-b border-midnight-800/50">
                  <th className="p-2 text-left">Resource</th>
                  {ACTIONS.map(a => <th key={a} className="p-2 text-center w-20">{a}</th>)}
                  <th className="p-2 text-center w-16">All</th>
                </tr></thead>
                <tbody>
                  {RESOURCES.map(r => (
                    <tr key={r.key} className="border-b border-midnight-800/30">
                      <td className="p-2 text-slate-200">{r.label}</td>
                      {ACTIONS.map(a => (
                        <td key={a} className="p-2 text-center">
                          <input type="checkbox" checked={(permissions[r.key] || []).includes(a)}
                            onChange={() => togglePerm(r.key, a)}
                            className="w-4 h-4 rounded border-midnight-600 bg-midnight-800 text-brand-500 focus:ring-brand-500" />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <input type="checkbox" checked={(permissions[r.key] || []).length === ACTIONS.length}
                          onChange={() => toggleAllForResource(r.key)}
                          className="w-4 h-4 rounded border-midnight-600 bg-midnight-800 text-brand-500 focus:ring-brand-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save Role"}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {roles.map(role => (
          <div key={role.id} className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-900/50 border border-brand-700/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{role.name}</p>
              <p className="text-xs text-slate-400">{role.description || "No description"} · {role._count.users} user{role._count.users !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => startEdit(role)} className="px-3 py-1.5 text-xs text-brand-400 hover:bg-brand-900/30 rounded-lg">Edit</button>
              {!role.isSystem && <button onClick={() => handleDelete(role.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-midnight-700 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}
        {roles.length === 0 && <div className="card p-8 text-center text-slate-500">No custom roles created yet</div>}
      </div>
    </div>
  );
}

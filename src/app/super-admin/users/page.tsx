"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Search, Key, ShieldOff, Shield, Check, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface UserItem {
  id: string; email: string; firstName: string; lastName: string;
  role: string; specialty: string | null; phone: string | null;
  isActive: boolean; isApproved: boolean; mfaEnabled: boolean; mfaRequired: boolean;
  createdAt: string;
  clinic: { id: string; name: string } | null;
  customRole: { id: string; name: string } | null;
}

const ROLES = ["SUPER_ADMIN", "ADMIN", "PROVIDER", "NURSE", "FRONT_DESK", "BILLING"];

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; message: string; label?: string; onConfirm: () => void } | null>(null);

  // Create form
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", password: "", role: "PROVIDER", clinicId: "", specialty: "", phone: "" });

  const load = useCallback(async () => {
    const [u, c, r] = await Promise.all([
      fetch("/api/super-admin/users").then(r => r.json()),
      fetch("/api/super-admin/clinics").then(r => r.json()),
      fetch("/api/super-admin/roles").then(r => r.json()),
    ]);
    setUsers(u.users || []);
    setClinics(c.clinics || []);
    setCustomRoles(r.roles || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function apiCall(body: any) {
    setActionLoading(body.userId || "new");
    const res = await fetch("/api/super-admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error); } else { setMsg("Done"); load(); }
    setActionLoading(null);
    setTimeout(() => setMsg(""), 3000);
    return res.ok;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await apiCall({ action: "create", ...form });
    if (ok) { setShowCreate(false); setForm({ email: "", firstName: "", lastName: "", password: "", role: "PROVIDER", clinicId: "", specialty: "", phone: "" }); }
  }

  const filtered = users.filter(u => `${u.firstName} ${u.lastName} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl sm:text-2xl font-display font-bold text-white">User Management</h1>
        <p className="text-sm text-slate-400 mt-1">{users.length} total users</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          {showCreate ? <><ChevronUp className="w-4 h-4" />Hide Form</> : <><Plus className="w-4 h-4" />Create User</>}
        </button>
      </div>

      {msg && <div className="p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300">{msg}</div>}

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <p className="font-semibold text-white text-sm">Create New User</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="First name *" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="input-field" />
            <input placeholder="Last name *" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="input-field" />
            <input placeholder="Email *" type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" />
            <input placeholder="Password *" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input-field">{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
            <select value={form.clinicId} onChange={e => setForm({...form, clinicId: e.target.value})} className="input-field"><option value="">No clinic</option>{clinics.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input placeholder="Specialty" value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} className="input-field" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" />
          </div>
          <button type="submit" disabled={actionLoading === "new"} className="btn-primary">{actionLoading === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}</button>
        </form>
      )}

      {/* Search */}
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input-field pl-10 max-w-md" /></div>

      {/* User Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-midnight-800/50 text-left text-xs text-slate-500 uppercase">
            <th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Clinic</th><th className="p-3">Status</th><th className="p-3">MFA</th><th className="p-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-b border-midnight-800/30 hover:bg-midnight-800/20">
                <td className="p-3"><p className="font-medium text-white">{u.firstName} {u.lastName}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                <td className="p-3"><span className="badge bg-midnight-800 text-slate-300">{u.role}</span>
                  {u.customRole && <span className="badge bg-brand-900/50 text-brand-300 ml-1">{u.customRole.name}</span>}</td>
                <td className="p-3 text-slate-400 text-xs">{u.clinic?.name || "—"}</td>
                <td className="p-3">
                  {u.isActive && u.isApproved ? <span className="badge bg-brand-900/50 text-brand-300">Active</span>
                    : !u.isApproved ? <span className="badge bg-amber-900/50 text-amber-300">Pending</span>
                    : <span className="badge bg-red-900/50 text-red-300">Inactive</span>}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {u.mfaEnabled ? <Check className="w-4 h-4 text-brand-400" /> : <X className="w-4 h-4 text-slate-600" />}
                    <button onClick={() => apiCall({ action: "toggle-mfa-required", userId: u.id, mfaRequired: !u.mfaRequired })}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${u.mfaRequired ? "bg-brand-900/40 border-brand-700/30 text-brand-300 hover:bg-red-900/30 hover:text-red-300 hover:border-red-700/30" : "bg-red-900/30 border-red-700/30 text-red-300 hover:bg-brand-900/40 hover:text-brand-300 hover:border-brand-700/30"}`}
                      title={u.mfaRequired ? "Click to disable MFA requirement" : "Click to enable MFA requirement"}>
                      {u.mfaRequired ? "Required" : "Disabled"}
                    </button>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    {!u.isApproved && u.isActive && <button onClick={() => apiCall({ action: "update", userId: u.id, isApproved: true })} className="px-2 py-1 text-xs text-brand-400 hover:bg-brand-900/30 rounded" title="Approve">Approve</button>}
                    <button onClick={() => setConfirm({
                      title: "Reset Password?",
                      message: `Enter a new password for ${u.firstName} ${u.lastName}. They will be notified by email.`,
                      label: "Reset",
                      onConfirm: () => { const pw = prompt("New password:"); if (pw) apiCall({ action: "reset-password", userId: u.id, newPassword: pw }); setConfirm(null); },
                    })}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-midnight-700 rounded" title="Reset Password"><Key className="w-3.5 h-3.5" /></button>
                    {u.mfaEnabled && <button onClick={() => setConfirm({
                      title: "Reset MFA?",
                      message: `This will clear MFA for ${u.firstName} ${u.lastName}. They will need to set it up again on next login.`,
                      label: "Reset MFA",
                      onConfirm: () => { apiCall({ action: "reset-mfa", userId: u.id }); setConfirm(null); },
                    })}
                      className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-midnight-700 rounded" title="Reset MFA"><ShieldOff className="w-3.5 h-3.5" /></button>}
                    <button onClick={() => setConfirm({
                      title: u.isActive ? "Deactivate User?" : "Activate User?",
                      message: u.isActive ? `${u.firstName} ${u.lastName} will lose access to the platform immediately.` : `${u.firstName} ${u.lastName} will regain access to the platform.`,
                      label: u.isActive ? "Deactivate" : "Activate",
                      onConfirm: () => { apiCall({ action: "update", userId: u.id, isActive: !u.isActive }); setConfirm(null); },
                    })}
                      className={`px-2 py-1 text-xs rounded ${u.isActive ? "text-red-400 hover:bg-red-900/30" : "text-brand-400 hover:bg-brand-900/30"}`}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-slate-500">No users found</p>}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.label || "Confirm"}
        confirmColor="red"
        onConfirm={confirm?.onConfirm || (() => {})}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

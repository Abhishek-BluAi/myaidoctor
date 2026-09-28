"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, Plus, Loader2, Save, Hospital, MapPin } from "lucide-react";

export default function OrganizationsPage() {
  const [tab, setTab] = useState<"hospitals" | "clinics">("hospitals");
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    const [h, c] = await Promise.all([
      fetch("/api/super-admin/hospitals").then(r => r.json()),
      fetch("/api/super-admin/clinics").then(r => r.json()),
    ]);
    setHospitals(h.hospitals || []); setClinics(c.clinics || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEditItem(null);
    setForm(tab === "hospitals"
      ? { name: "", address: "", city: "", state: "", zip: "", phone: "", website: "" }
      : { name: "", address: "", city: "", state: "", zip: "", phone: "", fax: "", ehrSystem: "Epic", hospitalId: "" });
    setShowForm(true);
  }

  function startEdit(item: any) {
    setEditItem(item);
    if (tab === "hospitals") setForm({ name: item.name, address: item.address || "", city: item.city || "", state: item.state || "", zip: item.zip || "", phone: item.phone || "", website: item.website || "" });
    else setForm({ name: item.name, address: item.address, city: item.city, state: item.state, zip: item.zip, phone: item.phone, fax: item.fax || "", ehrSystem: item.ehrSystem, hospitalId: item.hospital?.id || "" });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const endpoint = tab === "hospitals" ? "/api/super-admin/hospitals" : "/api/super-admin/clinics";
    const body = editItem
      ? { action: "update", ...(tab === "hospitals" ? { hospitalId: editItem.id } : { clinicId: editItem.id }), ...form }
      : { action: "create", ...form };
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(false); setMsg("Saved"); load(); } else { const d = await res.json(); setMsg(d.error); }
    setSaving(false); setTimeout(() => setMsg(""), 3000);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl sm:text-2xl font-display font-bold text-white">Organizations</h1>
        <p className="text-sm text-slate-400 mt-1">Manage hospitals, clinics, and their hierarchy</p></div>
        <button onClick={startNew} className="btn-primary"><Plus className="w-4 h-4" />Add {tab === "hospitals" ? "Hospital" : "Clinic"}</button>
      </div>

      {msg && <div className="p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300">{msg}</div>}

      <div className="flex gap-1 p-1 bg-midnight-900/80 rounded-lg border border-midnight-700/50 w-fit">
        {[{ id: "hospitals" as const, label: "Hospitals", icon: Hospital, count: hospitals.length },
          { id: "clinics" as const, label: "Clinics", icon: MapPin, count: clinics.length }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? "bg-brand-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            <t.icon className="w-4 h-4" />{t.label} ({t.count})
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card p-5 space-y-4">
          <p className="font-semibold text-white">{editItem ? "Edit" : "Create"} {tab === "hospitals" ? "Hospital" : "Clinic"}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="Name *" required value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} className="input-field" />
            <input placeholder="Address" value={form.address || ""} onChange={e => setForm({...form, address: e.target.value})} className="input-field" />
            <input placeholder="City" value={form.city || ""} onChange={e => setForm({...form, city: e.target.value})} className="input-field" />
            <input placeholder="State" value={form.state || ""} onChange={e => setForm({...form, state: e.target.value})} className="input-field" />
            <input placeholder="ZIP" value={form.zip || ""} onChange={e => setForm({...form, zip: e.target.value})} className="input-field" />
            <input placeholder="Phone" value={form.phone || ""} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" />
            {tab === "hospitals" && <input placeholder="Website" value={form.website || ""} onChange={e => setForm({...form, website: e.target.value})} className="input-field" />}
            {tab === "clinics" && <>
              <input placeholder="Fax" value={form.fax || ""} onChange={e => setForm({...form, fax: e.target.value})} className="input-field" />
              <input placeholder="EHR System" value={form.ehrSystem || ""} onChange={e => setForm({...form, ehrSystem: e.target.value})} className="input-field" />
              <select value={form.hospitalId || ""} onChange={e => setForm({...form, hospitalId: e.target.value})} className="input-field">
                <option value="">No parent hospital</option>
                {hospitals.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </>}
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {tab === "hospitals" && hospitals.map((h: any) => (
          <div key={h.id} className="card p-4 flex items-center gap-4 cursor-pointer hover:border-midnight-600/80" onClick={() => startEdit(h)}>
            <div className="w-10 h-10 rounded-lg bg-brand-900/50 border border-brand-700/30 flex items-center justify-center"><Hospital className="w-5 h-5 text-brand-400" /></div>
            <div className="flex-1"><p className="font-medium text-white">{h.name}</p>
            <p className="text-xs text-slate-400">{[h.city, h.state].filter(Boolean).join(", ")} · {h._count.clinics} clinic{h._count.clinics !== 1 ? "s" : ""}</p></div>
            <span className={`badge ${h.isActive ? "bg-brand-900/50 text-brand-300" : "bg-red-900/50 text-red-300"}`}>{h.isActive ? "Active" : "Inactive"}</span>
          </div>
        ))}
        {tab === "clinics" && clinics.map((c: any) => (
          <div key={c.id} className="card p-4 flex items-center gap-4 cursor-pointer hover:border-midnight-600/80" onClick={() => startEdit(c)}>
            <div className="w-10 h-10 rounded-lg bg-midnight-800 border border-midnight-700/50 flex items-center justify-center"><MapPin className="w-5 h-5 text-slate-300" /></div>
            <div className="flex-1"><p className="font-medium text-white">{c.name}</p>
            <p className="text-xs text-slate-400">{c.city}, {c.state} · {c.ehrSystem}{c.hospital ? ` · ${c.hospital.name}` : ""} · {c._count.users} users · {c._count.patients} patients</p></div>
            <span className={`badge ${c.isActive ? "bg-brand-900/50 text-brand-300" : "bg-red-900/50 text-red-300"}`}>{c.isActive ? "Active" : "Inactive"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

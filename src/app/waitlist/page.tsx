"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Clock, CheckCircle2, Bell, Users, Search, AlertCircle, X } from "lucide-react";

export default function WaitlistPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [preference, setPreference] = useState("anytime");
  const [saving, setSaving] = useState(false);

  async function loadWaitlist() {
    const res = await fetch("/api/waitlist?scope=all");
    const data = await res.json();
    setEntries(data.entries || []);
    setLoading(false);
  }

  useEffect(() => { loadWaitlist(); }, []);

  async function searchPatients(q: string) {
    setSearch(q);
    if (q.length < 2) { setPatients([]); return; }
    const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}`);
    const data = await res.json();
    setPatients(data.patients || []);
  }

  async function addToWaitlist() {
    if (!selectedPatient) return;
    setSaving(true);
    await fetch("/api/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", patientId: selectedPatient.id, preference, addedBy: "staff", notes: `Added by staff` }),
    });
    setSaving(false); setShowAdd(false); setSelectedPatient(null); setSearch(""); setPatients([]);
    loadWaitlist();
  }

  async function removeEntry(id: string) {
    await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", entryId: id }) });
    loadWaitlist();
  }

  async function cleanupWaitlist() {
    const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cleanup" }) });
    const data = await res.json();
    alert(`Cleaned ${data.cleaned} entries (patients who attended their appointments)`);
    loadWaitlist();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  const active = entries.filter(e => e.status === "active");
  const notified = entries.filter(e => e.status === "notified");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Cancellation Waitlist</h1>
          <p className="text-sm text-slate-400 mt-1">Patients waiting for earlier appointment slots. When a slot opens, all are notified — first to claim wins (2-min window).</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" />Add Patient</button>
          <button onClick={cleanupWaitlist} className="btn-secondary text-sm">Cleanup Attended</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active", value: active.length, icon: Clock, color: "text-brand-400", bg: "bg-brand-500/10" },
          { label: "Notified (awaiting claim)", value: notified.length, icon: Bell, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Total on list", value: entries.length, icon: Users, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Avg wait", value: active.length > 0 ? `${Math.round(active.reduce((s, e) => s + (Date.now() - new Date(e.createdAt).getTime()) / 86400000, 0) / active.length)}d` : "—", icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/10" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><Icon className={`w-4 h-4 ${s.color}`} /></div>
              <div><p className="text-lg font-bold text-white">{s.value}</p><p className="text-[10px] text-slate-500">{s.label}</p></div>
            </div>
          );
        })}
      </div>

      {/* Add Patient Panel */}
      {showAdd && (
        <div className="card p-5 space-y-4 border border-brand-700/30">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Add Patient to Waitlist</h3><button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button></div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Search Patient</label>
            <input value={search} onChange={e => searchPatients(e.target.value)} placeholder="Type name or phone (min 2 chars)" className="input-field" />
            {patients.length > 0 && (
              <div className="border border-midnight-700/50 rounded-lg max-h-32 overflow-y-auto">
                {patients.map((p: any) => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setSearch(`${p.firstName} ${p.lastName}`); }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-midnight-800/60 flex justify-between">
                    <span>{p.firstName} {p.lastName}</span><span className="text-xs text-slate-500">{p.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedPatient && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Time Preference</label>
                <select value={preference} onChange={e => setPreference(e.target.value)} className="input-field">
                  <option value="anytime">Anytime</option>
                  <option value="earliest">Earliest possible</option>
                  <option value="morning">Mornings only</option>
                  <option value="afternoon">Afternoons only</option>
                </select>
              </div>
              <button onClick={addToWaitlist} disabled={saving} className="btn-primary text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add {selectedPatient.firstName} to Waitlist
              </button>
            </>
          )}
        </div>
      )}

      {/* Notified — awaiting claim */}
      {notified.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2"><Bell className="w-4 h-4" />Notified — Awaiting Claim ({notified.length})</h2>
          {notified.map(e => {
            const expired = e.expiresAt && new Date() > new Date(e.expiresAt);
            return (
              <div key={e.id} className={`card p-4 flex items-center gap-4 ${expired ? "opacity-50" : "border border-amber-700/30"}`}>
                <div className="w-9 h-9 rounded-lg bg-amber-900/40 flex items-center justify-center"><Bell className="w-4 h-4 text-amber-400" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{e.patient?.firstName} {e.patient?.lastName}</p>
                  <p className="text-xs text-slate-400">Notified {e.notifiedAt ? new Date(e.notifiedAt).toLocaleTimeString() : "—"} · {expired ? "EXPIRED" : `Expires ${e.expiresAt ? new Date(e.expiresAt).toLocaleTimeString() : "—"}`}</p>
                </div>
                <span className={`text-xs font-medium ${expired ? "text-red-400" : "text-amber-300"}`}>{expired ? "Expired" : "⏳ Waiting"}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Active waitlist */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-brand-300 flex items-center gap-2"><Clock className="w-4 h-4" />Active Waitlist ({active.length})</h2>
        {active.length > 0 ? active.map(e => (
          <div key={e.id} className="card p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-brand-900/40 flex items-center justify-center"><Users className="w-4 h-4 text-brand-400" /></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{e.patient?.firstName} {e.patient?.lastName}</p>
              <p className="text-xs text-slate-400">
                {e.provider ? `Dr. ${e.provider.lastName} · ` : ""}
                Preference: {e.preference || "anytime"} · Added {new Date(e.createdAt).toLocaleDateString()} · via {e.addedBy || "—"}
              </p>
            </div>
            <button onClick={() => removeEntry(e.id)} className="p-1.5 text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        )) : (
          <div className="card p-8 text-center text-slate-500">No patients on the waitlist.</div>
        )}
      </div>
    </div>
  );
}

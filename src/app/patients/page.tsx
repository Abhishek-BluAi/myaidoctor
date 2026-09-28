"use client";

import { useState, useEffect } from "react";
import {
  Users, Plus, Search, Loader2, X, ChevronDown, ChevronUp,
  Download, Upload, CalendarPlus, ArrowRight, CheckCircle2,
  AlertCircle, RefreshCw, Database, ArrowLeft, Save,
} from "lucide-react";
import { ServiceIcon } from "@/components/ServiceIcon";

type ViewMode = "list" | "quick_add" | "full_registration" | "emr_search";

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Quick add
  const [quickForm, setQuickForm] = useState({ firstName: "", lastName: "", phone: "", email: "", dateOfBirth: "", gender: "Male", insuranceProvider: "", insurancePolicyId: "", clinicId: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Full registration
  const [fullForm, setFullForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", gender: "Male",
    phone: "", email: "", address: "", city: "", state: "MI", zip: "",
    insuranceProvider: "", insurancePolicyId: "", insuranceGroupId: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
    allergies: "", medications: "", conditions: "",
    socialHistory: "", familyHistory: "", surgicalHistory: "",
  });

  // EMR
  const [emrQuery, setEmrQuery] = useState("");
  const [emrResults, setEmrResults] = useState<any[]>([]);
  const [emrSearching, setEmrSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // Expanded patient
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState<string | null>(null);
  const [schedForm, setSchedForm] = useState({ date: "", time: "09:00", providerId: "", visitType: "FOLLOW_UP", reason: "" });
  const [providers, setProviders] = useState<any[]>([]);
  const [scheduling, setScheduling] = useState(false);

  // Sync
  const [syncData, setSyncData] = useState<any>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/patients").then(r => r.json()),
      fetch("/api/super-admin/users").then(r => r.json()).catch(() => ({ users: [] })),
    ]).then(([p, u]) => {
      setPatients(p.patients || []);
      setProviders((u.users || []).filter((u: any) => u.role === "PROVIDER"));
    }).finally(() => setLoading(false));
  }, []);

  async function searchPatients() {
    const res = await fetch(`/api/patients?search=${encodeURIComponent(search)}`);
    setPatients((await res.json()).patients || []);
  }
  useEffect(() => { if (search.length >= 2 || search.length === 0) searchPatients(); }, [search]);

  async function quickAdd() {
    setSaving(true); setSaveMsg("");
    const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...quickForm, dateOfBirth: quickForm.dateOfBirth ? new Date(quickForm.dateOfBirth) : null }) });
    if ((await res.json()).patient) { setSaveMsg("Patient added!"); setViewMode("list"); setQuickForm({ firstName: "", lastName: "", phone: "", email: "", dateOfBirth: "", gender: "Male", insuranceProvider: "", insurancePolicyId: "", clinicId: "" }); searchPatients(); }
    setSaving(false); setTimeout(() => setSaveMsg(""), 3000);
  }

  async function fullRegister() {
    setSaving(true); setSaveMsg("");
    const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...fullForm, dateOfBirth: fullForm.dateOfBirth ? new Date(fullForm.dateOfBirth) : null,
      allergies: fullForm.allergies.split(",").map(s => s.trim()).filter(Boolean),
      medications: fullForm.medications.split(",").map(s => s.trim()).filter(Boolean),
      conditions: fullForm.conditions.split(",").map(s => s.trim()).filter(Boolean),
    }) });
    if ((await res.json()).patient) { setSaveMsg("Patient registered!"); setViewMode("list"); searchPatients(); }
    setSaving(false); setTimeout(() => setSaveMsg(""), 3000);
  }

  async function searchEMR() {
    if (!emrQuery) return;
    setEmrSearching(true);
    const res = await fetch("/api/emr-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_emr", query: emrQuery }) });
    setEmrResults((await res.json()).results || []);
    setEmrSearching(false);
  }

  async function importFromEMR(emrPatient: any) {
    setImporting(emrPatient.emrId);
    const data = await (await fetch("/api/emr-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", emrPatient }) })).json();
    setImportResult(data); setImporting(null);
    if (data.imported) searchPatients();
  }

  async function syncCheck(patientId: string, emrPatient: any) {
    setSyncing(patientId);
    const data = await (await fetch("/api/emr-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync_check", patientId, emrPatient }) })).json();
    setSyncData({ patientId, ...data }); setSyncing(null);
  }

  async function scheduleAppt(patientId: string) {
    setScheduling(true);
    await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, scheduledAt: new Date(`${schedForm.date}T${schedForm.time}`).toISOString(), duration: 30, visitType: schedForm.visitType, status: "CONFIRMED", reasonForVisit: schedForm.reason, providerId: schedForm.providerId }) });
    setShowSchedule(null); setSchedForm({ date: "", time: "09:00", providerId: "", visitType: "FOLLOW_UP", reason: "" }); setScheduling(false);
  }

  async function pushToEMR(patientId: string) {
    const data = await (await fetch("/api/emr-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "push_to_emr", patientId }) })).json();
    alert(data.pushed ? `Pushed to EMR (${data.mode})` : `Error: ${data.error}`);
  }

  function uf(key: string, val: string) { setFullForm(f => ({ ...f, [key]: val })); }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  // ── Full Registration View ────────────────────────────
  if (viewMode === "full_registration") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode("list")} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-midnight-800/60"><ArrowLeft className="w-5 h-5" /></button>
          <div><h1 className="text-xl sm:text-2xl font-display font-bold text-white">New Patient Registration</h1><p className="text-sm text-slate-400">Complete demographics, insurance, and medical history</p></div>
        </div>
        {/* Demographics */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white">1</span>Demographics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">First Name *</label><input value={fullForm.firstName} onChange={e => uf("firstName", e.target.value)} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Last Name *</label><input value={fullForm.lastName} onChange={e => uf("lastName", e.target.value)} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Date of Birth *</label><input type="date" value={fullForm.dateOfBirth} onChange={e => uf("dateOfBirth", e.target.value)} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">Gender</label><select value={fullForm.gender} onChange={e => uf("gender", e.target.value)} className="input-field"><option>Male</option><option>Female</option><option>Non-binary</option><option>Other</option></select></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Phone *</label><input value={fullForm.phone} onChange={e => uf("phone", e.target.value)} placeholder="(248) 555-1234" className="input-field" /></div>
            <div className="col-span-1 lg:col-span-2 space-y-1"><label className="text-xs text-slate-400">Email</label><input value={fullForm.email} onChange={e => uf("email", e.target.value)} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-1 lg:col-span-2 space-y-1"><label className="text-xs text-slate-400">Address</label><input value={fullForm.address} onChange={e => uf("address", e.target.value)} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">City</label><input value={fullForm.city} onChange={e => uf("city", e.target.value)} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">State / ZIP</label><input value={fullForm.zip} onChange={e => uf("zip", e.target.value)} placeholder="MI 48167" className="input-field" /></div>
          </div>
        </div>
        {/* Insurance */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">2</span>Insurance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">Insurance Provider</label><input value={fullForm.insuranceProvider} onChange={e => uf("insuranceProvider", e.target.value)} placeholder="Blue Cross Blue Shield" className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Policy / Member ID</label><input value={fullForm.insurancePolicyId} onChange={e => uf("insurancePolicyId", e.target.value)} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Group ID</label><input value={fullForm.insuranceGroupId} onChange={e => uf("insuranceGroupId", e.target.value)} className="input-field" /></div>
          </div>
        </div>
        {/* Medical History */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">3</span>Medical History</h3>
          <div className="space-y-1"><label className="text-xs text-slate-400">Allergies (comma-separated)</label><input value={fullForm.allergies} onChange={e => uf("allergies", e.target.value)} placeholder="Penicillin, Shellfish, Latex" className="input-field" /></div>
          <div className="space-y-1"><label className="text-xs text-slate-400">Current Medications (comma-separated)</label><textarea value={fullForm.medications} onChange={e => uf("medications", e.target.value)} placeholder="Metformin 500mg BID, Lisinopril 10mg daily" className="input-field resize-none" rows={2} /></div>
          <div className="space-y-1"><label className="text-xs text-slate-400">Conditions / Diagnoses (comma-separated)</label><input value={fullForm.conditions} onChange={e => uf("conditions", e.target.value)} placeholder="Type 2 Diabetes, Hypertension" className="input-field" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">Surgical History</label><textarea value={fullForm.surgicalHistory} onChange={e => uf("surgicalHistory", e.target.value)} placeholder="Appendectomy 2015" className="input-field resize-none" rows={2} /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Family History</label><textarea value={fullForm.familyHistory} onChange={e => uf("familyHistory", e.target.value)} placeholder="Father: heart disease" className="input-field resize-none" rows={2} /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Social History</label><textarea value={fullForm.socialHistory} onChange={e => uf("socialHistory", e.target.value)} placeholder="Non-smoker" className="input-field resize-none" rows={2} /></div>
          </div>
        </div>
        {/* Emergency Contact */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-[10px] font-bold text-white">4</span>Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">Name</label><input value={fullForm.emergencyContactName} onChange={e => uf("emergencyContactName", e.target.value)} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Phone</label><input value={fullForm.emergencyContactPhone} onChange={e => uf("emergencyContactPhone", e.target.value)} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Relationship</label><select value={fullForm.emergencyContactRelation} onChange={e => uf("emergencyContactRelation", e.target.value)} className="input-field"><option value="">Select...</option><option>Spouse</option><option>Parent</option><option>Sibling</option><option>Child</option><option>Friend</option><option>Other</option></select></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={fullRegister} disabled={!fullForm.firstName || !fullForm.lastName || !fullForm.phone || saving} className="btn-primary py-3 px-8 disabled:opacity-40">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Register Patient</button>
          <button onClick={() => setViewMode("list")} className="btn-secondary py-3">Cancel</button>
        </div>
      </div>
    );
  }

  // ── Main List View ────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Patients</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setViewMode(viewMode === "emr_search" ? "list" : "emr_search")} className="btn-secondary text-xs py-1.5"><Database className="w-3 h-3" />EMR Search</button>
          <button onClick={() => setViewMode(viewMode === "quick_add" ? "list" : "quick_add")} className="btn-primary text-xs py-1.5"><Plus className="w-3 h-3" />Add Patient</button>
        </div>
      </div>

      {saveMsg && <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300"><CheckCircle2 className="w-4 h-4" />{saveMsg}</div>}

      {/* Quick Add */}
      {viewMode === "quick_add" && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Quick Add Patient</h3><button onClick={() => setViewMode("list")} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">First Name *</label><input value={quickForm.firstName} onChange={e => setQuickForm({...quickForm, firstName: e.target.value})} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Last Name *</label><input value={quickForm.lastName} onChange={e => setQuickForm({...quickForm, lastName: e.target.value})} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Phone *</label><input value={quickForm.phone} onChange={e => setQuickForm({...quickForm, phone: e.target.value})} placeholder="(248) 555-1234" className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Date of Birth</label><input type="date" value={quickForm.dateOfBirth} onChange={e => setQuickForm({...quickForm, dateOfBirth: e.target.value})} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">Email</label><input value={quickForm.email} onChange={e => setQuickForm({...quickForm, email: e.target.value})} className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Gender</label><select value={quickForm.gender} onChange={e => setQuickForm({...quickForm, gender: e.target.value})} className="input-field"><option>Male</option><option>Female</option><option>Other</option></select></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Insurance</label><input value={quickForm.insuranceProvider} onChange={e => setQuickForm({...quickForm, insuranceProvider: e.target.value})} placeholder="Blue Cross" className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Policy ID</label><input value={quickForm.insurancePolicyId} onChange={e => setQuickForm({...quickForm, insurancePolicyId: e.target.value})} className="input-field" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={quickAdd} disabled={!quickForm.firstName || !quickForm.lastName || !quickForm.phone || saving} className="btn-primary py-2 text-xs disabled:opacity-40">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}Add Patient</button>
            <button onClick={() => setViewMode("full_registration")} className="btn-secondary py-2 text-xs">Full Registration →</button>
          </div>
        </div>
      )}

      {/* EMR Search */}
      {viewMode === "emr_search" && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><Database className="w-4 h-4 text-cyan-400" />Search External EMR</h3><button onClick={() => setViewMode("list")} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button></div>
          <p className="text-xs text-slate-500">Search patients in BluHealth or other connected EMR/HMS systems</p>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 relative"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input value={emrQuery} onChange={e => setEmrQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchEMR()} placeholder="Search by name, MRN, or phone..." className="input-field pl-10" /></div>
            <button onClick={searchEMR} disabled={emrSearching} className="btn-primary py-2 text-xs">{emrSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}Search EMR</button>
          </div>
          {emrResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">{emrResults.length} results from BluHealth</p>
              {emrResults.map((p: any) => (
                <div key={p.emrId} className="flex items-center gap-3 p-3 rounded-lg bg-midnight-800/30 border border-midnight-700/30">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">{p.firstName[0]}{p.lastName[0]}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{p.firstName} {p.lastName}</p><p className="text-[10px] text-slate-500">{p.mrn} · {p.phone} · {p.insurance}</p></div>
                  <button onClick={() => importFromEMR(p)} disabled={importing === p.emrId} className="btn-primary py-1.5 text-xs">{importing === p.emrId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}Import</button>
                </div>
              ))}
              {importResult && <div className={`p-3 rounded-lg text-xs ${importResult.imported ? "bg-emerald-950/30 text-emerald-300" : "bg-amber-950/30 text-amber-300"}`}>{importResult.imported ? "✓ Patient imported" : importResult.exists ? "Patient already exists — use sync" : importResult.error}</div>}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients..." className="input-field pl-10" /></div>

      {/* Patient List */}
      <div className="space-y-2">
        {patients.map(p => {
          const isExp = expanded === p.id;
          return (
            <div key={p.id} className="card overflow-hidden">
              <button onClick={() => setExpanded(isExp ? null : p.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-midnight-800/20">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 ring-2 ring-emerald-500/20 flex items-center justify-center text-xs font-bold text-white shadow-md">{p.firstName[0]}{p.lastName[0]}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{p.firstName} {p.lastName}</p><p className="text-[10px] text-slate-500">{p.mrn} · {p.phone} · {p.email || ""}</p></div>
                <div className="text-right hidden md:block"><p className="text-xs text-slate-400">{p.insuranceProvider || "No insurance"}</p></div>
                {isExp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>
              {isExp && (
                <div className="px-4 pb-4 space-y-3 border-t border-midnight-800/30 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div><span className="text-slate-500 block">DOB</span><span className="text-white">{p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : "—"}</span></div>
                    <div><span className="text-slate-500 block">Gender</span><span className="text-white">{p.gender || "—"}</span></div>
                    <div><span className="text-slate-500 block">Insurance</span><span className="text-white">{p.insuranceProvider || "—"}</span></div>
                    <div><span className="text-slate-500 block">Policy ID</span><span className="text-white">{p.insurancePolicyId || "—"}</span></div>
                  </div>
                  {(p.conditions as string[])?.length > 0 && <div className="text-xs"><span className="text-slate-500">Conditions: </span><span className="text-white">{(p.conditions as string[]).join(", ")}</span></div>}
                  {(p.medications as string[])?.length > 0 && <div className="text-xs"><span className="text-slate-500">Medications: </span><span className="text-white">{(p.medications as string[]).join(", ")}</span></div>}
                  {(p.allergies as string[])?.length > 0 && <div className="text-xs"><span className="text-slate-500">Allergies: </span><span className="text-red-300">{(p.allergies as string[]).join(", ")}</span></div>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowSchedule(showSchedule === p.id ? null : p.id)} className="btn-secondary text-xs py-1.5"><CalendarPlus className="w-3 h-3" />Schedule Appointment</button>
                    <button onClick={() => pushToEMR(p.id)} className="btn-secondary text-xs py-1.5"><Upload className="w-3 h-3" />Push to EMR</button>
                  </div>
                  {showSchedule === p.id && (
                    <div className="p-3 rounded-lg bg-midnight-800/30 border border-midnight-700/30 space-y-3">
                      <p className="text-xs font-semibold text-white">Schedule Appointment for {p.firstName}</p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1"><label className="text-[10px] text-slate-400">Date</label><input type="date" value={schedForm.date} onChange={e => setSchedForm({...schedForm, date: e.target.value})} className="input-field text-xs" /></div>
                        <div className="space-y-1"><label className="text-[10px] text-slate-400">Time</label><input type="time" value={schedForm.time} onChange={e => setSchedForm({...schedForm, time: e.target.value})} className="input-field text-xs" /></div>
                        <div className="space-y-1"><label className="text-[10px] text-slate-400">Provider</label><select value={schedForm.providerId} onChange={e => setSchedForm({...schedForm, providerId: e.target.value})} className="input-field text-xs"><option value="">Select...</option>{providers.map((pr: any) => <option key={pr.id} value={pr.id}>Dr. {pr.lastName}</option>)}</select></div>
                        <div className="space-y-1"><label className="text-[10px] text-slate-400">Visit Type</label><select value={schedForm.visitType} onChange={e => setSchedForm({...schedForm, visitType: e.target.value})} className="input-field text-xs"><option value="FOLLOW_UP">Follow-Up</option><option value="ANNUAL_WELLNESS">Annual Wellness</option><option value="NEW_PATIENT">New Patient</option><option value="URGENT">Urgent</option></select></div>
                      </div>
                      <div className="space-y-1"><label className="text-[10px] text-slate-400">Reason</label><input value={schedForm.reason} onChange={e => setSchedForm({...schedForm, reason: e.target.value})} placeholder="Brief reason..." className="input-field text-xs" /></div>
                      <button onClick={() => scheduleAppt(p.id)} disabled={!schedForm.date || !schedForm.providerId || scheduling} className="btn-primary py-1.5 text-xs disabled:opacity-40">{scheduling ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarPlus className="w-3 h-3" />}Schedule</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {patients.length === 0 && <div className="card p-8 text-center text-slate-500">No patients found</div>}
      </div>
    </div>
  );
}

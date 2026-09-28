"use client";

import { useState, useEffect } from "react";
import {
  Send, Search, Loader2, CheckCircle2, Clock, AlertCircle, X,
  GripVertical, ChevronUp, ChevronDown, Plus, Trash2, ArrowRight,
  MessageCircle, Phone,
} from "lucide-react";
import { ServiceIcon, ServiceDot } from "@/components/ServiceIcon";

const SERVICES = [
  { id: "pre_visit_intake", label: "Pre-Visit Intake", desc: "Pre-visit questionnaire" },
  { id: "appointment_reminder", label: "Appointment Reminder", desc: "Confirm attendance" },
  { id: "refill_manager", label: "Medication Refill", desc: "Request refill" },
  { id: "schedule_assistant", label: "Schedule / Reschedule", desc: "Manage appointments" },
  { id: "referral_coordinator", label: "Referral Coordinator", desc: "Specialist referral" },
  { id: "post_visit_followup", label: "Post-Visit Follow-Up", desc: "Recovery check-in" },
  { id: "lab_results_review", label: "Lab Results Review", desc: "Review lab results" },
  { id: "new_patient_onboarding", label: "New Patient Onboarding", desc: "Registration" },
  { id: "chronic_disease_checkin", label: "Chronic Disease Check-In", desc: "Monthly check-in" },
  { id: "appointment_scheduler", label: "Appointment Scheduler", desc: "Book appointment" },
];

const STATUS_MAP: Record<string, { label: string; dot: string; bg: string }> = {
  sent: { label: "Sent", dot: "bg-amber-400", bg: "bg-amber-500/10 text-amber-300" },
  opened: { label: "Opened", dot: "bg-blue-400", bg: "bg-blue-500/10 text-blue-300" },
  completed: { label: "Completed", dot: "bg-emerald-400", bg: "bg-emerald-500/10 text-emerald-300" },
  expired: { label: "Expired", dot: "bg-slate-500", bg: "bg-slate-500/10 text-slate-400" },
};

interface QueueItem { id: string; serviceId: string; delayMinutes: number; }

export default function MessagingPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [channel, setChannel] = useState("sms");
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<any[]>([]);
  const [tab, setTab] = useState<"send" | "history" | "automation">("send");
  const [savedDefaults, setSavedDefaults] = useState<string[]>([]);
  const [autoUpcoming, setAutoUpcoming] = useState(true);
  const [autoCompleted, setAutoCompleted] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/patients").then(r => r.json()),
      fetch("/api/messaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) }).then(r => r.json()),
      fetch("/api/super-admin/settings").then(r => r.json()).catch(() => ({ settings: {} })),
    ]).then(([p, m, s]) => {
      setPatients(p.patients || []);
      setLinks(m.links || []);
      const settings = s.settings || {};
      const defaults = settings.messaging_default_services ? JSON.parse(settings.messaging_default_services) : ["appointment_reminder", "pre_visit_intake"];
      setSavedDefaults(defaults);
      setSelectedServices(defaults);
      setAutoUpcoming(settings.auto_upcoming !== "false");
      setAutoCompleted(settings.auto_completed !== "false");
    }).finally(() => setLoading(false));
  }, []);

  const filtered = search.length >= 2
    ? patients.filter(p => `${p.firstName} ${p.lastName} ${p.phone} ${p.email}`.toLowerCase().includes(search.toLowerCase()))
    : [];

  function toggleService(id: string) {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  function selectAll() { setSelectedServices(SERVICES.map(s => s.id)); }
  function clearAll() { setSelectedServices([]); }

  async function saveAsDefault() {
    setSavingDefaults(true);
    await fetch("/api/super-admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: {
        messaging_default_services: JSON.stringify(selectedServices),
        auto_upcoming: String(autoUpcoming),
        auto_completed: String(autoCompleted),
      }}),
    });
    setSavedDefaults([...selectedServices]);
    setSavingDefaults(false);
  }

  async function handleSend() {
    if (!selectedPatient || selectedServices.length === 0) return;
    setSending(true); setSendResults([]);
    const results: any[] = [];
    for (const serviceId of selectedServices) {
      const res = await fetch("/api/messaging", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", patientId: selectedPatient.id, serviceType: serviceId, channel }) });
      results.push({ ...(await res.json()), serviceId });
    }
    setSendResults(results);
    setSending(false);
    fetch("/api/messaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) }).then(r => r.json()).then(d => setLinks(d.links || []));
  }

  function reset() { setSelectedPatient(null); setSelectedServices([...savedDefaults]); setSendResults([]); setSearch(""); }


  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Patient Messaging</h1>
          <p className="text-sm text-slate-400 mt-1">Send service links to patients via SMS, WhatsApp, or iMessage</p>
        </div>
        <div className="flex gap-1 p-1 bg-midnight-900/80 rounded-lg border border-midnight-700/50">
          <button onClick={() => setTab("send")} className={`px-4 py-1.5 rounded text-xs font-medium ${tab === "send" ? "bg-brand-600 text-white" : "text-slate-400"}`}>Compose</button>
          <button onClick={() => setTab("automation")} className={`px-4 py-1.5 rounded text-xs font-medium ${tab === "automation" ? "bg-brand-600 text-white" : "text-slate-400"}`}>Automation</button>
          <button onClick={() => setTab("history")} className={`px-4 py-1.5 rounded text-xs font-medium ${tab === "history" ? "bg-brand-600 text-white" : "text-slate-400"}`}>History ({links.length})</button>
        </div>
      </div>

      {tab === "send" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
          <div className="col-span-1 lg:col-span-3 space-y-5">

            {/* Patient Search */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white shadow-md">1</span>
                Find Patient
              </div>
              {selectedPatient ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-900/15 border border-brand-700/20">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-xs font-bold text-white shadow-md">{selectedPatient.firstName[0]}{selectedPatient.lastName[0]}</div>
                  <div className="flex-1"><p className="text-sm font-medium text-white">{selectedPatient.firstName} {selectedPatient.lastName}</p><p className="text-[10px] text-slate-400">{selectedPatient.phone} · {selectedPatient.email}</p></div>
                  <button onClick={() => { setSelectedPatient(null); setSearch(""); }} className="p-1 text-slate-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type at least 2 characters to search..." className="input-field pl-10 py-3" autoFocus />
                  </div>
                  {search.length >= 2 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {filtered.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">No patients found for "{search}"</p>}
                      {filtered.slice(0, 8).map(p => (
                        <button key={p.id} onClick={() => setSelectedPatient(p)} className="w-full p-2.5 rounded-lg text-left flex items-center gap-3 hover:bg-midnight-800/50 transition-all group">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white">{p.firstName[0]}{p.lastName[0]}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{p.firstName} {p.lastName}</p><p className="text-[10px] text-slate-500">{p.phone}</p></div>
                          <ArrowRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
                  {search.length < 2 && search.length > 0 && <p className="text-[11px] text-slate-600 text-center">Keep typing...</p>}
                </>
              )}
            </div>

            {/* Select Services */}
            {selectedPatient && (
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-md">2</span>
                    Select Services
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <button onClick={selectAll} className="text-brand-400 hover:text-brand-300">Select All</button>
                    <span className="text-slate-600">|</span>
                    <button onClick={clearAll} className="text-slate-500 hover:text-slate-300">Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SERVICES.map(s => {
                    const checked = selectedServices.includes(s.id);
                    const isDefault = savedDefaults.includes(s.id);
                    return (
                      <label key={s.id} onClick={() => toggleService(s.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${checked ? "border-brand-500/50 bg-brand-950/30" : "border-midnight-700/40 hover:border-midnight-600"}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "border-brand-500 bg-brand-600" : "border-slate-600"}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <ServiceIcon type={s.id} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-white">{s.label}</p>
                          <p className="text-[9px] text-slate-500">{s.desc}</p>
                        </div>
                        {isDefault && <span className="text-[8px] text-brand-400/60 font-medium">DEFAULT</span>}
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-midnight-800/30">
                  <p className="text-[10px] text-slate-500">{selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""} selected</p>
                  <button onClick={saveAsDefault} disabled={savingDefaults}
                    className="text-[10px] text-brand-400 hover:text-brand-300 font-medium disabled:opacity-40">
                    {savingDefaults ? "Saving..." : "Save as Default for All Patients"}
                  </button>
                </div>
              </div>
            )}

            {/* Channel + Send */}
            {selectedPatient && selectedServices.length > 0 && (
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-md">3</span>
                  Channel & Send
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "sms", label: "SMS", icon: MessageCircle },
                    { id: "whatsapp", label: "WhatsApp", icon: Phone },
                    { id: "imessage", label: "iMessage", icon: Send },
                  ].map(c => {
                    const Icon = c.icon;
                    return (
                      <button key={c.id} onClick={() => setChannel(c.id)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${channel === c.id ? "border-brand-500 bg-brand-950/30 text-brand-300" : "border-midnight-700/50 text-slate-500"}`}>
                        <Icon className="w-3.5 h-3.5" />{c.label}
                      </button>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="p-3 rounded-lg bg-midnight-800/40 text-xs text-slate-400 space-y-1">
                  <p className="text-slate-300 font-medium">Summary</p>
                  <p>Sending <span className="text-white font-semibold">{selectedServices.length}</span> message{selectedServices.length > 1 ? "s" : ""} to <span className="text-white font-semibold">{selectedPatient.firstName} {selectedPatient.lastName}</span> via {channel.toUpperCase()}</p>
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {selectedServices.map((serviceId, i) => {
                      const svc = SERVICES.find(s => s.id === serviceId);
                      return (
                        <span key={serviceId} className="flex items-center gap-1">
                          {i > 0 && <span className="text-slate-600">→</span>}
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-midnight-700/50 rounded text-[10px] text-slate-300">
                            <ServiceDot type={serviceId} />{svc?.label}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button onClick={handleSend} disabled={sending} className="btn-primary w-full justify-center py-3 disabled:opacity-40">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send {selectedServices.length} Message{selectedServices.length > 1 ? "s" : ""} to {selectedPatient.firstName}
                </button>

                {/* Results */}
                {sendResults.length > 0 && (
                  <div className="space-y-2">
                    {sendResults.filter(r => r.success !== undefined).map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${r.success ? "bg-emerald-950/30 text-emerald-300" : "bg-red-950/30 text-red-300"}`}>
                        {r.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <ServiceDot type={r.serviceId} />
                        <span className="flex-1">{SERVICES.find(s => s.id === r.serviceId)?.label}</span>
                        {r.success ? <span className="text-[10px] text-slate-500">✓ Sent</span> : <span className="text-[10px]">{r.error}</span>}
                      </div>
                    ))}
                    <button onClick={reset} className="text-xs text-brand-400 hover:text-brand-300 mt-1">Send another</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: History sidebar */}
          <div className="col-span-1 lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Today", value: links.filter(l => new Date(l.sentAt).toDateString() === new Date().toDateString()).length, dot: "bg-blue-400" },
                { label: "Completed", value: links.filter(l => l.status === "completed").length, dot: "bg-emerald-400" },
                { label: "Pending", value: links.filter(l => l.status === "sent").length, dot: "bg-amber-400" },
                { label: "Opened", value: links.filter(l => l.status === "opened").length, dot: "bg-violet-400" },
              ].map(s => (
                <div key={s.label} className="card p-3 text-center">
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}</p>
                </div>
              ))}
            </div>
            <div className="card p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-300">Recent</p>
              {links.slice(0, 12).map(l => {
                const st = STATUS_MAP[l.status] || STATUS_MAP.sent;
                return (
                  <div key={l.id} className="flex items-center gap-2 py-1.5 border-b border-midnight-800/20 last:border-0">
                    <ServiceDot type={l.serviceType} />
                    <div className="flex-1 min-w-0"><p className="text-[11px] text-white truncate">{l.patient?.firstName} {l.patient?.lastName}</p></div>
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${st.bg}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>
                  </div>
                );
              })}
              {links.length === 0 && <p className="text-[11px] text-slate-600 py-4 text-center">No messages yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* History tab */}
      {/* ── Automation Tab ─────────────────────────────────── */}
      {tab === "automation" && (
        <div className="space-y-5 max-w-3xl">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Automatic Messaging Rules</h2>
            <p className="text-xs text-slate-400">Configure what gets sent automatically. These rules run daily and send messages to patients based on their appointment status.</p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 rounded-lg border border-midnight-700/40 cursor-pointer hover:bg-midnight-800/20" onClick={() => setAutoUpcoming(!autoUpcoming)}>
                <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${autoUpcoming ? "border-brand-500 bg-brand-600" : "border-slate-600"}`}>
                  {autoUpcoming && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Upcoming Appointments — Reminder + Pre-Visit Intake</p>
                  <p className="text-xs text-slate-400 mt-1">Automatically send an <strong className="text-brand-300">Appointment Reminder</strong> and <strong className="text-brand-300">Pre-Visit Intake</strong> form to all patients with appointments in the next 48 hours. Sent via SMS.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-midnight-700/50 rounded text-[10px] text-slate-300"><ServiceDot type="appointment_reminder" />Appointment Reminder</span>
                    <span className="text-slate-600 text-xs">→</span>
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-midnight-700/50 rounded text-[10px] text-slate-300"><ServiceDot type="pre_visit_intake" />Pre-Visit Intake</span>
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 rounded-lg border border-midnight-700/40 cursor-pointer hover:bg-midnight-800/20" onClick={() => setAutoCompleted(!autoCompleted)}>
                <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${autoCompleted ? "border-brand-500 bg-brand-600" : "border-slate-600"}`}>
                  {autoCompleted && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Completed Appointments — Post-Visit Follow-Up</p>
                  <p className="text-xs text-slate-400 mt-1">Automatically send a <strong className="text-brand-300">Post-Visit Follow-Up</strong> message to all patients whose appointments were completed today. Sent 2 hours after appointment end time.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-midnight-700/50 rounded text-[10px] text-slate-300"><ServiceDot type="post_visit_followup" />Post-Visit Follow-Up</span>
                  </div>
                </div>
              </label>
            </div>

            <button onClick={saveAsDefault} disabled={savingDefaults} className="btn-primary text-sm">
              {savingDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Automation Settings
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Default Services for Manual Send</h2>
            <p className="text-xs text-slate-400">When composing a new message, these services will be pre-selected by default.</p>
            <div className="flex flex-wrap gap-1.5">
              {savedDefaults.map(id => {
                const svc = SERVICES.find(s => s.id === id);
                return svc ? (
                  <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-950/30 border border-brand-700/20 rounded-lg text-[11px] text-brand-300">
                    <ServiceDot type={id} />{svc.label}
                  </span>
                ) : null;
              })}
              {savedDefaults.length === 0 && <p className="text-xs text-slate-500">No defaults set. Go to Compose tab to select and save defaults.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[600px]">
            <thead><tr className="border-b border-midnight-800/40 text-xs text-slate-500">
              <th className="text-left p-3 font-medium">Patient</th><th className="text-left p-3 font-medium">Service</th>
              <th className="text-left p-3 font-medium">Channel</th><th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Sent</th><th className="text-left p-3 font-medium">Opened</th><th className="text-left p-3 font-medium">Completed</th>
            </tr></thead>
            <tbody>{links.map(l => {
              const st = STATUS_MAP[l.status] || STATUS_MAP.sent;
              return (
                <tr key={l.id} className="border-b border-midnight-800/15 hover:bg-midnight-800/15 text-sm">
                  <td className="p-3 text-white">{l.patient?.firstName} {l.patient?.lastName}</td>
                  <td className="p-3 flex items-center gap-1.5"><ServiceDot type={l.serviceType} /><span className="text-xs text-slate-300">{SERVICES.find(s => s.id === l.serviceType)?.label}</span></td>
                  <td className="p-3 text-xs text-slate-400 uppercase">{l.channel}</td>
                  <td className="p-3"><span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded text-[10px] font-medium ${st.bg}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span></td>
                  <td className="p-3 text-xs text-slate-500">{new Date(l.sentAt).toLocaleString()}</td>
                  <td className="p-3 text-xs text-slate-500">{l.openedAt ? new Date(l.openedAt).toLocaleString() : "—"}</td>
                  <td className="p-3 text-xs text-slate-500">{l.completedAt ? new Date(l.completedAt).toLocaleString() : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          {links.length === 0 && <p className="p-8 text-center text-slate-500">No messages sent yet</p>}
        </div>
      )}
    </div>
  );
}

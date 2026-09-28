"use client";

import { useState, useEffect } from "react";
import {
  PhoneIncoming, Loader2, CheckCircle2, AlertCircle, Send, Clock, X,
  Play, MessageCircle, User, ChevronDown, ChevronUp, Mic,
} from "lucide-react";
import { ServiceIcon, ServiceDot } from "@/components/ServiceIcon";

const SERVICES = [
  { id: "pre_visit_intake", label: "Pre-Visit Intake" },
  { id: "appointment_reminder", label: "Appointment Reminder" },
  { id: "refill_manager", label: "Medication Refill" },
  { id: "schedule_assistant", label: "Schedule / Reschedule" },
  { id: "referral_coordinator", label: "Referral Coordinator" },
  { id: "post_visit_followup", label: "Post-Visit Follow-Up" },
  { id: "lab_results_review", label: "Lab Results Review" },
  { id: "new_patient_onboarding", label: "New Patient Onboarding" },
  { id: "chronic_disease_checkin", label: "Chronic Disease Check-In" },
  { id: "appointment_scheduler", label: "Appointment Scheduler" },
  { id: "custom", label: "Custom Message" },
];

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  received: { label: "New", color: "bg-red-500/15 text-red-300", dot: "bg-red-400" },
  identified: { label: "Identified", color: "bg-blue-500/15 text-blue-300", dot: "bg-blue-400" },
  link_sent: { label: "Link Sent", color: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" },
  completed: { label: "Completed", color: "bg-slate-500/15 text-slate-400", dot: "bg-slate-400" },
};

export default function InboundCallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Record<string, string>>({});
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const [processResult, setProcessResult] = useState<Record<string, any>>({});
  const [showSimulate, setShowSimulate] = useState(false);
  const [simPhone, setSimPhone] = useState("");
  const [simTranscript, setSimTranscript] = useState("");
  const [simulating, setSimulating] = useState(false);

  useEffect(() => { loadCalls(); }, []);

  async function loadCalls() {
    const res = await fetch("/api/inbound-call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) });
    const data = await res.json();
    setCalls(data.calls || []);
    setLoading(false);
  }

  async function processCall(callId: string) {
    const svc = selectedService[callId];
    if (!svc) return;
    setProcessing(callId);
    const res = await fetch("/api/inbound-call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process", callId, serviceType: svc, customMessage: svc === "custom" ? customMessages[callId] : undefined, channel: "sms" }),
    });
    const data = await res.json();
    setProcessResult(prev => ({ ...prev, [callId]: data }));
    setProcessing(null);
    loadCalls();
  }

  async function simulateCall() {
    if (!simPhone) return;
    setSimulating(true);
    await fetch("/api/inbound-call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "simulate", callerPhone: simPhone, transcript: simTranscript }) });
    setSimPhone(""); setSimTranscript(""); setShowSimulate(false); setSimulating(false);
    loadCalls();
  }

  const newCalls = calls.filter(c => c.status === "received" || c.status === "identified");
  const processedCalls = calls.filter(c => c.status === "link_sent" || c.status === "completed");

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Inbound Calls</h1>
          <p className="text-sm text-slate-400 mt-1">Incoming patient calls — identify, route to services, or record custom messages</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSimulate(!showSimulate)} className="btn-secondary text-xs py-1.5"><Play className="w-3 h-3" />Simulate Call</button>
          <button onClick={loadCalls} className="btn-secondary text-xs py-1.5"><Loader2 className="w-3 h-3" />Refresh</button>
        </div>
      </div>

      {/* Simulate panel */}
      {showSimulate && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-white">Simulate Incoming Call</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs text-slate-400">Caller Phone</label>
            <input value={simPhone} onChange={e => setSimPhone(e.target.value)} placeholder="(248) 555-1234" className="input-field" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Voicemail / Transcript (optional)</label>
            <input value={simTranscript} onChange={e => setSimTranscript(e.target.value)} placeholder="I need to refill my blood pressure medication" className="input-field" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={simulateCall} disabled={!simPhone || simulating} className="btn-primary py-2 text-xs disabled:opacity-40">
              {simulating ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneIncoming className="w-3 h-3" />}Simulate
            </button>
            <button onClick={() => setShowSimulate(false)} className="btn-secondary py-2 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "New Calls", value: newCalls.length, gradient: "from-red-500 to-rose-600", icon: PhoneIncoming },
          { label: "Identified", value: calls.filter(c => c.status === "identified").length, gradient: "from-blue-500 to-indigo-600", icon: User },
          { label: "Links Sent", value: calls.filter(c => c.status === "link_sent").length, gradient: "from-emerald-500 to-teal-600", icon: Send },
          { label: "Total Today", value: calls.filter(c => new Date(c.receivedAt).toDateString() === new Date().toDateString()).length, gradient: "from-violet-500 to-purple-600", icon: Clock },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} ring-2 ring-white/5 flex items-center justify-center shadow-lg`}><Icon className="w-5 h-5 text-white" /></div>
              <div><p className="text-xl font-bold text-white">{s.value}</p><p className="text-[10px] text-slate-500">{s.label}</p></div>
            </div>
          );
        })}
      </div>

      {/* New calls requiring action */}
      {newCalls.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2"><PhoneIncoming className="w-4 h-4" />Needs Action ({newCalls.length})</h2>
          {newCalls.map(call => {
            const isExp = expanded === call.id;
            const st = STATUS_MAP[call.status];
            const result = processResult[call.id];
            return (
              <div key={call.id} className="card overflow-hidden">
                <button onClick={() => setExpanded(isExp ? null : call.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-midnight-800/20">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 ring-2 ring-red-500/20 flex items-center justify-center shadow-lg"><PhoneIncoming className="w-5 h-5 text-white" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{call.patientName || "Unknown Caller"}</p>
                    <p className="text-[10px] text-slate-500">{call.callerPhone} · {new Date(call.receivedAt).toLocaleTimeString()}</p>
                  </div>
                  {call.intent && call.intent !== "custom" && <span className="flex items-center gap-1"><ServiceDot type={call.intent} /><span className="text-[10px] text-slate-400">{SERVICES.find(s => s.id === call.intent)?.label}</span></span>}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${st.color}`}>{st.label}</span>
                  {isExp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {isExp && (
                  <div className="px-4 pb-4 space-y-3 border-t border-midnight-800/30 pt-3">
                    {call.customMessage && <div className="p-3 rounded-lg bg-midnight-800/40 text-xs text-slate-300"><Mic className="w-3 h-3 inline mr-1 text-slate-500" />"{call.customMessage}"</div>}

                    <p className="text-xs text-slate-400">Select a service to send to this caller:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {SERVICES.map(s => (
                        <button key={s.id} onClick={() => setSelectedService(prev => ({ ...prev, [call.id]: s.id }))}
                          className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all text-[11px] ${selectedService[call.id] === s.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/40 hover:border-midnight-600"}`}>
                          {s.id !== "custom" ? <ServiceIcon type={s.id} size="sm" /> : <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center"><MessageCircle className="w-3.5 h-3.5 text-white" /></div>}
                          <span className="text-white truncate">{s.label}</span>
                        </button>
                      ))}
                    </div>

                    {selectedService[call.id] === "custom" && (
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Custom message to patient</label>
                        <textarea value={customMessages[call.id] || ""} onChange={e => setCustomMessages(prev => ({ ...prev, [call.id]: e.target.value }))}
                          placeholder="We received your call. Someone from our team will be in touch with you shortly..." rows={2} className="input-field text-xs resize-none" />
                      </div>
                    )}

                    {result ? (
                      <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${result.success ? "bg-emerald-950/30 text-emerald-300" : "bg-red-950/30 text-red-300"}`}>
                        {result.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {result.success ? result.message || `${result.service} link sent` : result.error}
                      </div>
                    ) : (
                      <button onClick={() => processCall(call.id)} disabled={!selectedService[call.id] || !!processing}
                        className="btn-primary w-full justify-center py-2.5 text-xs disabled:opacity-40">
                        {processing === call.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {selectedService[call.id] === "custom" ? "Record & Notify Patient" : `Send ${SERVICES.find(s => s.id === selectedService[call.id])?.label || "Service"} Link`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Processed calls */}
      {processedCalls.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400">Processed ({processedCalls.length})</h2>
          {processedCalls.map(call => {
            const st = STATUS_MAP[call.status];
            return (
              <div key={call.id} className="card px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                <div className="flex-1">
                  <p className="text-sm text-white">{call.patientName || call.callerPhone}</p>
                  <p className="text-[10px] text-slate-500">{call.callerPhone} · {new Date(call.receivedAt).toLocaleString()}</p>
                </div>
                {call.intent && <span className="flex items-center gap-1"><ServiceDot type={call.intent} /><span className="text-[10px] text-slate-400">{SERVICES.find(s => s.id === call.intent)?.label}</span></span>}
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${st.color}`}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {calls.length === 0 && !showSimulate && (
        <div className="card p-12 text-center">
          <PhoneIncoming className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No inbound calls yet</p>
          <p className="text-xs text-slate-500 mt-1">Use "Simulate Call" to test, or configure your phone system webhook to: <code className="text-brand-300">/api/inbound-call</code></p>
        </div>
      )}
    </div>
  );
}

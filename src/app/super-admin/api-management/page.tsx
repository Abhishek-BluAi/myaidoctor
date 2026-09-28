"use client";

import { useState, useEffect } from "react";
import {
  Key, Copy, Eye, EyeOff, Loader2, CheckCircle2, RefreshCw, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownLeft, Globe, Shield, Code, Zap, Database, Users,
  CalendarDays, FileText, MessageCircle, Phone, Bot, Lock, Unlock,
} from "lucide-react";
import { SettingsLock } from "@/components/ConfirmDialog";

const TAGS = [
  { id: "Patients", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", gradient: "from-emerald-500 to-teal-600" },
  { id: "Appointments", icon: CalendarDays, color: "text-violet-400", bg: "bg-violet-500/10", ring: "ring-violet-500/20", gradient: "from-violet-500 to-purple-600" },
  { id: "Pre-Visit", icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20", gradient: "from-amber-500 to-orange-600" },
  { id: "FHIR R4", icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10", ring: "ring-cyan-500/20", gradient: "from-cyan-500 to-blue-600" },
  { id: "Messaging", icon: MessageCircle, color: "text-rose-400", bg: "bg-rose-500/10", ring: "ring-rose-500/20", gradient: "from-rose-500 to-pink-600" },
  { id: "Voice", icon: Phone, color: "text-blue-400", bg: "bg-blue-500/10", ring: "ring-blue-500/20", gradient: "from-blue-500 to-indigo-600" },
  { id: "AI Agents", icon: Bot, color: "text-purple-400", bg: "bg-purple-500/10", ring: "ring-purple-500/20", gradient: "from-purple-500 to-violet-600" },
];

const ENDPOINTS = [
  { method: "GET", path: "/patients", tag: "Patients", dir: "out", desc: "List all patients with optional search filter", params: "?search=jane&limit=50" },
  { method: "POST", path: "/patients", tag: "Patients", dir: "in", desc: "Create new patient from EHR/HMS system", body: '{ "firstName": "Jane", "lastName": "Smith", "phone": "..." }' },
  { method: "GET", path: "/patients/{id}", tag: "Patients", dir: "out", desc: "Get full patient record by ID" },
  { method: "PUT", path: "/patients/{id}", tag: "Patients", dir: "in", desc: "Update patient record from external system" },
  { method: "GET", path: "/appointments", tag: "Appointments", dir: "out", desc: "List appointments with date/provider/status filters", params: "?date=2026-05-26&status=CONFIRMED" },
  { method: "POST", path: "/appointments", tag: "Appointments", dir: "in", desc: "Create appointment from scheduling system", body: '{ "patientId": "...", "scheduledAt": "...", "visitType": "FOLLOW_UP" }' },
  { method: "GET", path: "/appointments/{id}", tag: "Appointments", dir: "out", desc: "Get appointment with associated pre-visit brief" },
  { method: "PUT", path: "/appointments/{id}", tag: "Appointments", dir: "in", desc: "Update appointment status or details" },
  { method: "GET", path: "/intake/{appointmentId}", tag: "Pre-Visit", dir: "out", desc: "Get complete pre-visit brief: SOAP note, transcript, FHIR R4 bundle" },
  { method: "POST", path: "/intake/{appointmentId}", tag: "Pre-Visit", dir: "in", desc: "Submit intake data → auto-generates SOAP note + FHIR bundle", body: '{ "chiefComplaint": "...", "symptoms": {...} }' },
  { method: "GET", path: "/intake/{appointmentId}/fhir", tag: "FHIR R4", dir: "out", desc: "Pure FHIR R4 transaction bundle (application/fhir+json) for EMR integration" },
  { method: "POST", path: "/messaging/send", tag: "Messaging", dir: "out", desc: "Send SMS/WhatsApp link to patient for any service", body: '{ "patientId": "...", "serviceType": "pre_visit_intake", "channel": "sms" }' },
  { method: "POST", path: "/messaging/bulk", tag: "Messaging", dir: "out", desc: "Bulk send links to multiple patients", body: '{ "patientIds": ["..."], "serviceType": "appointment_reminder" }' },
  { method: "GET", path: "/messaging/status/{token}", tag: "Messaging", dir: "out", desc: "Check delivery and open status of a sent link" },
  { method: "POST", path: "/messaging/webhook", tag: "Messaging", dir: "in", desc: "Twilio/Telnyx delivery status webhook" },
  { method: "POST", path: "/voice/call", tag: "Voice", dir: "out", desc: "Trigger outbound AI voice call via Vapi.ai or Retell", body: '{ "patientId": "...", "phoneNumber": "+1...", "serviceType": "pre_visit_intake" }' },
  { method: "POST", path: "/voice/webhook", tag: "Voice", dir: "in", desc: "Call completion webhook with transcript and recording" },
  { method: "GET", path: "/agents", tag: "AI Agents", dir: "out", desc: "List all AI agents with workflow steps and assignments" },
  { method: "POST", path: "/agents/{id}/trigger", tag: "AI Agents", dir: "in", desc: "Manually trigger an agent workflow for a patient", body: '{ "patientId": "...", "context": {...} }' },
];

const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
  GET: { bg: "bg-emerald-500/15", text: "text-emerald-300" },
  POST: { bg: "bg-blue-500/15", text: "text-blue-300" },
  PUT: { bg: "bg-amber-500/15", text: "text-amber-300" },
  DELETE: { bg: "bg-red-500/15", text: "text-red-300" },
};

export default function APIManagementPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [locked, setLocked] = useState(true);
  const [filterTag, setFilterTag] = useState("all");
  const [filterDir, setFilterDir] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/super-admin/settings").then(r => r.json()).then(data => setApiKey(data.settings?.api_secret_key || ""));
  }, []);

  async function generateKey() {
    setGenerating(true);
    const key = `myaidoc_${Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("")}`;
    await fetch("/api/super-admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { api_secret_key: key } }) });
    setApiKey(key); setGenerating(false);
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const filtered = ENDPOINTS.filter(e => (filterTag === "all" || e.tag === filterTag) && (filterDir === "all" || (filterDir === "in" ? e.dir === "in" : e.dir === "out")));

  return (
    <div className="space-y-6 max-w-full lg:max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">API Management</h1>
          <p className="text-sm text-slate-400 mt-1">REST API endpoints, Swagger documentation, and authentication</p>
        </div>
        <div className="flex items-center gap-2">
          <SettingsLock locked={locked} onToggle={() => setLocked(!locked)} />
          <a href={`${baseUrl}/api/v1/openapi.json`} target="_blank" className="btn-secondary text-xs py-1.5"><Code className="w-3 h-3" />OpenAPI JSON</a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Endpoints", value: ENDPOINTS.length, gradient: "from-blue-500 to-indigo-600" },
          { label: "Inbound (webhook)", value: ENDPOINTS.filter(e => e.dir === "in").length, gradient: "from-violet-500 to-purple-600" },
          { label: "Outbound (query)", value: ENDPOINTS.filter(e => e.dir === "out").length, gradient: "from-emerald-500 to-teal-600" },
          { label: "Resource Groups", value: TAGS.length, gradient: "from-amber-500 to-orange-600" },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} ring-2 ring-white/5 flex items-center justify-center shadow-lg`}>
              <span className="text-lg font-bold text-white">{s.value}</span>
            </div>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* API Key */}
      <div className={`card p-5 space-y-3 ${locked ? "opacity-70" : ""}`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-500/20 flex items-center justify-center shadow-md"><Key className="w-3.5 h-3.5 text-white" /></span>
          Authentication
        </div>
        <p className="text-xs text-slate-400">All endpoints require <code className="text-brand-300 bg-midnight-800 px-1.5 py-0.5 rounded text-[11px]">x-api-key</code> header</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input type={showKey ? "text" : "password"} value={apiKey} readOnly placeholder="No API key — click Generate" className="input-field font-mono text-xs" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button onClick={() => setShowKey(!showKey)} className="p-1 text-slate-500 hover:text-slate-300">{showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
              {apiKey && <button onClick={() => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="p-1 text-slate-500 hover:text-slate-300">{copied ? <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}</button>}
            </div>
          </div>
          <button onClick={generateKey} disabled={generating || locked} className="btn-primary py-2 text-xs disabled:opacity-40">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {apiKey ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>

      {/* Resource Tags */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterTag("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterTag === "all" ? "border-brand-500 bg-brand-950/40 text-brand-300" : "border-midnight-700/50 text-slate-500 hover:text-slate-300"}`}>All ({ENDPOINTS.length})</button>
        {TAGS.map(t => {
          const Icon = t.icon;
          const count = ENDPOINTS.filter(e => e.tag === t.id).length;
          return (
            <button key={t.id} onClick={() => setFilterTag(filterTag === t.id ? "all" : t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${filterTag === t.id ? "border-brand-500 bg-brand-950/40 text-brand-300" : "border-midnight-700/50 text-slate-500 hover:text-slate-300"}`}>
              <span className={`w-5 h-5 rounded flex items-center justify-center ${t.bg}`}><Icon className={`w-3 h-3 ${t.color}`} /></span>
              {t.id} <span className="text-slate-600">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Direction filter */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 bg-midnight-900/80 rounded-lg border border-midnight-700/50">
          {[
            { id: "all", label: "All", icon: null },
            { id: "in", label: "Inbound", icon: ArrowDownLeft, color: "text-blue-400" },
            { id: "out", label: "Outbound", icon: ArrowUpRight, color: "text-emerald-400" },
          ].map(d => {
            const Icon = d.icon;
            return (
              <button key={d.id} onClick={() => setFilterDir(d.id)} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all ${filterDir === d.id ? "bg-brand-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                {Icon && <Icon className="w-3 h-3" />}{d.label}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} endpoint{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Endpoints */}
      <div className="space-y-2">
        {filtered.map((ep) => {
          const key = `${ep.method}-${ep.path}`;
          const isExp = expanded === key;
          const ms = METHOD_STYLES[ep.method];
          const tag = TAGS.find(t => t.id === ep.tag);

          return (
            <div key={key} className="card overflow-hidden">
              <button onClick={() => setExpanded(isExp ? null : key)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-midnight-800/20 transition-colors">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${ms.bg} ${ms.text}`}>{ep.method}</span>
                <code className="text-sm text-slate-200 font-mono flex-1 truncate">/api/v1{ep.path}</code>
                <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${ep.dir === "in" ? "bg-blue-500/10 text-blue-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                  {ep.dir === "in" ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                  {ep.dir === "in" ? "Inbound" : "Outbound"}
                </span>
                {tag && <span className={`w-5 h-5 rounded flex items-center justify-center ${tag.bg}`}><tag.icon className={`w-3 h-3 ${tag.color}`} /></span>}
                {isExp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>
              {isExp && (
                <div className="px-4 pb-4 space-y-3 border-t border-midnight-800/30 pt-3">
                  <p className="text-sm text-slate-300">{ep.desc}</p>
                  {ep.params && <p className="text-xs text-slate-500">Query params: <code className="text-brand-300">{ep.params}</code></p>}
                  <div className="rounded-lg bg-midnight-800/60 border border-midnight-700/30 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-midnight-800/80 border-b border-midnight-700/30">
                      <span className="text-[10px] text-slate-500 font-mono">cURL</span>
                      <button onClick={() => { const curl = `curl ${ep.method !== "GET" ? `-X ${ep.method} ` : ""}${baseUrl}/api/v1${ep.path} \\\n  -H "x-api-key: YOUR_KEY" \\\n  -H "Content-Type: application/json"${ep.body ? ` \\\n  -d '${ep.body}'` : ""}`; navigator.clipboard.writeText(curl); }} className="text-[10px] text-slate-500 hover:text-brand-400 flex items-center gap-1"><Copy className="w-2.5 h-2.5" />Copy</button>
                    </div>
                    <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto">
{`curl ${ep.method !== "GET" ? `-X ${ep.method} ` : ""}${baseUrl}/api/v1${ep.path} \\
  -H "x-api-key: ${showKey && apiKey ? apiKey : "YOUR_KEY"}" \\
  -H "Content-Type: application/json"${ep.body ? ` \\
  -d '${ep.body}'` : ""}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

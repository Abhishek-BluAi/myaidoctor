"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings, Save, Loader2, Shield, UserPlus, Clock, Bell, Mail, Send,
  CheckCircle2, AlertCircle, Phone, Brain, Key, Globe, Lock, Zap, Unlock, Database,
  Stethoscope, ChevronDown, ChevronUp, Plus, Trash2, Edit2,
} from "lucide-react";
import { ConfirmDialog, SettingsLock } from "@/components/ConfirmDialog";
import { ServiceIcon } from "@/components/ServiceIcon";

const BUILTIN_SERVICES = [
  { id: "pre_visit_intake", name: "Pre-Visit Intake", description: "Complete pre-visit questionnaire before appointment", builtin: true },
  { id: "appointment_reminder", name: "Appointment Reminder", description: "Confirm upcoming appointment attendance", builtin: true },
  { id: "refill_manager", name: "Medication Refill", description: "Request prescription refill from provider", builtin: true },
  { id: "schedule_assistant", name: "Schedule / Reschedule", description: "Book, change, or cancel appointments", builtin: true },
  { id: "referral_coordinator", name: "Referral Coordinator", description: "Process specialist referral request", builtin: true },
  { id: "post_visit_followup", name: "Post-Visit Follow-Up", description: "Check on recovery after visit", builtin: true },
  { id: "lab_results_review", name: "Lab Results Review", description: "Walk through lab results with patient", builtin: true },
  { id: "new_patient_onboarding", name: "New Patient Onboarding", description: "Collect medical history and registration", builtin: true },
  { id: "chronic_disease_checkin", name: "Chronic Disease Check-In", description: "Monthly chronic condition monitoring", builtin: true },
  { id: "appointment_scheduler", name: "Appointment Scheduler", description: "Schedule a new appointment", builtin: true },
];

const TABS = [
  { id: "platform", label: "Platform", icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "ai", label: "AI Services", icon: Brain, color: "text-violet-400", bg: "bg-violet-500/10" },
  { id: "voice", label: "Voice AI", icon: Phone, color: "text-rose-400", bg: "bg-rose-500/10" },
  { id: "messaging", label: "SMS / Messaging", icon: Send, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { id: "email", label: "Email / SMTP", icon: Mail, color: "text-amber-400", bg: "bg-amber-500/10" },
  { id: "emr", label: "EMR / FHIR / HL7", icon: Database, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { id: "hipaa", label: "HIPAA", icon: Shield, color: "text-red-400", bg: "bg-red-500/10" },
  { id: "protocols", label: "Clinical Protocols", icon: Stethoscope, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { id: "services", label: "Patient Services", icon: Zap, color: "text-rose-400", bg: "bg-rose-500/10" },
  { id: "security", label: "Security", icon: Lock, color: "text-emerald-400", bg: "bg-emerald-500/10" },
];

export default function SettingsPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("platform");
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [locked, setLocked] = useState(true);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [expandedProtocol, setExpandedProtocol] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [showNewService, setShowNewService] = useState(false);
  const [newService, setNewService] = useState({ name: "", id: "", description: "", type: "standalone", includes: [] as string[] });
  const [editingService, setEditingService] = useState<string | null>(null);

  const searchParams = useSearchParams();

  // React to URL tab changes from sidebar clicks
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && TABS.some(t => t.id === urlTab)) setTab(urlTab);
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/super-admin/settings").then(r => r.json()),
      fetch("/api/super-admin/protocols").then(r => r.json()).catch(() => ({ protocols: [] })),
      fetch("/api/super-admin/services").then(r => r.json()).catch(() => ({ services: [] })),
    ]).then(([sData, pData, svData]) => {
      setSettings(sData.settings || {});
      setProtocols(pData.protocols || []);
      setServices(svData.services || []);
    }).finally(() => setLoading(false));
  }, []);

  function update(key, value) { setSettings(s => ({ ...s, [key]: value })); }

  async function handleSave() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/super-admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    setMsg(res.ok ? "Settings saved" : "Failed to save");
    setSaving(false); setTimeout(() => setMsg(""), 3000);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{TABS.find(t => t.id === tab)?.label || "Settings"}</h1>
          <p className="text-sm text-slate-400 mt-1">Configure platform, AI services, voice, email, and security</p>
        </div>
        <div className="flex items-center gap-3">
          <SettingsLock locked={locked} onToggle={() => setLocked(!locked)} />
          <button onClick={() => locked ? null : setShowSaveConfirm(true)} disabled={saving || locked}
            className="btn-primary py-2.5 px-6 disabled:opacity-40 disabled:cursor-not-allowed">
            {locked ? <Lock className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {locked ? "Locked" : "Save All Settings"}
          </button>
        </div>
      </div>

      {msg && <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300"><CheckCircle2 className="w-4 h-4" />{msg}</div>}

      {/* Tab content — tab selection handled by sidebar */}

      {/* ── Platform ───────────────────────────────────────── */}
      {tab === "platform" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><UserPlus className="w-4 h-4 text-emerald-400" />Registration</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Registration Mode</label>
              <select value={settings.registration_mode || "open"} onChange={e => update("registration_mode", e.target.value)} className="input-field">
                <option value="open">Open (anyone can register)</option>
                <option value="approval">Approval Required</option>
                <option value="invite">Invite Only</option>
              </select></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Default Role for New Users</label>
              <select value={settings.default_role || "PROVIDER"} onChange={e => update("default_role", e.target.value)} className="input-field">
                <option value="PROVIDER">Provider</option><option value="NURSE">Nurse</option>
                <option value="FRONT_DESK">Front Desk</option><option value="BILLING">Billing</option>
              </select></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Clock className="w-4 h-4 text-blue-400" />Sessions</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Session Timeout (minutes)</label>
              <input type="number" value={settings.session_timeout_minutes || 30} onChange={e => update("session_timeout_minutes", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Max Login Attempts</label>
              <input type="number" value={settings.max_login_attempts || 5} onChange={e => update("max_login_attempts", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Lockout Duration (minutes)</label>
              <input type="number" value={settings.lockout_duration_minutes || 15} onChange={e => update("lockout_duration_minutes", e.target.value)} className="input-field" /></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Bell className="w-4 h-4 text-amber-400" />Notifications</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Send Welcome Email</label>
              <select value={settings.send_welcome_email || "true"} onChange={e => update("send_welcome_email", e.target.value)} className="input-field">
                <option value="true">Yes</option><option value="false">No</option>
              </select></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Notify Admin on Registration</label>
              <select value={settings.notify_admin_registration || "true"} onChange={e => update("notify_admin_registration", e.target.value)} className="input-field">
                <option value="true">Yes</option><option value="false">No</option>
              </select></div>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Services ────────────────────────────────────── */}
      {tab === "ai" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Brain className="w-4 h-4 text-violet-400" />AI Provider for SOAP Notes & Clinical Analysis</div>
            <p className="text-xs text-slate-500">This AI service powers SOAP note generation, differential diagnosis, red flag analysis, and clinical reasoning across all AI Agents.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: "claude", name: "Anthropic Claude", desc: "Best for clinical reasoning and structured output", models: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-5-haiku-20241022"] },
                { id: "openai", name: "OpenAI GPT-4", desc: "Versatile, good function calling", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
                { id: "gemini", name: "Google Gemini", desc: "Competitive pricing, long context", models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
              ].map(p => (
                <button key={p.id} onClick={() => update("ai_provider", p.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    (settings.ai_provider || "claude") === p.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/50 hover:border-midnight-600"
                  }`}>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Key className="w-4 h-4 text-amber-400" />API Configuration</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">API Key</label>
              <input type="password" value={settings.ai_api_key || ""} onChange={e => update("ai_api_key", e.target.value)}
                placeholder={`${(settings.ai_provider || "claude") === "claude" ? "sk-ant-..." : (settings.ai_provider || "claude") === "openai" ? "sk-..." : "AIza..."}`} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Model</label>
              <select value={settings.ai_model || ""} onChange={e => update("ai_model", e.target.value)} className="input-field">
                <option value="">Default for provider</option>
                {(settings.ai_provider || "claude") === "claude" && <><option value="claude-3-5-sonnet-20241022">Claude Sonnet 4</option><option value="claude-3-opus-20240229">Claude Opus 4</option><option value="claude-3-5-haiku-20241022">Claude Haiku 4</option></>}
                {settings.ai_provider === "openai" && <><option value="gpt-4o">GPT-4o</option><option value="gpt-4o-mini">GPT-4o Mini</option></>}
                {settings.ai_provider === "gemini" && <><option value="gemini-2.5-pro">Gemini 2.5 Pro</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option></>}
              </select></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Temperature</label>
              <input type="number" step="0.1" min="0" max="2" value={settings.ai_temperature || "0.3"} onChange={e => update("ai_temperature", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Max Tokens</label>
              <input type="number" value={settings.ai_max_tokens || "4000"} onChange={e => update("ai_max_tokens", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Fallback Mode</label>
              <select value={settings.ai_fallback || "template"} onChange={e => update("ai_fallback", e.target.value)} className="input-field">
                <option value="template">Template (no API call)</option>
                <option value="error">Fail with error</option>
              </select></div>
            </div>
            <div className="p-3 rounded-lg bg-midnight-800/50 text-xs text-slate-400">
              <strong className="text-slate-300">How it works:</strong> When an AI Agent step generates a SOAP note or clinical analysis, it uses this provider. If no API key is configured or the call fails, it falls back to the template engine (rule-based output).
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Zap className="w-4 h-4 text-yellow-400" />AI Agent Defaults</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Default Call Retry Attempts</label>
              <input type="number" value={settings.agent_default_retries || "3"} onChange={e => update("agent_default_retries", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Retry Interval (minutes)</label>
              <input type="number" value={settings.agent_default_retry_interval || "60"} onChange={e => update("agent_default_retry_interval", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">SMS Fallback</label>
              <select value={settings.agent_sms_fallback || "true"} onChange={e => update("agent_sms_fallback", e.target.value)} className="input-field">
                <option value="true">Enabled (send intake link after max retries)</option>
                <option value="false">Disabled</option>
              </select></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Voice AI ───────────────────────────────────────── */}
      {tab === "voice" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Phone className="w-4 h-4 text-rose-400" />Voice Call Provider</div>
            <p className="text-xs text-slate-500">Powers the "Call Me" option in the patient portal. Patients receive an AI phone call that conducts the pre-visit intake.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "vapi", name: "Vapi.ai", cost: "$0.05/min", desc: "Cheapest. All-in-one voice AI.", url: "vapi.ai" },
                { id: "retell", name: "Retell AI", cost: "$0.07-0.10/min", desc: "Full-featured voice agent.", url: "retellai.com" },
              ].map(p => (
                <button key={p.id} onClick={() => update("voice_provider", p.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${(settings.voice_provider || "vapi") === p.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/50 hover:border-midnight-600"}`}>
                  <div className="flex items-center justify-between"><span className="text-sm font-medium text-white">{p.name}</span><span className="text-[10px] text-brand-400">{p.cost}</span></div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.desc} · {p.url}</p>
                </button>
              ))}
            </div>
          </div>

          {(settings.voice_provider || "vapi") === "vapi" && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">Vapi.ai Configuration</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Vapi API Key</label>
                <input type="password" value={settings.voice_api_key || ""} onChange={e => update("voice_api_key", e.target.value)} placeholder="vapi_..." className="input-field" /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Phone Number ID</label>
                <input value={settings.voice_phone_number || ""} onChange={e => update("voice_phone_number", e.target.value)} placeholder="Phone number ID from Vapi dashboard" className="input-field" /></div>
              </div>
              <div className="p-3 rounded-lg bg-midnight-800/50 text-xs text-slate-400">
                <strong className="text-slate-300">Setup:</strong> 1) Sign up at <span className="text-brand-400">vapi.ai</span> 2) Get API key from Settings 3) Buy a phone number ($1-2/mo) 4) Set webhook URL:<br/>
                <span className="text-brand-400 font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/api/voice-call</span>
              </div>
            </div>
          )}

          {settings.voice_provider === "retell" && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">Retell AI Configuration</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Retell API Key</label>
                <input type="password" value={settings.voice_ai_retell_api_key || ""} onChange={e => update("voice_ai_retell_api_key", e.target.value)} placeholder="key_..." className="input-field" /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Agent ID</label>
                <input value={settings.voice_ai_retell_agent_id || ""} onChange={e => update("voice_ai_retell_agent_id", e.target.value)} placeholder="agent_..." className="input-field" /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Webhook Secret</label>
                <input type="password" value={settings.voice_ai_retell_webhook_secret || ""} onChange={e => update("voice_ai_retell_webhook_secret", e.target.value)} placeholder="whsec_..." className="input-field" /></div>
              </div>
              <div className="p-3 rounded-lg bg-midnight-800/50 text-xs text-slate-400">
                <strong className="text-slate-300">Setup:</strong> 1) Sign up at <span className="text-brand-400">retellai.com</span> 2) Create an agent 3) Set webhook URL:<br/>
                <span className="text-brand-400 font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/api/voice-call</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SMS / Messaging ────────────────────────────────── */}
      {tab === "messaging" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Send className="w-4 h-4 text-teal-400" />SMS Provider</div>
            <p className="text-xs text-slate-500">Powers SMS links sent to patients for pre-visit intake, refills, scheduling, and other services.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "twilio", name: "Twilio", cost: "$0.0079/SMS", desc: "Most popular. Reliable.", url: "twilio.com/try-twilio" },
                { id: "telnyx", name: "Telnyx", cost: "$0.004/SMS", desc: "Cheapest per message.", url: "telnyx.com" },
              ].map(p => (
                <button key={p.id} onClick={() => update("sms_provider", p.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${(settings.sms_provider || "") === p.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/50 hover:border-midnight-600"}`}>
                  <div className="flex items-center justify-between"><span className="text-sm font-medium text-white">{p.name}</span><span className="text-[10px] text-brand-400">{p.cost}</span></div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {(settings.sms_provider || "") === "twilio" && (
            <div className="card p-5 space-y-4">
              <div className="text-sm font-semibold text-white">Twilio Configuration</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Account SID</label>
                <input value={settings.twilio_account_sid || ""} onChange={e => update("twilio_account_sid", e.target.value)} placeholder="AC..." className="input-field" /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Auth Token</label>
                <input type="password" value={settings.twilio_auth_token || ""} onChange={e => update("twilio_auth_token", e.target.value)} placeholder="Token" className="input-field" /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Phone Number</label>
                <input value={settings.twilio_phone_number || ""} onChange={e => update("twilio_phone_number", e.target.value)} placeholder="+1234567890" className="input-field" /></div>
              </div>
            </div>
          )}

          {settings.sms_provider === "telnyx" && (
            <div className="card p-5 space-y-4">
              <div className="text-sm font-semibold text-white">Telnyx Configuration</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">API Key</label>
                <input type="password" value={settings.telnyx_api_key || ""} onChange={e => update("telnyx_api_key", e.target.value)} placeholder="KEY_..." className="input-field" /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Phone Number</label>
                <input value={settings.telnyx_phone_number || ""} onChange={e => update("telnyx_phone_number", e.target.value)} placeholder="+1234567890" className="input-field" /></div>
              </div>
            </div>
          )}

          {!(settings.sms_provider) && (
            <div className="p-3 rounded-lg bg-midnight-800/50 text-xs text-slate-400">
              <strong className="text-slate-300">No provider selected.</strong> SMS links will be logged to the server console instead of sent. Select a provider above and enter credentials to enable real SMS delivery.
            </div>
          )}
        </div>
      )}

      {/* ── Email / SMTP ───────────────────────────────────── */}
      {tab === "email" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Mail className="w-4 h-4 text-cyan-400" />SMTP Server</div>
            <p className="text-xs text-slate-500">Configure SMTP for sending emails. Leave blank to log emails to the console.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">SMTP Host</label>
              <input value={settings.smtp_host || ""} onChange={e => update("smtp_host", e.target.value)} placeholder="smtp.gmail.com" className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Port</label>
              <input type="number" value={settings.smtp_port || ""} onChange={e => update("smtp_port", e.target.value)} placeholder="587" className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Encryption</label>
              <select value={settings.smtp_secure || "false"} onChange={e => update("smtp_secure", e.target.value)} className="input-field">
                <option value="false">STARTTLS (port 587)</option>
                <option value="true">SSL/TLS (port 465)</option>
              </select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Username</label>
              <input value={settings.smtp_user || ""} onChange={e => update("smtp_user", e.target.value)} placeholder="noreply@myaidoctor.io" className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Password</label>
              <input type="password" value={settings.smtp_pass || ""} onChange={e => update("smtp_pass", e.target.value)} placeholder="App password" className="input-field" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">From Name</label>
              <input value={settings.smtp_from_name || ""} onChange={e => update("smtp_from_name", e.target.value)} placeholder="MyAIDoctor.io" className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">From Email</label>
              <input value={settings.smtp_from_email || ""} onChange={e => update("smtp_from_email", e.target.value)} placeholder="noreply@myaidoctor.io" className="input-field" /></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Send className="w-4 h-4 text-teal-400" />Test Email</div>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Recipient</label>
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" className="input-field" />
              </div>
              <button onClick={async () => {
                if (!testEmail) return; setTesting(true); setTestResult(null);
                await fetch("/api/super-admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) });
                const res = await fetch("/api/super-admin/email-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: testEmail }) });
                const data = await res.json(); setTestResult(data); setTesting(false);
              }} disabled={testing || !testEmail} className="btn-primary py-2 disabled:opacity-50">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Test
              </button>
            </div>
            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success ? "bg-brand-950/50 border border-brand-800/40 text-brand-300" : "bg-red-950/50 border border-red-800/50 text-red-300"}`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{testResult.message}
              </div>
            )}
            <div className="p-3 rounded-lg bg-midnight-800/50 text-[11px] text-slate-500">
              <strong className="text-slate-400">Quick setup:</strong> Gmail: smtp.gmail.com:587, use App Password · Outlook: smtp.office365.com:587 · SendGrid: smtp.sendgrid.net:587, user=apikey
            </div>
          </div>
        </div>
      )}

      {/* ── EMR / FHIR / HL7 ──────────────────────────────── */}
      {tab === "emr" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Database className="w-4 h-4 text-cyan-400" />EMR System</div>
            <p className="text-xs text-slate-500">Connect to an external EMR/HMS for bi-directional patient data sync.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { id: "bluhealth", name: "BluHealth (BluAI)", desc: "BluAI Health Platform" },
                { id: "epic", name: "Epic / MyChart", desc: "Epic FHIR R4 API" },
                { id: "cerner", name: "Cerner / Oracle", desc: "Oracle Health FHIR" },
                { id: "athena", name: "athenahealth", desc: "athenaNet API" },
                { id: "eclinicalworks", name: "eClinicalWorks", desc: "eCW FHIR / HL7" },
                { id: "custom", name: "Custom EMR", desc: "Any FHIR R4 / HL7 system" },
              ].map(e => (
                <button key={e.id} onClick={() => update("emr_system", e.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${(settings.emr_system || "bluhealth") === e.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/50 hover:border-midnight-600"}`}>
                  <p className="text-xs font-medium text-white">{e.name}</p>
                  <p className="text-[10px] text-slate-500">{e.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* FHIR R4 Configuration */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Zap className="w-4 h-4 text-cyan-400" />FHIR R4 Configuration</div>
            <p className="text-xs text-slate-500">Fast Healthcare Interoperability Resources — RESTful API standard for exchanging healthcare data. Supports Patient, Encounter, Observation, Condition, MedicationRequest, AllergyIntolerance, and DiagnosticReport resources.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Mode</label>
              <select value={settings.emr_mode || "mock"} onChange={e => update("emr_mode", e.target.value)} className="input-field">
                <option value="mock">Mock (simulated responses for testing)</option>
                <option value="sandbox">Sandbox (EMR test environment)</option>
                <option value="live">Live (production FHIR endpoint)</option>
              </select></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">FHIR R4 Base URL</label>
              <input value={settings.emr_fhir_url || ""} onChange={e => update("emr_fhir_url", e.target.value)} placeholder="https://fhir.example.com/r4" className="input-field" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Client ID</label>
              <input value={settings.emr_client_id || ""} onChange={e => update("emr_client_id", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Client Secret</label>
              <input type="password" value={settings.emr_client_secret || ""} onChange={e => update("emr_client_secret", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Bearer Token / API Key</label>
              <input type="password" value={settings.emr_api_key || ""} onChange={e => update("emr_api_key", e.target.value)} className="input-field" /></div>
            </div>
            <div className="p-3 rounded-lg bg-midnight-800/50 text-xs text-slate-400 space-y-1">
              <p className="text-slate-300 font-medium">Supported FHIR R4 Resources:</p>
              <p>Patient, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance, DiagnosticReport, DocumentReference, Practitioner, Organization, Appointment, ServiceRequest (Referrals)</p>
            </div>
          </div>

          {/* HL7 v2 Configuration */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Database className="w-4 h-4 text-amber-400" />HL7 v2 Integration</div>
            <p className="text-xs text-slate-500">Health Level Seven v2.x — message-based integration for legacy EMR systems. Supports ADT (Admit/Discharge/Transfer), ORM (Orders), ORU (Results), SIU (Scheduling), and MDM (Documents).</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">HL7 Interface Engine</label>
              <select value={settings.hl7_engine || "none"} onChange={e => update("hl7_engine", e.target.value)} className="input-field">
                <option value="none">Not Configured</option>
                <option value="mirth">Mirth Connect / NextGen</option>
                <option value="rhapsody">Rhapsody</option>
                <option value="cloverleaf">Infor Cloverleaf</option>
                <option value="custom">Custom TCP/MLLP Listener</option>
              </select></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">HL7 Listener Host:Port</label>
              <input value={settings.hl7_endpoint || ""} onChange={e => update("hl7_endpoint", e.target.value)} placeholder="10.0.1.50:2575" className="input-field" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: "hl7_adt", label: "ADT", desc: "Admit/Discharge/Transfer" },
                { id: "hl7_orm", label: "ORM", desc: "Orders" },
                { id: "hl7_oru", label: "ORU", desc: "Results" },
                { id: "hl7_siu", label: "SIU", desc: "Scheduling" },
                { id: "hl7_mdm", label: "MDM", desc: "Documents" },
                { id: "hl7_dft", label: "DFT", desc: "Charges/Billing" },
              ].map(m => (
                <label key={m.id} className="flex items-center gap-2 p-2 rounded-lg border border-midnight-700/40 text-xs cursor-pointer hover:bg-midnight-800/30">
                  <input type="checkbox" checked={settings[m.id] === "true"} onChange={e => update(m.id, e.target.checked ? "true" : "false")} className="rounded border-slate-600" />
                  <div><span className="text-white font-medium">{m.label}</span><span className="text-slate-500 ml-1">— {m.desc}</span></div>
                </label>
              ))}
            </div>
          </div>

          {/* Sync Settings */}
          <div className="card p-5 space-y-4">
            <div className="text-sm font-semibold text-white">Sync Direction & Scheduling</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: "pull_only", label: "Inbound Only", desc: "Pull from EMR into MyAIDoctor" },
                { id: "push_only", label: "Outbound Only", desc: "Push from MyAIDoctor to EMR" },
                { id: "bidirectional", label: "Bi-Directional", desc: "Full two-way sync with conflict resolution" },
              ].map(d => (
                <button key={d.id} onClick={() => update("emr_sync_direction", d.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${(settings.emr_sync_direction || "bidirectional") === d.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/50"}`}>
                  <p className="text-xs font-medium text-white">{d.label}</p>
                  <p className="text-[10px] text-slate-500">{d.desc}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Auto-Sync Frequency</label>
              <select value={settings.emr_sync_freq || "manual"} onChange={e => update("emr_sync_freq", e.target.value)} className="input-field">
                <option value="manual">Manual only</option>
                <option value="15min">Every 15 minutes</option>
                <option value="1hr">Every hour</option>
                <option value="4hr">Every 4 hours</option>
                <option value="daily">Once daily</option>
              </select></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Conflict Resolution</label>
              <select value={settings.emr_conflict || "ask"} onChange={e => update("emr_conflict", e.target.value)} className="input-field">
                <option value="ask">Ask user (compare side-by-side)</option>
                <option value="emr_wins">EMR always wins</option>
                <option value="local_wins">MyAIDoctor always wins</option>
                <option value="newest">Most recent update wins</option>
              </select></div>
            </div>
          </div>
        </div>
      )}

      {/* ── HIPAA ───────────────────────────────────────────── */}
      {tab === "hipaa" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Shield className="w-4 h-4 text-red-400" />HIPAA Compliance Settings</div>
            <p className="text-xs text-slate-500">Health Insurance Portability and Accountability Act — configure privacy, security, and breach notification requirements for Protected Health Information (PHI).</p>
          </div>

          {/* Privacy Rule */}
          <div className="card p-5 space-y-4">
            <div className="text-sm font-semibold text-white">Privacy Rule (45 CFR §164.500–534)</div>
            <p className="text-xs text-slate-500">Controls who can access, use, and disclose PHI. Defines patient rights to their health information.</p>
            <div className="space-y-3">
              {[
                { id: "hipaa_consent_required", label: "Require patient consent before AI intake", desc: "Patient must confirm HIPAA acknowledgment before any data collection begins" },
                { id: "hipaa_min_necessary", label: "Minimum Necessary Rule enforcement", desc: "Limit data collection to only what is needed for the specific service" },
                { id: "hipaa_patient_access", label: "Patient access to records", desc: "Allow patients to view, download, and request corrections to their health data" },
                { id: "hipaa_accounting_disclosures", label: "Track all PHI disclosures", desc: "Log every instance of PHI shared with third parties (EMR sync, referrals, etc.)" },
              ].map(r => (
                <label key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-midnight-700/40 cursor-pointer hover:bg-midnight-800/20">
                  <input type="checkbox" checked={settings[r.id] !== "false"} onChange={e => update(r.id, e.target.checked ? "true" : "false")} className="rounded border-slate-600 mt-0.5" />
                  <div><p className="text-xs font-medium text-white">{r.label}</p><p className="text-[10px] text-slate-500">{r.desc}</p></div>
                </label>
              ))}
            </div>
          </div>

          {/* Security Rule */}
          <div className="card p-5 space-y-4">
            <div className="text-sm font-semibold text-white">Security Rule (45 CFR §164.302–318)</div>
            <p className="text-xs text-slate-500">Technical, physical, and administrative safeguards to protect electronic PHI (ePHI).</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "hipaa_encryption_transit", label: "Encryption in Transit (TLS 1.2+)", desc: "All API calls and data transfers use HTTPS/TLS", default: true },
                { id: "hipaa_encryption_rest", label: "Encryption at Rest (AES-256)", desc: "Database and file storage encryption", default: true },
                { id: "hipaa_access_controls", label: "Role-Based Access Controls (RBAC)", desc: "Users can only access data authorized for their role", default: true },
                { id: "hipaa_audit_logging", label: "Audit Logging (all PHI access)", desc: "Every access to patient data is logged with user, timestamp, and action", default: true },
                { id: "hipaa_auto_logout", label: "Automatic Session Timeout", desc: "Sessions expire after inactivity period" },
                { id: "hipaa_mfa_option", label: "Multi-Factor Authentication Available", desc: "MFA option for all user accounts" },
              ].map(r => (
                <label key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-midnight-700/40 cursor-pointer hover:bg-midnight-800/20">
                  <input type="checkbox" checked={settings[r.id] !== "false"} onChange={e => update(r.id, e.target.checked ? "true" : "false")} className="rounded border-slate-600 mt-0.5" />
                  <div><p className="text-xs font-medium text-white">{r.label}</p><p className="text-[10px] text-slate-500">{r.desc}</p></div>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Session Timeout (minutes)</label>
              <input type="number" value={settings.hipaa_session_timeout || "30"} onChange={e => update("hipaa_session_timeout", e.target.value)} className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Failed Login Lockout (attempts)</label>
              <input type="number" value={settings.hipaa_lockout_attempts || "5"} onChange={e => update("hipaa_lockout_attempts", e.target.value)} className="input-field" /></div>
            </div>
          </div>

          {/* Breach Notification Rule */}
          <div className="card p-5 space-y-4">
            <div className="text-sm font-semibold text-white">Breach Notification Rule (45 CFR §164.400–414)</div>
            <p className="text-xs text-slate-500">Requirements for notifying affected individuals, HHS, and media in the event of a PHI breach.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Privacy Officer Name</label>
              <input value={settings.hipaa_privacy_officer || ""} onChange={e => update("hipaa_privacy_officer", e.target.value)} placeholder="Jane Smith, CHPS" className="input-field" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Privacy Officer Email</label>
              <input value={settings.hipaa_privacy_email || ""} onChange={e => update("hipaa_privacy_email", e.target.value)} placeholder="privacy@myaidoctor.io" className="input-field" /></div>
            </div>
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-800/20 text-xs text-slate-400 space-y-1">
              <p className="text-red-300 font-medium">Breach Notification Requirements:</p>
              <p>Individual notice: Within 60 days of discovery for breaches affecting 1+ individuals</p>
              <p>HHS notification: Within 60 days if 500+ individuals affected; annually for smaller breaches</p>
              <p>Media notice: Required if 500+ individuals in a single state are affected</p>
            </div>
          </div>

          {/* BAA */}
          <div className="card p-5 space-y-4">
            <div className="text-sm font-semibold text-white">Business Associate Agreements (BAA)</div>
            <p className="text-xs text-slate-500">Track BAA status with all third-party vendors who handle PHI.</p>
            <div className="space-y-2">
              {[
                { vendor: "Anthropic (Claude AI)", status: settings.baa_anthropic || "pending" },
                { vendor: "Telnyx (SMS/Voice)", status: settings.baa_telnyx || "pending" },
                { vendor: "Vapi.ai (Voice AI)", status: settings.baa_vapi || "pending" },
                { vendor: "PostgreSQL Hosting Provider", status: settings.baa_database || "pending" },
                { vendor: "EMR Integration Vendor", status: settings.baa_emr || "pending" },
              ].map((b, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-midnight-700/40">
                  <p className="text-xs text-white">{b.vendor}</p>
                  <select value={b.status} onChange={e => update(`baa_${b.vendor.split(" ")[0].toLowerCase()}`, e.target.value)} className="input-field w-40 text-xs">
                    <option value="pending">Pending</option>
                    <option value="requested">Requested</option>
                    <option value="signed">Signed</option>
                    <option value="not_required">Not Required</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Clinical Protocols ─────────────────────────────── */}
      {tab === "protocols" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{protocols.length} Active Clinical Protocols</p>
              <p className="text-xs text-slate-500">These protocols drive patient conversations, screening instruments, and intake flows across all services.</p>
            </div>
          </div>
          <div className="space-y-2">
            {protocols.map((p: any) => {
              const isExp = expandedProtocol === p.id;
              const catColors: Record<string, string> = {
                "Endocrine": "from-amber-500 to-orange-600", "Cardiovascular": "from-red-500 to-rose-600", "Cardiac": "from-red-500 to-rose-600",
                "Respiratory": "from-blue-500 to-indigo-600", "Respiratory/Cardiac": "from-violet-500 to-purple-600",
                "General": "from-slate-500 to-slate-600", "Mental Health": "from-purple-500 to-violet-600",
                "Substance Use": "from-amber-500 to-yellow-600", "Medications": "from-cyan-500 to-teal-600",
                "Preventive": "from-emerald-500 to-teal-600", "Geriatric": "from-blue-500 to-indigo-600",
                "Emergency": "from-red-600 to-red-700", "Social": "from-teal-500 to-emerald-600",
              };
              const gradient = catColors[p.category] || "from-brand-500 to-brand-700";
              return (
                <div key={p.id} className="card overflow-hidden">
                  <button onClick={() => setExpandedProtocol(isExp ? null : p.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-midnight-800/20 transition-colors">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} ring-2 ring-white/5 flex items-center justify-center shadow-lg`}>
                      <Stethoscope className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.category}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Active</span>
                    {isExp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {isExp && (
                    <div className="px-4 pb-4 space-y-3 border-t border-midnight-800/30 pt-3">
                      <p className="text-sm text-slate-300">{p.description}</p>
                      {p.criteria && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-400">Criteria / Triggers</p>
                          <div className="p-3 rounded-lg bg-midnight-800/40 text-xs text-slate-300 font-mono whitespace-pre-wrap">{JSON.stringify(p.criteria, null, 2)}</div>
                        </div>
                      )}
                      {p.actions && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-400">Actions / Workflow</p>
                          <div className="p-3 rounded-lg bg-midnight-800/40 text-xs text-slate-300 font-mono whitespace-pre-wrap">{JSON.stringify(p.actions, null, 2)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {protocols.length === 0 && <div className="card p-8 text-center text-slate-500">No protocols found. Run the seed script to populate.</div>}
          </div>
        </div>
      )}

      {/* ── Patient Services ──────────────────────────────── */}
      {tab === "services" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Patient Messaging Services</p>
              <p className="text-xs text-slate-500">Built-in services + custom services available for patient messaging, QR codes, and agentic AI</p>
            </div>
            <button onClick={() => setShowNewService(true)} className="btn-primary text-xs py-1.5"><Plus className="w-3 h-3" />Create Service</button>
          </div>

          {/* New Service Form */}
          {showNewService && (
            <div className="card p-5 space-y-4 border border-brand-700/30">
              <h3 className="text-sm font-semibold text-white">Create New Service</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Service Name *</label>
                <input value={newService.name} onChange={e => setNewService({...newService, name: e.target.value, id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_")})} placeholder="e.g., Annual Wellness Check" className="input-field" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Service ID (auto-generated)</label>
                <input value={newService.id} readOnly className="input-field text-slate-500" /></div>
              </div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Description</label>
              <input value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} placeholder="What this service does for the patient" className="input-field" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Type</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "standalone", label: "Standalone", desc: "Independent service with its own flow" },
                  { id: "combination", label: "Combination", desc: "Bundles multiple existing services in sequence" },
                ].map(t => (
                  <button key={t.id} onClick={() => setNewService({...newService, type: t.id, includes: []})}
                    className={`flex-1 p-3 rounded-lg border text-left transition-all ${newService.type === t.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/50"}`}>
                    <p className="text-xs font-medium text-white">{t.label}</p>
                    <p className="text-[10px] text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div></div>

              {newService.type === "combination" && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Select services to include (executed in order):</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUILTIN_SERVICES.map(s => {
                      const included = newService.includes.includes(s.id);
                      return (
                        <button key={s.id} onClick={() => setNewService({...newService, includes: included ? newService.includes.filter(i => i !== s.id) : [...newService.includes, s.id]})}
                          className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all text-[11px] ${included ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/40"}`}>
                          <ServiceIcon type={s.id} size="sm" />
                          <div className="flex-1"><p className="text-white">{s.name}</p></div>
                          {included && <span className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center text-[9px] font-bold text-white">{newService.includes.indexOf(s.id) + 1}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {newService.includes.length > 0 && (
                    <p className="text-[10px] text-slate-500">Order: {newService.includes.map((id, i) => `${i + 1}. ${BUILTIN_SERVICES.find(s => s.id === id)?.name}`).join(" → ")}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={async () => {
                  await fetch("/api/super-admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", service: newService }) });
                  const res = await fetch("/api/super-admin/services"); setServices((await res.json()).services || []);
                  setShowNewService(false); setNewService({ name: "", id: "", description: "", type: "standalone", includes: [] });
                }} disabled={!newService.name} className="btn-primary py-2 text-xs disabled:opacity-40"><Plus className="w-3 h-3" />Create</button>
                <button onClick={() => setShowNewService(false)} className="btn-secondary py-2 text-xs">Cancel</button>
              </div>
            </div>
          )}

          {/* Built-in Services */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Built-in Services ({BUILTIN_SERVICES.length})</p>
            {BUILTIN_SERVICES.map(s => (
              <div key={s.id} className="card px-4 py-3 flex items-center gap-3">
                <ServiceIcon type={s.id} size="sm" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{s.name}</p><p className="text-[10px] text-slate-500">{s.description}</p></div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Built-in</span>
                <span className="text-[10px] text-slate-600 font-mono">{s.id}</span>
              </div>
            ))}
          </div>

          {/* Custom Services */}
          {services.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Custom Services ({services.length})</p>
              {services.map((s: any) => (
                <div key={s.id} className="card px-4 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 ring-2 ring-rose-500/20 flex items-center justify-center shadow-md"><Zap className="w-3.5 h-3.5 text-white" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <p className="text-[10px] text-slate-500">{s.description}</p>
                    {s.type === "combination" && s.includes?.length > 0 && (
                      <p className="text-[10px] text-brand-400 mt-0.5">Includes: {s.includes.map((id: string) => BUILTIN_SERVICES.find(b => b.id === id)?.name).filter(Boolean).join(" → ")}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${s.type === "combination" ? "bg-violet-500/15 text-violet-300 border border-violet-500/20" : "bg-blue-500/15 text-blue-300 border border-blue-500/20"}`}>{s.type === "combination" ? "Combo" : "Custom"}</span>
                  <button onClick={async () => {
                    await fetch("/api/super-admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", serviceId: s.serviceId || s.id }) });
                    const res = await fetch("/api/super-admin/services"); setServices((await res.json()).services || []);
                  }} className="p-1.5 text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Security ───────────────────────────────────────── */}
      {tab === "security" && (
        <div className={`space-y-5 ${locked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Shield className="w-4 h-4 text-emerald-400" />Authentication</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">MFA Default</label>
              <select value={settings.mfa_default || "required"} onChange={e => update("mfa_default", e.target.value)} className="input-field">
                <option value="required">Required for all new users</option>
                <option value="optional">Optional (user can skip)</option>
              </select></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Password Min Length</label>
              <input type="number" value={settings.password_min_length || 8} onChange={e => update("password_min_length", e.target.value)} className="input-field" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Password Expiry (days)</label>
              <input type="number" value={settings.password_expiry_days || 90} onChange={e => update("password_expiry_days", e.target.value)} className="input-field" />
              <p className="text-[10px] text-slate-600">0 = never expires</p></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Session Idle Timeout (minutes)</label>
              <input type="number" value={settings.session_idle_timeout || 30} onChange={e => update("session_idle_timeout", e.target.value)} className="input-field" /></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Lock className="w-4 h-4 text-orange-400" />HIPAA Compliance</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Audit Log Retention (days)</label>
              <input type="number" value={settings.audit_retention_days || 2555} onChange={e => update("audit_retention_days", e.target.value)} className="input-field" />
              <p className="text-[10px] text-slate-600">HIPAA requires 6 years (2,190 days) minimum</p></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">PHI Access Logging</label>
              <select value={settings.phi_access_logging || "enabled"} onChange={e => update("phi_access_logging", e.target.value)} className="input-field">
                <option value="enabled">Enabled (log all patient data access)</option>
                <option value="disabled">Disabled</option>
              </select></div>
            </div>
          </div>
        </div>
      )}

      {locked && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-800/30 text-sm text-amber-300">
          <Lock className="w-4 h-4 flex-shrink-0" />
          Settings are locked to prevent accidental changes. Click "Locked" to unlock and edit.
        </div>
      )}

      <ConfirmDialog
        open={showSaveConfirm}
        title="Save All Settings?"
        message="This will update system settings across the platform. Changes take effect immediately."
        confirmLabel="Save Settings"
        confirmColor="brand"
        onConfirm={async () => { setShowSaveConfirm(false); await handleSave(); }}
        onCancel={() => setShowSaveConfirm(false)}
      />
    </div>
  );
}

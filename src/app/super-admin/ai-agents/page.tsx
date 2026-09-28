"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Bot, Plus, Play, Pause, Copy, Trash2, Settings, ChevronDown, ChevronUp,
  Loader2, Check, Building2, GripVertical, Phone, Mail, Brain, Shield,
  FileText, Database, AlertTriangle, Clock, Send, Zap, ArrowRight, Lock, Unlock,
  RefreshCw, CalendarCheck, Pill, UserSearch, CheckSquare, MessageCircle,
} from "lucide-react";
import { ConfirmDialog, SettingsLock } from "@/components/ConfirmDialog";

// ── Step Type Definitions ───────────────────────────────────

const STEP_TYPES = [
  { id: "ehr_sync", label: "EHR Sync", icon: Database, color: "text-blue-400", desc: "Pull patient data from connected EHR" },
  { id: "voice_call", label: "Voice Call", icon: Phone, color: "text-brand-400", desc: "Outbound voice AI call to patient" },
  { id: "sms", label: "SMS / Link", icon: Mail, color: "text-cyan-400", desc: "Send SMS with intake form link" },
  { id: "collect_intake", label: "Collect Data", icon: FileText, color: "text-purple-400", desc: "Gather data from call or form" },
  { id: "generate_soap", label: "Generate SOAP", icon: Brain, color: "text-amber-400", desc: "Generate SOAP note via AI or template" },
  { id: "red_flag_check", label: "Red Flag Check", icon: AlertTriangle, color: "text-red-400", desc: "Scan for critical clinical red flags" },
  { id: "deliver_brief", label: "Deliver Brief", icon: Send, color: "text-brand-400", desc: "Push brief + SOAP to EHR and provider" },
  { id: "notify_provider", label: "Notify Provider", icon: Zap, color: "text-yellow-400", desc: "Alert provider of results or red flags" },
  { id: "wait", label: "Wait / Delay", icon: Clock, color: "text-slate-400", desc: "Pause workflow for configured time" },
  { id: "condition", label: "Condition", icon: Shield, color: "text-orange-400", desc: "If/else branch based on data" },
  { id: "trigger_agent", label: "Trigger Agent", icon: RefreshCw, color: "text-pink-400", desc: "Fire another AI agent in the system" },
  { id: "check_availability", label: "Check Availability", icon: CalendarCheck, color: "text-indigo-400", desc: "Look up provider schedule openings" },
  { id: "update_appointment", label: "Update Appointment", icon: CalendarCheck, color: "text-teal-400", desc: "Reschedule, cancel, or create appointment" },
  { id: "pharmacy_request", label: "Pharmacy Request", icon: Pill, color: "text-rose-400", desc: "Send refill or new Rx to pharmacy" },
  { id: "find_specialist", label: "Find Specialist", icon: UserSearch, color: "text-violet-400", desc: "Search specialist network for referral" },
  { id: "authorize_request", label: "Request Authorization", icon: CheckSquare, color: "text-lime-400", desc: "Request provider approval before proceeding" },
  { id: "patient_confirm", label: "Patient Confirm", icon: MessageCircle, color: "text-sky-400", desc: "Confirm action with patient via SMS or call" },
];

const TRIGGER_TYPES = [
  { id: "schedule", label: "Scheduled", desc: "Auto-trigger X hours before appointment" },
  { id: "manual", label: "Manual", desc: "Provider clicks to start" },
  { id: "event", label: "Event-based", desc: "Triggered by appointment confirmation, lab result, etc." },
];

const AGENT_TYPES = [
  { id: "pre_visit", label: "Pre-Visit Intake" },
  { id: "follow_up", label: "Follow-Up" },
  { id: "lab_review", label: "Lab Results Review" },
  { id: "appointment_reminder", label: "Appointment Reminder" },
  { id: "custom", label: "Custom" },
];

interface Agent {
  id: string; name: string; description: string; type: string;
  status: string; version: number; trigger: any; steps: any[];
  settings: any; assignments: any[]; createdAt: string;
}

export default function AIAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editing state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("custom");
  const [editTrigger, setEditTrigger] = useState<any>({ type: "manual", config: {} });
  const [editSteps, setEditSteps] = useState<any[]>([]);
  const [editSettings, setEditSettings] = useState<any>({});
  const [showAddStep, setShowAddStep] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [locked, setLocked] = useState(true);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/super-admin/ai-agents");
    const data = await res.json();
    setAgents(data.agents || []);
    setHospitals(data.hospitals || []);
    setClinics(data.clinics || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectAgent(agent: Agent) {
    setSelected(agent.id);
    setEditName(agent.name);
    setEditDesc(agent.description || "");
    setEditType(agent.type);
    setEditTrigger(agent.trigger || { type: "manual", config: {} });
    setEditSteps(Array.isArray(agent.steps) ? agent.steps : []);
    setEditSettings(agent.settings || {});
  }

  async function apiCall(body: any) {
    setSaving(true);
    await fetch("/api/super-admin/ai-agents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
    setSaving(false);
  }

  async function createAgent() {
    const res = await fetch("/api/super-admin/ai-agents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create", name: "New AI Agent",
        trigger: { type: "manual", config: {} },
        steps: [
          { id: "s1", type: "ehr_sync", name: "Sync Patient Data", config: {}, order: 0 },
          { id: "s2", type: "voice_call", name: "Call Patient", config: {}, order: 1 },
          { id: "s3", type: "collect_intake", name: "Collect Clinical Data", config: {}, order: 2 },
          { id: "s4", type: "generate_soap", name: "Generate SOAP Note", config: {}, order: 3 },
          { id: "s5", type: "deliver_brief", name: "Deliver to Provider", config: {}, order: 4 },
        ],
      }),
    });
    const data = await res.json();
    await load();
    if (data.agent) selectAgent(data.agent);
  }

  async function saveAgent() {
    if (!selected) return;
    await apiCall({
      action: "update", id: selected,
      name: editName, description: editDesc, type: editType,
      trigger: editTrigger, steps: editSteps, settings: editSettings,
    });
  }

  function addStep(typeId: string) {
    const stepType = STEP_TYPES.find(s => s.id === typeId);
    setEditSteps([...editSteps, {
      id: `s${Date.now()}`, type: typeId, name: stepType?.label || typeId,
      config: {}, order: editSteps.length,
    }]);
    setShowAddStep(false);
  }

  function removeStep(idx: number) {
    setEditSteps(editSteps.filter((_, i) => i !== idx));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const arr = [...editSteps];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setEditSteps(arr.map((s, i) => ({ ...s, order: i })));
  }

  const selectedAgent = agents.find(a => a.id === selected);
  const statusColors: Record<string, string> = {
    draft: "bg-slate-800 text-slate-300",
    active: "bg-brand-900/50 text-brand-300",
    paused: "bg-amber-900/50 text-amber-300",
    archived: "bg-red-900/50 text-red-300",
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* Left — Agent List */}
      <div className="w-80 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold text-white">AI Agents</h1>
          <div className="flex items-center gap-2">
            <SettingsLock locked={locked} onToggle={() => setLocked(!locked)} />
            <button onClick={createAgent} disabled={locked} className="btn-primary text-xs py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"><Plus className="w-3 h-3" />New</button>
          </div>
        </div>

        <div className="space-y-2">
          {agents.map(agent => (
            <button key={agent.id} onClick={() => selectAgent(agent)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selected === agent.id ? "border-brand-500 bg-brand-950/30" : "border-midnight-700/50 bg-midnight-900/60 hover:border-midnight-600"
              }`}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand-400 flex-shrink-0" />
                <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                <span className={`ml-auto badge text-[10px] ${statusColors[agent.status]}`}>{agent.status}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{agent.description || AGENT_TYPES.find(t => t.id === agent.type)?.label}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-slate-600">{(Array.isArray(agent.steps) ? agent.steps : []).length} steps</span>
                <span className="text-[10px] text-slate-600">v{agent.version}</span>
                {agent.assignments?.length > 0 && (
                  <span className="text-[10px] text-brand-500">{agent.assignments.length} assigned</span>
                )}
              </div>
            </button>
          ))}
          {agents.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No AI agents yet. Click "New" to create one.</p>
          )}
        </div>
      </div>

      {/* Right — Agent Builder */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center space-y-3">
              <Bot className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm">Select an agent or create a new one</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="text-xl font-bold bg-transparent border-none text-white focus:outline-none w-full" placeholder="Agent name" />
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  className="text-sm bg-transparent border-none text-slate-400 focus:outline-none w-full" placeholder="Description..." />
              </div>
              <select value={editType} onChange={e => setEditType(e.target.value)} className="input-field w-40 text-xs">
                {AGENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <div className="flex gap-1">
                {selectedAgent?.status !== "active" && (
                  <button onClick={() => apiCall({ action: "set_status", id: selected, status: "active" })}
                    className="p-2 rounded-lg text-brand-400 hover:bg-brand-900/30" title="Activate"><Play className="w-4 h-4" /></button>
                )}
                {selectedAgent?.status === "active" && (
                  <button onClick={() => apiCall({ action: "set_status", id: selected, status: "paused" })}
                    className="p-2 rounded-lg text-amber-400 hover:bg-amber-900/30" title="Pause"><Pause className="w-4 h-4" /></button>
                )}
                <button onClick={() => apiCall({ action: "duplicate", id: selected })}
                  className="p-2 rounded-lg text-slate-400 hover:bg-midnight-700" title="Duplicate"><Copy className="w-4 h-4" /></button>
                <button onClick={() => setConfirm({
                    title: "Delete AI Agent?",
                    message: `This will permanently delete "${editName}" and all its assignments. This action cannot be undone.`,
                    onConfirm: () => { apiCall({ action: "delete", id: selected }); setSelected(null); setConfirm(null); },
                  })}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-900/30" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Trigger */}
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase">Trigger</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {TRIGGER_TYPES.map(t => (
                  <button key={t.id} onClick={() => setEditTrigger({ ...editTrigger, type: t.id })}
                    className={`p-3 rounded-lg border text-left text-xs transition-all ${
                      editTrigger.type === t.id ? "border-brand-500 bg-brand-950/40" : "border-midnight-700/50 hover:border-midnight-600"
                    }`}>
                    <p className="font-medium text-white">{t.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
              {editTrigger.type === "schedule" && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400">Hours before appointment:</label>
                  <input type="number" value={editTrigger.config?.hoursBefore || 36}
                    onChange={e => setEditTrigger({ ...editTrigger, config: { ...editTrigger.config, hoursBefore: parseInt(e.target.value) } })}
                    className="input-field w-20 text-xs" />
                </div>
              )}
            </div>

            {/* Steps — Visual Pipeline */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase">Workflow Steps</p>
                <button onClick={() => setShowAddStep(!showAddStep)} className="btn-secondary text-xs py-1">
                  <Plus className="w-3 h-3" />Add Step
                </button>
              </div>

              {/* Add step picker */}
              {showAddStep && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 p-3 bg-midnight-800/50 rounded-lg">
                  {STEP_TYPES.map(st => {
                    const Icon = st.icon;
                    return (
                      <button key={st.id} onClick={() => addStep(st.id)}
                        className="p-2 rounded-lg border border-midnight-700/50 hover:border-brand-500 text-left transition-all">
                        <Icon className={`w-4 h-4 ${st.color} mb-1`} />
                        <p className="text-xs font-medium text-white">{st.label}</p>
                        <p className="text-[9px] text-slate-500 line-clamp-1">{st.desc}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step list */}
              <div className="space-y-1">
                {editSteps.map((step, idx) => {
                  const stepDef = STEP_TYPES.find(s => s.id === step.type);
                  const Icon = stepDef?.icon || Bot;
                  return (
                    <Fragment key={step.id}>
                      {idx > 0 && (
                        <div className="flex justify-center py-0.5">
                          <ArrowRight className="w-3 h-3 text-slate-600 rotate-90" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-midnight-800/50 border border-midnight-700/30 group">
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveStep(idx, -1)} className="text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => moveStep(idx, 1)} className="text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                        <div className={`w-8 h-8 rounded-lg bg-midnight-900 flex items-center justify-center ${stepDef?.color || "text-slate-400"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <input value={step.name} onChange={e => {
                            const arr = [...editSteps]; arr[idx] = { ...arr[idx], name: e.target.value }; setEditSteps(arr);
                          }} className="text-sm font-medium bg-transparent border-none text-white focus:outline-none w-full" />
                          <p className="text-[10px] text-slate-500">{stepDef?.desc}</p>
                        </div>
                        <span className="badge bg-midnight-900 text-slate-500 text-[10px]">{step.type}</span>
                        <button onClick={() => removeStep(idx)}
                          className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </Fragment>
                  );
                })}
                {editSteps.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6">No steps yet. Click "Add Step" to build the workflow.</p>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase">Agent Settings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><label className="text-[11px] text-slate-500">Max Call Attempts</label>
                <input type="number" value={editSettings.retryAttempts || 3}
                  onChange={e => setEditSettings({ ...editSettings, retryAttempts: parseInt(e.target.value) })}
                  className="input-field text-xs" /></div>
                <div className="space-y-1"><label className="text-[11px] text-slate-500">Retry Interval (min)</label>
                <input type="number" value={editSettings.retryIntervalMin || 60}
                  onChange={e => setEditSettings({ ...editSettings, retryIntervalMin: parseInt(e.target.value) })}
                  className="input-field text-xs" /></div>
                <div className="space-y-1"><label className="text-[11px] text-slate-500">SMS Fallback</label>
                <select value={editSettings.smsFallback ? "yes" : "no"}
                  onChange={e => setEditSettings({ ...editSettings, smsFallback: e.target.value === "yes" })}
                  className="input-field text-xs">
                  <option value="yes">Enabled</option><option value="no">Disabled</option>
                </select></div>
              </div>
            </div>

            {/* Assignments */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase"><Building2 className="w-3 h-3 inline mr-1" />Assignments</p>
                <button onClick={() => setShowAssign(!showAssign)} className="btn-secondary text-xs py-1"><Plus className="w-3 h-3" />Assign</button>
              </div>

              {selectedAgent?.assignments?.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded bg-midnight-800/40 text-xs">
                  <span className="badge bg-midnight-700 text-slate-300">{a.scope}</span>
                  <span className="text-slate-300">{a.hospital?.name || a.clinic?.name || "All"}</span>
                  <button onClick={() => setConfirm({
                    title: "Remove Assignment?",
                    message: "This will unassign the agent from this hospital/clinic.",
                    onConfirm: () => { apiCall({ action: "unassign", assignmentId: a.id }); setConfirm(null); },
                  })}
                    className="ml-auto text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}

              {showAssign && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-midnight-800/30 rounded-lg" id="assign-form">
                  <div className="space-y-1"><label className="text-[10px] text-slate-500">Scope</label>
                  <select id="assign-scope" className="input-field text-xs">
                    <option value="all">All</option><option value="hospital">Hospital</option><option value="clinic">Clinic</option>
                  </select></div>
                  <div className="space-y-1"><label className="text-[10px] text-slate-500">Hospital</label>
                  <select id="assign-hospital" className="input-field text-xs">
                    <option value="">—</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select></div>
                  <div className="space-y-1"><label className="text-[10px] text-slate-500">Clinic</label>
                  <select id="assign-clinic" className="input-field text-xs">
                    <option value="">—</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                  <button onClick={() => {
                    const scope = (document.getElementById("assign-scope") as HTMLSelectElement)?.value;
                    const hospitalId = (document.getElementById("assign-hospital") as HTMLSelectElement)?.value;
                    const clinicId = (document.getElementById("assign-clinic") as HTMLSelectElement)?.value;
                    apiCall({ action: "assign", agentId: selected, scope, hospitalId: hospitalId || null, clinicId: clinicId || null });
                    setShowAssign(false);
                  }} className="btn-primary text-xs py-1 col-span-3 justify-center">Assign Agent</button>
                </div>
              )}

              {(!selectedAgent?.assignments || selectedAgent.assignments.length === 0) && !showAssign && (
                <p className="text-xs text-slate-500">Not assigned to any hospital or clinic yet.</p>
              )}
            </div>

            {/* Save */}
            <button onClick={saveAgent} disabled={saving || locked} className="btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
              {locked ? <Lock className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {locked ? "Unlock to Save" : "Save Agent"}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel="Yes, proceed"
        onConfirm={confirm?.onConfirm || (() => {})}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain, Loader2, Play, CheckCircle2, AlertCircle, Users, Send,
  QrCode, ChevronDown, ChevronUp, Clock, ArrowRight, Download, Zap,
} from "lucide-react";
import { ServiceIcon, ServiceDot } from "@/components/ServiceIcon";

const SERVICE_LABELS: Record<string, string> = {
  pre_visit_intake: "Pre-Visit Intake", appointment_reminder: "Appointment Reminder",
  refill_manager: "Medication Refill", schedule_assistant: "Schedule Assistant",
  referral_coordinator: "Referral Coordinator", post_visit_followup: "Post-Visit Follow-Up",
  lab_results_review: "Lab Results Review", new_patient_onboarding: "New Patient Onboarding",
  chronic_disease_checkin: "Chronic Disease Check-In", appointment_scheduler: "Appointment Scheduler",
};

export default function AgenticAIPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executingAll, setExecutingAll] = useState(false);
  const [execResults, setExecResults] = useState<Record<string, any>>({});
  const [allResult, setAllResult] = useState<any>(null);
  const [tab, setTab] = useState<"agent" | "qr">("agent");
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [generatingQR, setGeneratingQR] = useState(false);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  async function runAnalysis() {
    setAnalyzing(true); setResults(null); setExecResults({}); setAllResult(null);
    const res = await fetch("/api/agentic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze" }) });
    setResults(await res.json());
    setAnalyzing(false);
  }

  async function executePatient(rec: any) {
    setExecuting(rec.patient.id);
    const res = await fetch("/api/agentic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "execute", patientId: rec.patient.id, services: rec.services, channel: "sms" }) });
    const data = await res.json();
    setExecResults(prev => ({ ...prev, [rec.patient.id]: data }));
    setExecuting(null);
  }

  async function executeAll() {
    setExecutingAll(true);
    const res = await fetch("/api/agentic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "execute_all", recommendations: results.recommendations, channel: "sms" }) });
    setAllResult(await res.json());
    setExecutingAll(false);
  }

  async function generateQRCodes() {
    setGeneratingQR(true);
    const baseUrl = window.location.origin;
    const QRCode = (await import("qrcode")).default;
    const codes: Record<string, string> = {};
    for (const [id] of Object.entries(SERVICE_LABELS)) {
      codes[id] = await QRCode.toDataURL(`${baseUrl}/qr/${id}`, { width: 256, margin: 2, color: { dark: "#ffffff", light: "#0f172a" } });
    }
    setQrCodes(codes);
    setGeneratingQR(false);
  }

  return (
    <div className="space-y-6 max-w-full lg:max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Agentic AI</h1>
          <p className="text-sm text-slate-400 mt-1">Autonomous patient outreach — analyzes records and triggers the right services</p>
        </div>
        <div className="flex gap-1 p-1 bg-midnight-900/80 rounded-lg border border-midnight-700/50">
          <button onClick={() => setTab("agent")} className={`px-4 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 ${tab === "agent" ? "bg-brand-600 text-white" : "text-slate-400"}`}><Brain className="w-3.5 h-3.5" />Agent</button>
          <button onClick={() => { setTab("qr"); if (Object.keys(qrCodes).length === 0) generateQRCodes(); }} className={`px-4 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 ${tab === "qr" ? "bg-brand-600 text-white" : "text-slate-400"}`}><QrCode className="w-3.5 h-3.5" />QR Codes</button>
        </div>
      </div>

      {tab === "agent" && (
        <>
          {/* Run analysis */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 ring-2 ring-purple-500/20 flex items-center justify-center shadow-lg">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Patient Outreach Analyzer</p>
                  <p className="text-xs text-slate-400">Scans all patients, vitals, medications, and schedules to determine which services to trigger</p>
                </div>
              </div>
              <button onClick={runAnalysis} disabled={analyzing} className="btn-primary py-2.5 px-6">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "Run Analysis"}
              </button>
            </div>
          </div>

          {/* Results */}
          {results && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Patients Analyzed", value: results.analyzed, gradient: "from-blue-500 to-indigo-600" },
                  { label: "Need Action", value: results.patientsWithActions, gradient: "from-amber-500 to-orange-600" },
                  { label: "Total Messages", value: results.recommendations?.reduce((s: number, r: any) => s + r.totalServices, 0) || 0, gradient: "from-violet-500 to-purple-600" },
                  { label: "Analyzed At", value: new Date(results.timestamp).toLocaleTimeString(), gradient: "from-emerald-500 to-teal-600", isText: true },
                ].map(s => (
                  <div key={s.label} className="card p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} ring-2 ring-white/5 flex items-center justify-center shadow-lg`}>
                      {(s as any).isText ? <Clock className="w-5 h-5 text-white" /> : <span className="text-lg font-bold text-white">{s.value}</span>}
                    </div>
                    <div><p className={(s as any).isText ? "text-sm font-semibold text-white" : "text-xl font-bold text-white"}>{(s as any).isText ? s.value : ""}</p><p className="text-[10px] text-slate-500">{s.label}</p></div>
                  </div>
                ))}
              </div>

              {/* Execute all */}
              {results.recommendations?.length > 0 && !allResult && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-brand-950/30 border border-brand-700/20">
                  <p className="text-sm text-white"><span className="font-semibold">{results.patientsWithActions}</span> patients need outreach with <span className="font-semibold">{results.recommendations.reduce((s: number, r: any) => s + r.totalServices, 0)}</span> total messages</p>
                  <button onClick={executeAll} disabled={executingAll} className="btn-primary py-2">
                    {executingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Execute All
                  </button>
                </div>
              )}

              {allResult && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <p className="text-sm text-emerald-300">Sent {allResult.totalMessages} messages to {allResult.totalPatients} patients. Messages will be delivered sequentially.</p>
                </div>
              )}

              {/* Patient recommendations */}
              <div className="space-y-2">
                {results.recommendations?.map((rec: any) => {
                  const isExp = expanded === rec.patient.id;
                  const execResult = execResults[rec.patient.id];
                  return (
                    <div key={rec.patient.id} className="card overflow-hidden">
                      <button onClick={() => setExpanded(isExp ? null : rec.patient.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-midnight-800/20 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white shadow-md">{rec.patient.name.split(" ").map((n: string) => n[0]).join("")}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{rec.patient.name}</p>
                          <p className="text-[10px] text-slate-500">{rec.patient.phone} · {rec.patient.conditions?.join(", ") || "No conditions"} · {rec.patient.medications} meds</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {rec.services.slice(0, 3).map((s: any) => <ServiceDot key={s.serviceId} type={s.serviceId} />)}
                          {rec.services.length > 3 && <span className="text-[10px] text-slate-500">+{rec.services.length - 3}</span>}
                        </div>
                        <span className="badge bg-brand-900/40 text-brand-300 text-[10px]">{rec.totalServices} action{rec.totalServices > 1 ? "s" : ""}</span>
                        {isExp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </button>
                      {isExp && (
                        <div className="px-4 pb-4 space-y-3 border-t border-midnight-800/30 pt-3">
                          <p className="text-xs text-slate-400">Recommended service sequence (will execute in this order, each waiting for the previous to complete):</p>
                          <div className="space-y-1.5">
                            {rec.services.map((s: any, i: number) => (
                              <div key={s.serviceId} className="flex items-center gap-2 p-2 rounded-lg bg-midnight-800/30">
                                <span className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center text-[9px] font-bold text-white">{i + 1}</span>
                                <ServiceIcon type={s.serviceId} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-white">{SERVICE_LABELS[s.serviceId]}</p>
                                  <p className="text-[10px] text-slate-500">{s.reason}</p>
                                </div>
                                {i < rec.services.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                              </div>
                            ))}
                          </div>
                          {execResult ? (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/30 text-xs text-emerald-300">
                              <CheckCircle2 className="w-4 h-4" />{execResult.queued} messages queued for {execResult.patient}
                            </div>
                          ) : (
                            <button onClick={() => executePatient(rec)} disabled={!!executing} className="btn-primary w-full justify-center py-2 text-xs">
                              {executing === rec.patient.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              Send {rec.totalServices} Message{rec.totalServices > 1 ? "s" : ""} to {rec.patient.name.split(" ")[0]}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {results.recommendations?.length === 0 && (
                <div className="card p-8 text-center"><CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" /><p className="text-white font-medium">All patients are up to date!</p><p className="text-xs text-slate-500 mt-1">No outreach actions needed at this time.</p></div>
              )}
            </>
          )}
        </>
      )}

      {/* QR Codes Tab */}
      {tab === "qr" && (
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Clinic QR Codes</p>
                <p className="text-xs text-slate-400">Print and display in waiting rooms. Patients scan to access services on their phones.</p>
              </div>
              {Object.keys(qrCodes).length > 0 && (
                <button onClick={() => window.print()} className="btn-secondary text-xs py-1.5"><Download className="w-3 h-3" />Print All</button>
              )}
            </div>
          </div>

          {generatingQR ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {Object.entries(SERVICE_LABELS).map(([id, label]) => (
                <div key={id} className="card p-5 text-center space-y-3 print:break-inside-avoid">
                  <ServiceIcon type={id} size="md" className="mx-auto" />
                  <p className="text-sm font-semibold text-white">{label}</p>
                  {qrCodes[id] ? (
                    <img src={qrCodes[id]} alt={`QR: ${label}`} className="w-40 h-40 mx-auto rounded-lg" />
                  ) : (
                    <div className="w-40 h-40 mx-auto rounded-lg bg-midnight-800 flex items-center justify-center">
                      <QrCode className="w-10 h-10 text-slate-600" />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500">Scan to access on your phone</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

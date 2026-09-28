"use client";

import { useState, useEffect } from "react";
import {
  FileText, Loader2, CheckCircle2, Clock, AlertTriangle, ChevronDown,
  ChevronUp, Download, Shield, Brain, MessageCircle, Database,
} from "lucide-react";

export default function PreVisitPage() {
  const [briefs, setBriefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/pre-visit").then(r => r.json()).then(data => {
      setBriefs(data.briefs || []);
    }).finally(() => setLoading(false));
  }, []);

  function getTab(id: string) { return viewTab[id] || "soap"; }
  function setTab(id: string, tab: string) { setViewTab(v => ({ ...v, [id]: tab })); }

  function downloadJSON(data: any, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  }

  // Apply filters
  const filtered = briefs.filter(b => {
    // Date filter
    if (dateFrom) {
      const apptDate = b.appointment?.scheduledAt ? new Date(b.appointment.scheduledAt) : null;
      if (apptDate && apptDate < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const apptDate = b.appointment?.scheduledAt ? new Date(b.appointment.scheduledAt) : null;
      const toEnd = new Date(dateTo); toEnd.setHours(23, 59, 59);
      if (apptDate && apptDate > toEnd) return false;
    }
    // Patient search
    if (patientSearch.length >= 2) {
      const name = `${b.patient?.firstName || ""} ${b.patient?.lastName || ""}`.toLowerCase();
      if (!name.includes(patientSearch.toLowerCase())) return false;
    }
    // Status filter
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Pre-Visit Briefs</h1>
        <p className="text-sm text-slate-400 mt-1">Patient intake summaries, SOAP notes, and clinical data ready for review</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-slate-500 uppercase">Patient</label>
          <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search by name..." className="input-field w-44 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-slate-500 uppercase">From Date</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-40 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-slate-500 uppercase">To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-40 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-slate-500 uppercase">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-36 py-1.5 text-sm">
            <option value="all">All</option>
            <option value="READY">Ready</option>
            <option value="PENDING">Pending</option>
            <option value="COLLECTING">Collecting</option>
          </select>
        </div>
        {(dateFrom || dateTo || patientSearch || statusFilter !== "all") && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); setPatientSearch(""); setStatusFilter("all"); }}
            className="text-xs text-slate-400 hover:text-white py-1.5 px-2">✕ Clear</button>
        )}
        <div className="ml-auto text-xs text-slate-500">{filtered.length} of {briefs.length} briefs</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Intakes", value: filtered.length, icon: FileText, bg: "from-blue-500 to-indigo-600", ring: "ring-blue-500/20" },
          { label: "Ready for Review", value: filtered.filter(b => b.status === "READY").length, icon: CheckCircle2, bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-500/20" },
          { label: "Red Flags", value: filtered.filter(b => (b.redFlags as any[])?.length > 0).length, icon: AlertTriangle, bg: "from-red-500 to-rose-600", ring: "ring-red-500/20" },
          { label: "Pending", value: filtered.filter(b => b.status === "PENDING").length, icon: Clock, bg: "from-amber-500 to-orange-600", ring: "ring-amber-500/20" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.bg} ring-2 ${s.ring} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white drop-shadow-sm" />
              </div>
              <div><p className="text-xl font-bold text-white">{s.value}</p><p className="text-[11px] text-slate-500">{s.label}</p></div>
            </div>
          );
        })}
      </div>

      {/* Briefs list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center"><FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No pre-visit intakes yet</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(brief => {
            const isExp = expanded === brief.id;
            const soap = brief.soapNote as any;
            const redFlags = (brief.redFlags as any[]) || [];
            const tab = getTab(brief.id);

            return (
              <div key={brief.id} className="card overflow-hidden">
                {/* Header row */}
                <button onClick={() => setExpanded(isExp ? null : brief.id)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-midnight-800/20 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ring-2 ${brief.status === "READY" ? "bg-gradient-to-br from-emerald-500 to-teal-600 ring-emerald-500/20" : "bg-gradient-to-br from-amber-500 to-orange-600 ring-amber-500/20"}`}>
                    {brief.status === "READY" ? <CheckCircle2 className="w-5 h-5 text-white drop-shadow-sm" /> : <Clock className="w-5 h-5 text-white drop-shadow-sm" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{brief.patient?.firstName} {brief.patient?.lastName}</p>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-brand-900/40 text-brand-300">{brief.appointment?.visitType?.replace(/_/g, " ")}</span>
                      {redFlags.length > 0 && <span className="badge bg-red-900/50 text-red-300 text-[10px]">⚠ {redFlags.length} flag{redFlags.length > 1 ? "s" : ""}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{brief.chiefComplaint || brief.appointment?.reasonForVisit || "No chief complaint recorded"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {brief.appointment?.scheduledAt ? new Date(brief.appointment.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                      {brief.appointment?.provider?.lastName && ` · Dr. ${brief.appointment.provider.lastName}`}
                      {brief.appointment?.clinic?.name && ` · ${brief.appointment.clinic.name}`}
                    </p>
                    {(brief.patient?.conditions as string[])?.length > 0 && (
                      <p className="text-[10px] text-slate-600 mt-0.5">Conditions: {(brief.patient.conditions as string[]).join(", ")}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    {brief.riskScore != null && (
                      <span className={`badge text-[10px] ${brief.riskScore >= 7 ? "bg-red-900/50 text-red-300" : brief.riskScore >= 4 ? "bg-amber-900/50 text-amber-300" : "bg-brand-900/50 text-brand-300"}`}>
                        Risk: {brief.riskScore}/10
                      </span>
                    )}
                    <p className="text-[10px] text-slate-600">{brief.generatedAt ? new Date(brief.generatedAt).toLocaleString() : ""}</p>
                  </div>
                  {isExp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {/* Expanded detail */}
                {isExp && (
                  <div className="border-t border-midnight-800/40">
                    {/* Tabs */}
                    <div className="flex border-b border-midnight-800/30">
                      {[
                        { id: "soap", label: "SOAP Note", icon: Brain },
                        { id: "transcript", label: "Transcript", icon: MessageCircle },
                        { id: "fhir", label: "FHIR R4", icon: Database },
                        { id: "flags", label: `Red Flags (${redFlags.length})`, icon: AlertTriangle },
                      ].map(t => {
                        const Icon = t.icon;
                        return (
                          <button key={t.id} onClick={() => setTab(brief.id, t.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                              tab === t.id ? "border-brand-500 text-brand-300" : "border-transparent text-slate-500 hover:text-slate-300"
                            }`}>
                            <Icon className="w-3.5 h-3.5" />{t.label}
                          </button>
                        );
                      })}
                      <div className="flex-1" />
                      {brief.fhirBundle && (
                        <button onClick={() => downloadJSON(brief.fhirBundle, `fhir-bundle-${brief.patient?.lastName}-${brief.id.slice(0,6)}.json`)}
                          className="flex items-center gap-1 px-3 text-xs text-slate-500 hover:text-brand-300"><Download className="w-3 h-3" />Export FHIR</button>
                      )}
                    </div>

                    <div className="p-5">
                      {/* SOAP Tab */}
                      {tab === "soap" && soap && (
                        <div className="space-y-4 text-sm">
                          {[
                            { label: "SUBJECTIVE", content: soap.subjective, color: "text-brand-400" },
                            { label: "OBJECTIVE", content: soap.objective, color: "text-blue-400" },
                            { label: "ASSESSMENT", content: soap.assessment, color: "text-amber-400" },
                            { label: "PLAN", content: soap.plan, color: "text-purple-400" },
                          ].map(s => (
                            <div key={s.label}>
                              <p className={`text-xs font-bold uppercase ${s.color}`}>{s.label}</p>
                              <p className="text-slate-300 whitespace-pre-wrap mt-1 leading-relaxed">{s.content}</p>
                            </div>
                          ))}
                          {soap.differentials?.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase text-brand-400 mb-2">DIFFERENTIALS</p>
                              {soap.differentials.map((d: any, i: number) => (
                                <div key={i} className="flex items-start gap-2 mb-1.5 text-xs">
                                  <span className={`badge text-[10px] ${d.probability === "high" ? "bg-red-900/40 text-red-300" : d.probability === "moderate" ? "bg-amber-900/40 text-amber-300" : "bg-slate-800 text-slate-400"}`}>{d.probability}</span>
                                  <div><span className="text-slate-200">{d.diagnosis}</span> <span className="text-slate-600">{d.icdCode}</span></div>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-slate-600">Generated by: {soap.generatedBy} · Protocols: {soap.protocolsApplied?.join(", ") || "—"}</p>
                        </div>
                      )}

                      {/* Transcript Tab */}
                      {tab === "transcript" && (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {brief.transcript ? brief.transcript.split("\n\n").map((line: string, i: number) => {
                            const isBot = line.startsWith("Assistant:");
                            const text = line.replace(/^(Assistant|Patient):\s*/, "");
                            return (
                              <div key={i} className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                                  isBot ? "bg-midnight-800 text-slate-200 rounded-bl-sm" : "bg-brand-600 text-white rounded-br-sm"
                                }`}>{text}</div>
                              </div>
                            );
                          }) : <p className="text-slate-500 text-sm text-center py-8">No transcript available</p>}
                        </div>
                      )}

                      {/* FHIR Tab */}
                      {tab === "fhir" && (
                        <div>
                          {brief.fhirBundle ? (
                            <pre className="text-[11px] font-mono text-slate-300 bg-midnight-800/50 rounded-lg p-4 max-h-96 overflow-auto whitespace-pre-wrap">
                              {JSON.stringify(brief.fhirBundle, null, 2)}
                            </pre>
                          ) : <p className="text-slate-500 text-sm text-center py-8">No FHIR bundle generated</p>}
                        </div>
                      )}

                      {/* Red Flags Tab */}
                      {tab === "flags" && (
                        <div className="space-y-3">
                          {redFlags.length > 0 ? redFlags.map((f: any, i: number) => (
                            <div key={i} className={`p-3 rounded-lg border ${f.severity === "critical" ? "bg-red-950/40 border-red-800/40" : f.severity === "high" ? "bg-amber-950/40 border-amber-800/40" : "bg-midnight-800/40 border-midnight-700/40"}`}>
                              <p className={`text-sm font-medium ${f.severity === "critical" ? "text-red-300" : f.severity === "high" ? "text-amber-300" : "text-slate-300"}`}>
                                {f.severity === "critical" ? "🔴" : f.severity === "high" ? "🟠" : "🟡"} {f.flag}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">{f.action}</p>
                            </div>
                          )) : <p className="text-slate-500 text-sm text-center py-8">No red flags detected ✓</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

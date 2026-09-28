"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

export default function MyRecordsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/patient/intake").then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  const patient = data?.patient;
  const allAppts = patient?.appointments || [];
  const pending = allAppts.filter((a: any) => !a.preVisitBrief || a.preVisitBrief.status !== "READY");
  const completed = patient?.completedIntakes || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">My Pre-Visit Forms</h1>
        <p className="text-sm text-slate-400 mt-1">View all your submitted and pending pre-visit intake forms</p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2"><Clock className="w-4 h-4" />Pending</h2>
          {pending.map((appt: any) => (
            <div key={appt.id} className="card p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-amber-900/40 flex items-center justify-center"><Clock className="w-4 h-4 text-amber-400" /></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{appt.visitType?.replace(/_/g, " ")} — Dr. {appt.provider?.lastName}</p>
                <p className="text-xs text-slate-400">{new Date(appt.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
              <a href={`/patient-portal/intake?appointmentId=${appt.id}`} className="btn-primary text-xs py-1.5">Complete Intake</a>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-brand-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Submitted ({completed.length})</h2>
          {completed.map((appt: any) => {
            const brief = appt.preVisitBrief;
            const isExpanded = expanded === appt.id;
            return (
              <div key={appt.id} className="card overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : appt.id)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-midnight-800/20 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-brand-900/40 flex items-center justify-center"><FileText className="w-4 h-4 text-brand-400" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{appt.visitType?.replace(/_/g, " ")} — Dr. {appt.provider?.lastName}</p>
                    <p className="text-xs text-slate-400">{new Date(appt.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <span className="badge bg-brand-900/40 text-brand-300 text-[10px]">{brief?.status}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {isExpanded && brief && (
                  <div className="px-4 pb-4 space-y-3 border-t border-midnight-800/30 pt-3">
                    {brief.chiefComplaint && <div className="text-sm"><span className="text-slate-500 text-xs block">Chief Complaint</span><span className="text-slate-200">{brief.chiefComplaint}</span></div>}
                    {brief.riskScore != null && <div className="flex gap-4 text-sm">
                      <div><span className="text-slate-500 text-xs block">Risk Score</span><span className="text-white font-semibold">{brief.riskScore}/10</span></div>
                      <div><span className="text-slate-500 text-xs block">Protocols</span><span className="text-slate-300">{brief.protocolsApplied?.join(", ") || "—"}</span></div>
                    </div>}
                    {brief.clinicalSummary && <div><span className="text-slate-500 text-xs block mb-1">Clinical Summary</span><p className="text-xs text-slate-400 p-3 bg-midnight-800/40 rounded-lg">{brief.clinicalSummary}</p></div>}
                    {brief.soapNote && (
                      <div className="space-y-1.5">
                        <span className="text-slate-500 text-xs block">Your Health Summary (SOAP Note)</span>
                        {[
                          { label: "What You Told Us", key: "subjective", color: "text-brand-400" },
                          { label: "Assessment", key: "assessment", color: "text-amber-400" },
                          { label: "Recommended Plan", key: "plan", color: "text-purple-400" },
                        ].map(s => (brief.soapNote as any)?.[s.key] ? (
                          <div key={s.key} className="p-2 bg-midnight-800/40 rounded-lg">
                            <p className={`text-[10px] font-semibold ${s.color}`}>{s.label}</p>
                            <p className="text-xs text-slate-300 mt-0.5">{(brief.soapNote as any)[s.key]}</p>
                          </div>
                        ) : null)}
                        {(brief.soapNote as any)?.redFlags?.length > 0 && (
                          <div className="p-2 rounded-lg bg-red-950/30 border border-red-800/20">
                            <p className="text-[10px] font-semibold text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Flagged for Provider</p>
                            <ul className="text-xs text-red-300 mt-1">{(brief.soapNote as any).redFlags.map((f: string, i: number) => <li key={i}>• {f}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-600">Submitted {brief.generatedAt ? new Date(brief.generatedAt).toLocaleString() : "—"}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No submitted forms yet.</p>
        </div>
      )}
    </div>
  );
}

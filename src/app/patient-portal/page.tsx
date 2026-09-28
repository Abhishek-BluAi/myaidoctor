"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, CheckCircle2, Clock, Loader2, ArrowUp, ArrowDown, Stethoscope, Eye, ChevronDown, ChevronUp, X, FileText } from "lucide-react";

export default function PatientPortalHome() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);
  const [viewingBrief, setViewingBrief] = useState<any>(null);

  useEffect(() => {
    fetch("/api/patient/intake").then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  const patient = data?.patient;
  const user = data?.user;
  const name = patient?.firstName || user?.firstName || "Patient";
  const rawAppointments = patient?.appointments || [];
  const completedIntakes = patient?.completedIntakes || [];

  const appointments = [...rawAppointments].sort((a: any, b: any) => {
    const da = new Date(a.scheduledAt).getTime();
    const db = new Date(b.scheduledAt).getTime();
    return sortAsc ? da - db : db - da;
  });

  const upcoming = appointments.filter((a: any) => new Date(a.scheduledAt) >= new Date());

  // View completed brief modal
  if (viewingBrief) {
    const soap = viewingBrief.preVisitBrief?.soapNote as any;
    const transcript = viewingBrief.preVisitBrief?.transcript;
    let convoHistory: any[] = [];
    try { convoHistory = JSON.parse(transcript || "[]"); } catch { convoHistory = []; }

    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewingBrief(null)} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-midnight-800/60"><X className="w-5 h-5" /></button>
          <div>
            <h1 className="text-xl font-display font-bold text-white">My Intake Summary</h1>
            <p className="text-sm text-slate-400">{viewingBrief.visitType?.replace(/_/g, " ")} — Dr. {viewingBrief.provider?.lastName} · {new Date(viewingBrief.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
        </div>

        {/* Status card */}
        <div className="card p-4 flex items-center gap-3 bg-emerald-950/20 border border-emerald-800/20">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Intake Complete</p>
            <p className="text-[11px] text-slate-500">Submitted {viewingBrief.preVisitBrief?.generatedAt ? new Date(viewingBrief.preVisitBrief.generatedAt).toLocaleString() : ""} · Your doctor can now review this before your visit</p>
          </div>
        </div>

        {/* Chief complaint */}
        {viewingBrief.preVisitBrief?.chiefComplaint && (
          <div className="card p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase">Chief Complaint</p>
            <p className="text-sm text-white">{viewingBrief.preVisitBrief.chiefComplaint}</p>
          </div>
        )}

        {/* Clinical Summary */}
        {viewingBrief.preVisitBrief?.clinicalSummary && (
          <div className="card p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase">Clinical Summary</p>
            <p className="text-sm text-slate-300 leading-relaxed">{viewingBrief.preVisitBrief.clinicalSummary}</p>
          </div>
        )}

        {/* SOAP Note (patient-friendly view) */}
        {soap && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase">Your Health Summary (SOAP Note)</p>
            {[
              { label: "What You Told Us", content: soap.subjective, color: "text-brand-400" },
              { label: "Assessment", content: soap.assessment, color: "text-amber-400" },
              { label: "Recommended Plan", content: soap.plan, color: "text-purple-400" },
            ].map(s => s.content ? (
              <div key={s.label}>
                <p className={`text-xs font-semibold ${s.color}`}>{s.label}</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap mt-0.5 leading-relaxed">{s.content}</p>
              </div>
            ) : null)}
            {soap.redFlags?.length > 0 && (
              <div className="p-2 rounded-lg bg-red-950/30 border border-red-800/20">
                <p className="text-xs font-semibold text-red-400">Items Flagged for Your Doctor</p>
                <ul className="text-xs text-red-300 mt-1 space-y-0.5">{soap.redFlags.map((f: string, i: number) => <li key={i}>• {f}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {/* Conversation History */}
        {convoHistory.length > 0 && (
          <div className="card p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">Your Conversation</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {convoHistory.map((msg: any, i: number) => (
                <div key={i} className={`flex ${msg.role === "bot" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${msg.role === "bot" ? "bg-midnight-800/60 text-slate-300" : "bg-brand-600 text-white"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setViewingBrief(null)} className="btn-secondary w-full justify-center py-2.5">Back to Portal</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Welcome back, {name}</h1>
        <p className="text-sm text-slate-400 mt-1">Complete your pre-visit intake to help your provider prepare for your appointment.</p>
      </div>

      {/* Upcoming Appointments */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Upcoming Appointments ({upcoming.length})</h2>
            <button onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-midnight-800/60 border border-midnight-700/50 transition-all">
              {sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {sortAsc ? "Soonest first" : "Latest first"}
            </button>
          </div>
          {upcoming.map((appt: any) => {
            const hasIntake = appt.preVisitBrief?.status === "READY";
            const isPending = appt.preVisitBrief?.status === "PENDING" || appt.preVisitBrief?.status === "COLLECTING" || appt.workflow?.stage === "COLLECTING";
            const apptDate = new Date(appt.scheduledAt);
            const isToday = apptDate.toDateString() === new Date().toDateString();
            const isTomorrow = apptDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
            const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : apptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const completionPct = appt.workflow?.completionRate ? Math.round(appt.workflow.completionRate * 100) : 0;

            return (
              <div key={appt.id} className={`card p-4 sm:p-5 ${isToday ? "ring-1 ring-brand-500/30" : ""}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${hasIntake ? "from-emerald-500 to-teal-600" : isToday ? "from-brand-400 to-teal-500" : "from-brand-500 to-brand-700"} ring-2 ${hasIntake ? "ring-emerald-500/20" : "ring-brand-500/20"} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    {hasIntake ? <CheckCircle2 className="w-6 h-6 text-white" /> : <CalendarDays className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white text-sm">{appt.visitType?.replace(/_/g, " ")}</p>
                      {isToday && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-500/20 text-brand-300 uppercase">Today</span>}
                      {hasIntake && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">Intake Complete</span>}
                      {isPending && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">{completionPct}% Done</span>}
                    </div>
                    <p className="text-sm text-slate-400"><Stethoscope className="w-3 h-3 inline mr-1" />Dr. {appt.provider?.lastName} — {dayLabel}, {apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                    <p className="text-[11px] text-slate-500">{appt.clinic?.name}</p>
                    {hasIntake && appt.preVisitBrief?.chiefComplaint && (
                      <p className="text-[11px] text-slate-500 mt-1">Chief complaint: {appt.preVisitBrief.chiefComplaint}</p>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {hasIntake ? (
                      <>
                        <button onClick={() => setViewingBrief(appt)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-midnight-800/60 hover:bg-midnight-700/60 text-slate-300 text-sm font-medium transition-colors flex-1 sm:flex-none justify-center">
                          <Eye className="w-4 h-4" />View Answers
                        </button>
                      </>
                    ) : isPending ? (
                      <Link href={`/patient-portal/intake?appointmentId=${appt.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors flex-1 sm:flex-none justify-center">
                        <ClipboardList className="w-4 h-4" />Continue ({completionPct}%)
                      </Link>
                    ) : (
                      <Link href={`/patient-portal/intake?appointmentId=${appt.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors flex-1 sm:flex-none justify-center">
                        <ClipboardList className="w-4 h-4" />Start Intake
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Intakes */}
      {completedIntakes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400">Completed Intakes</h2>
          {completedIntakes.map((appt: any) => (
            <div key={appt.id} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{appt.visitType?.replace(/_/g, " ")} — Dr. {appt.provider?.lastName}</p>
                <p className="text-[10px] text-slate-500">{new Date(appt.scheduledAt).toLocaleDateString()} · {appt.preVisitBrief?.chiefComplaint || ""}</p>
              </div>
              <button onClick={() => setViewingBrief(appt)} className="btn-secondary text-xs py-1.5"><Eye className="w-3 h-3" />View</button>
            </div>
          ))}
        </div>
      )}

      {appointments.length === 0 && (
        <div className="card p-8 text-center">
          <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No appointments found.</p>
          <p className="text-xs text-slate-500 mt-1">Contact your clinic to schedule an appointment.</p>
        </div>
      )}

      {/* Join Waitlist */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 ring-2 ring-pink-500/20 flex items-center justify-center shadow-lg flex-shrink-0">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Want an Earlier Appointment?</p>
          <p className="text-xs text-slate-400">Join the cancellation waitlist. If a slot opens up, you'll get an SMS, email, and in-app notification — first to claim wins!</p>
        </div>
        <button onClick={async () => {
          const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add", patientId: patient?.id, preference: "anytime", addedBy: "patient" }) });
          const data = await res.json();
          if (data.error) alert(data.error);
          else alert("You've been added to the waitlist! We'll notify you when a slot opens up.");
        }} className="btn-primary text-xs py-2 flex-shrink-0">Join Waitlist</button>
      </div>

      <div className="card p-5 space-y-2">
        <h3 className="text-sm font-semibold text-white">How it works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          {[
            { step: "1", title: "Answer Questions", desc: "Chat with our AI assistant about your symptoms and health", color: "from-brand-500 to-teal-600" },
            { step: "2", title: "SOAP Note Generated", desc: "AI creates a clinical summary with differential diagnoses", color: "from-violet-500 to-purple-600" },
            { step: "3", title: "Doctor Reviews", desc: "Your provider sees everything before your visit — faster check-in", color: "from-blue-500 to-indigo-600" },
          ].map(s => (
            <div key={s.step} className="space-y-2">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} text-white text-sm font-bold flex items-center justify-center mx-auto shadow-lg ring-2 ring-white/10`}>{s.step}</div>
              <p className="text-sm font-medium text-white">{s.title}</p>
              <p className="text-[11px] text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

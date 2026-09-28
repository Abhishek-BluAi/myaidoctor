"use client";
import { useEffect, useState } from "react";
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, PhoneOutgoing, MessageSquare,
  Clock, CheckCircle2, ArrowLeft, Voicemail, RotateCcw,
} from "lucide-react";
import { formatDate, formatTime, formatDuration, getStatusColor, getCallTypeLabel, cn } from "@/lib/utils";

export default function VoiceCallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("callType", typeFilter);
    fetch(`/api/voice-calls?${params}`)
      .then((r) => r.json())
      .then((d) => setCalls(d.calls))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [typeFilter]);

  const loadDetail = (id: string) => {
    fetch(`/api/voice-calls?id=${id}`)
      .then((r) => r.json())
      .then((d) => setSelectedCall(d.call))
      .catch(console.error);
  };

  if (selectedCall) {
    return <CallDetail call={selectedCall} onBack={() => setSelectedCall(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Voice AI Calls</h1>
          <p className="text-sm text-slate-400 mt-1">Pre-visit intake, scheduling, and front-desk automation</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {["", "PRE_VISIT", "SCHEDULING", "INSURANCE_VERIFY", "FOLLOW_UP", "GENERAL_INQUIRY"].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              typeFilter === t ? "bg-violet-600 text-white" : "bg-midnight-800 text-slate-400 hover:text-white"
            )}
          >
            {t ? getCallTypeLabel(t) : "All Calls"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call: any) => (
            <div
              key={call.id}
              onClick={() => loadDetail(call.id)}
              className="card-hover p-4 cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                {/* Direction Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  call.status === "COMPLETED" ? "bg-brand-500/10" :
                  call.status === "VOICEMAIL" ? "bg-orange-500/10" :
                  call.status === "FAILED" || call.status === "NO_ANSWER" ? "bg-red-500/10" :
                  "bg-midnight-800"
                )}>
                  {call.direction === "OUTBOUND" ? (
                    <PhoneOutgoing className={cn("w-4 h-4",
                      call.status === "COMPLETED" ? "text-brand-400" :
                      call.status === "VOICEMAIL" ? "text-orange-400" :
                      "text-slate-400"
                    )} />
                  ) : (
                    <PhoneIncoming className="w-4 h-4 text-blue-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      {call.patient.firstName} {call.patient.lastName}
                    </h3>
                    <span className={cn("badge text-[11px]", getStatusColor(call.status))}>
                      {call.status}
                    </span>
                    <span className="badge bg-midnight-800 text-slate-400 text-[11px]">
                      {getCallTypeLabel(call.callType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span>{call.direction === "OUTBOUND" ? "↗ Outbound" : "↙ Inbound"}</span>
                    <span>{call.patient.phone}</span>
                    {call.startedAt && <span>{formatDate(call.startedAt)} {formatTime(call.startedAt)}</span>}
                    {call.durationSeconds && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDuration(call.durationSeconds)}
                      </span>
                    )}
                    {call.attempts > 1 && (
                      <span className="flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> {call.attempts} attempts
                      </span>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="text-right flex-shrink-0 text-xs text-slate-400">
                  {call.completionRate != null && (
                    <div className="flex items-center gap-2">
                      <span>{Math.round(call.completionRate * 100)}%</span>
                      <div className="w-16 h-1.5 rounded-full bg-midnight-800">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${call.completionRate * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {call.sentiment && <p className="mt-1 capitalize">{call.sentiment}</p>}
                  {call.voicemailLeft && (
                    <span className="badge bg-orange-900/30 text-orange-300 text-[10px] mt-1">
                      <Voicemail className="w-3 h-3 mr-1" /> VM Left
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CallDetail({ call, onBack }: { call: any; onBack: () => void }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Calls
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-white">
              Voice Call — {call.patient.firstName} {call.patient.lastName}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={cn("badge", getStatusColor(call.status))}>{call.status}</span>
              <span className="badge bg-midnight-800 text-slate-300">{getCallTypeLabel(call.callType)}</span>
              <span className="badge bg-midnight-800 text-slate-300">
                {call.direction === "OUTBOUND" ? "↗ Outbound" : "↙ Inbound"}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 space-y-1">
            <p>{call.phoneNumber}</p>
            {call.startedAt && <p>{formatDate(call.startedAt)} {formatTime(call.startedAt)}</p>}
            {call.durationSeconds && <p>Duration: {formatDuration(call.durationSeconds)}</p>}
            <p>Attempts: {call.attempts}/{call.maxAttempts}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-midnight-800/50">
          {call.completionRate != null && (
            <div>
              <p className="text-xs text-slate-500">Completion Rate</p>
              <p className="text-lg font-bold text-white">{Math.round(call.completionRate * 100)}%</p>
            </div>
          )}
          {call.sentiment && (
            <div>
              <p className="text-xs text-slate-500">Sentiment</p>
              <p className="text-lg font-bold text-white capitalize">{call.sentiment}</p>
            </div>
          )}
          {call.durationSeconds && (
            <div>
              <p className="text-xs text-slate-500">Duration</p>
              <p className="text-lg font-bold text-white">{formatDuration(call.durationSeconds)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Data Collected */}
      {call.dataCollected && (
        <div className="card p-5">
          <h2 className="text-sm font-display font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-400" /> Data Collected
          </h2>
          <div className="grid gap-2">
            {Object.entries(call.dataCollected as Record<string, any>).map(([key, value]) => (
              <div key={key} className="flex items-start gap-3 p-2 rounded-lg bg-midnight-800/30">
                <span className="text-xs font-mono text-slate-500 min-w-[140px]">
                  {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                </span>
                <span className="text-sm text-slate-300">
                  {Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {call.transcript && (
        <div className="card p-5">
          <h2 className="text-sm font-display font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" /> Call Transcript
          </h2>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {call.transcript.split("\n").filter(Boolean).map((line: string, i: number) => {
              const isAI = line.startsWith("AI:");
              const isPatient = line.startsWith("Patient:");
              const content = line.replace(/^(AI|Patient):\s*/, "");

              return (
                <div key={i} className={cn("flex", isPatient ? "justify-start" : isAI ? "justify-end" : "justify-center")}>
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-xl text-sm",
                    isAI ? "bg-brand-900/30 border border-brand-800/30 text-slate-200" :
                    isPatient ? "bg-midnight-800/60 border border-midnight-700/40 text-slate-300" :
                    "text-slate-500 text-xs italic"
                  )}>
                    {(isAI || isPatient) && (
                      <p className="text-[10px] font-semibold mb-1 uppercase tracking-wider text-slate-500">
                        {isAI ? "MyAIDoctor AI" : "Patient"}
                      </p>
                    )}
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

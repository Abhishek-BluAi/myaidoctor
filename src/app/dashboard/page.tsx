"use client";
import { useEffect, useState } from "react";
import {
  Users, CalendarDays, FileText, Phone, Clock, Activity,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  Zap, TrendingUp, PhoneCall, Stethoscope, Heart, Shield,
} from "lucide-react";
import { formatTime, formatDate, getStatusColor, getRiskColor, getRiskLabel, getVisitTypeLabel, cn } from "@/lib/utils";

interface DashboardData {
  stats: any;
  recentAppointments: any[];
  recentBriefs: any[];
  recentCalls: any[];
  appointmentsByStatus: any[];
  callsByType: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading clinical dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-red-400 p-8">Failed to load dashboard</div>;

  const { stats, recentAppointments, recentBriefs, recentCalls } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Clinical Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            {formatDate(new Date(), { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-950/60 border border-brand-800/40">
            <Activity className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs font-medium text-brand-300">All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CalendarDays}
          label="Today's Appointments"
          value={stats.todayAppointments}
          sub={`${stats.totalAppointments} total`}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          icon={FileText}
          label="Briefs Ready"
          value={stats.completedBriefs}
          sub={`${stats.pendingBriefs} pending`}
          iconColor="text-brand-400"
          iconBg="bg-brand-500/10"
        />
        <StatCard
          icon={Phone}
          label="Call Success Rate"
          value={`${stats.callSuccessRate}%`}
          sub={`${stats.totalCalls} total calls`}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
        />
        <StatCard
          icon={Clock}
          label="Time Saved"
          value={`${stats.timeSavedHours}h`}
          sub={`~${stats.timeSavedMinutes} min reclaimed`}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          highlight
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-400">Avg Call Duration</span>
          </div>
          <p className="text-xl font-display font-bold text-white mt-1">
            {Math.floor(stats.avgCallDuration / 60)}:{(stats.avgCallDuration % 60).toString().padStart(2, "0")}
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-400" />
            <span className="text-xs text-slate-400">Avg Completion Rate</span>
          </div>
          <p className="text-xl font-display font-bold text-white mt-1">{stats.avgCompletionRate}%</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-400">Active Patients</span>
          </div>
          <p className="text-xl font-display font-bold text-white mt-1">{stats.totalPatients}</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-midnight-800/50 flex items-center justify-between">
            <h2 className="font-display font-semibold text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand-400" />
              Today&apos;s Schedule
            </h2>
            <span className="badge bg-midnight-800 text-slate-300">{recentAppointments.length} upcoming</span>
          </div>
          <div className="divide-y divide-midnight-800/40">
            {recentAppointments.map((appt: any) => (
              <div key={appt.id} className="p-4 hover:bg-midnight-800/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-center min-w-[52px]">
                      <p className="text-sm font-mono font-semibold text-white">
                        {formatTime(appt.scheduledAt)}
                      </p>
                      <p className="text-[11px] text-slate-500">{appt.duration} min</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {appt.patient.firstName} {appt.patient.lastName}
                        <span className="ml-2 text-slate-500 font-mono text-xs">{appt.patient.mrn}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {appt.reasonForVisit || getVisitTypeLabel(appt.visitType)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn("badge text-[11px]", getStatusColor(appt.status))}>
                          {appt.status.replace(/_/g, " ")}
                        </span>
                        <span className="badge bg-midnight-800 text-slate-400 text-[11px]">
                          {getVisitTypeLabel(appt.visitType)}
                        </span>
                        {appt.preVisitBrief?.riskScore && (
                          <span className={cn("badge text-[11px] border", getRiskColor(appt.preVisitBrief.riskScore))}>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Risk: {appt.preVisitBrief.riskScore.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      Dr. {appt.provider.lastName}
                    </p>
                    {appt.preVisitBrief && (
                      <div className="mt-1">
                        <span className={cn("badge text-[10px]", getStatusColor(appt.preVisitBrief.status))}>
                          Brief: {appt.preVisitBrief.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {recentAppointments.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">No upcoming appointments</div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Recent Pre-Visit Briefs */}
          <div className="card">
            <div className="p-4 border-b border-midnight-800/50">
              <h2 className="font-display font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" />
                Recent Briefs
              </h2>
            </div>
            <div className="divide-y divide-midnight-800/40">
              {recentBriefs.map((brief: any) => (
                <div key={brief.id} className="p-3 hover:bg-midnight-800/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white">
                      {brief.patient.firstName} {brief.patient.lastName}
                    </p>
                    <span className={cn("badge text-[10px]", getStatusColor(brief.status))}>
                      {brief.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">
                    {brief.chiefComplaint || "Pending intake"}
                  </p>
                  {brief.riskScore && (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-midnight-800">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              brief.riskScore >= 8 ? "bg-red-500" :
                              brief.riskScore >= 6 ? "bg-amber-500" :
                              brief.riskScore >= 4 ? "bg-yellow-500" : "bg-green-500"
                            )}
                            style={{ width: `${Math.min(brief.riskScore * 10, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{brief.riskScore.toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Voice Calls */}
          <div className="card">
            <div className="p-4 border-b border-midnight-800/50">
              <h2 className="font-display font-semibold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-violet-400" />
                Recent Calls
              </h2>
            </div>
            <div className="divide-y divide-midnight-800/40">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="p-3 hover:bg-midnight-800/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white">
                      {call.patient.firstName} {call.patient.lastName}
                    </p>
                    <span className={cn("badge text-[10px]", getStatusColor(call.status))}>
                      {call.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{call.direction === "OUTBOUND" ? "↗ Outbound" : "↙ Inbound"}</span>
                    {call.durationSeconds && (
                      <span>{Math.floor(call.durationSeconds / 60)}:{(call.durationSeconds % 60).toString().padStart(2, "0")}</span>
                    )}
                    {call.completionRate && (
                      <span>{Math.round(call.completionRate * 100)}% complete</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, iconColor, iconBg, highlight,
}: {
  icon: any; label: string; value: string | number; sub: string;
  iconColor: string; iconBg: string; highlight?: boolean;
}) {
  return (
    <div className={cn("stat-card", highlight && "border-brand-700/40 bg-brand-950/30")}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-display font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

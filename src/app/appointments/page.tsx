"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays, Clock, Video, AlertTriangle, ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { formatTime, formatDate, getStatusColor, getVisitTypeLabel, getRiskColor, cn } from "@/lib/utils";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("date", selectedDate.toISOString());
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/appointments?${params}`)
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedDate, statusFilter]);

  const changeDate = (delta: number) => {
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta);
      return n;
    });
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Appointments</h1>
          <p className="text-sm text-slate-400 mt-1">Schedule management and pre-visit status tracking</p>
        </div>
        <button className="btn-primary">
          <CalendarDays className="w-4 h-4" /> New Appointment
        </button>
      </div>

      {/* Date Picker & Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 card px-2 py-1">
          <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-midnight-800 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <span className={cn("text-sm font-medium px-3 py-1 rounded-lg", isToday ? "text-brand-300 bg-brand-950/50" : "text-white")}>
            {isToday ? "Today" : ""} {formatDate(selectedDate, { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-midnight-800 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <select
          className="input-field w-auto text-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PRE_VISIT_STARTED">Pre-Visit Started</option>
          <option value="PRE_VISIT_COMPLETE">Pre-Visit Complete</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <div className="ml-auto badge bg-midnight-800 text-slate-300">
          {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarDays className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No appointments found for this date</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt: any) => (
            <div key={appt.id} className="card-hover p-5 cursor-pointer group">
              <div className="flex items-start gap-4">
                {/* Time Block */}
                <div className="min-w-[80px] text-center flex-shrink-0">
                  <p className="text-lg font-mono font-bold text-white">{formatTime(appt.scheduledAt)}</p>
                  <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mt-0.5">
                    <Clock className="w-3 h-3" /> {appt.duration} min
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px h-16 bg-midnight-700/50 flex-shrink-0" />

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      {appt.patient.firstName} {appt.patient.lastName}
                    </h3>
                    <span className="text-xs font-mono text-slate-500">{appt.patient.mrn}</span>
                    {appt.visitType === "TELEHEALTH" && (
                      <Video className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {appt.reasonForVisit || getVisitTypeLabel(appt.visitType)}
                  </p>
                  {appt.chiefComplaint && (
                    <p className="text-xs text-slate-300 mt-1 italic">
                      CC: &ldquo;{appt.chiefComplaint}&rdquo;
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className={cn("badge text-[11px]", getStatusColor(appt.status))}>
                      {appt.status.replace(/_/g, " ")}
                    </span>
                    <span className="badge bg-midnight-800 text-slate-300 text-[11px]">
                      {getVisitTypeLabel(appt.visitType)}
                    </span>
                    {appt.patient.conditions?.slice(0, 2).map((c: string, i: number) => (
                      <span key={i} className="badge bg-midnight-800/60 text-slate-400 text-[11px]">{c}</span>
                    ))}
                  </div>
                </div>

                {/* Right side */}
                <div className="text-right flex-shrink-0 space-y-2">
                  <p className="text-xs text-slate-500">Dr. {appt.provider.lastName}</p>
                  <p className="text-[11px] text-slate-600">{appt.provider.specialty}</p>

                  {appt.preVisitBrief && (
                    <div className="mt-2">
                      <span className={cn("badge text-[10px]", getStatusColor(appt.preVisitBrief.status))}>
                        Brief: {appt.preVisitBrief.status}
                      </span>
                      {appt.preVisitBrief.riskScore && (
                        <div className={cn("badge text-[10px] mt-1 border", getRiskColor(appt.preVisitBrief.riskScore))}>
                          <AlertTriangle className="w-3 h-3 mr-0.5" />
                          {appt.preVisitBrief.riskScore.toFixed(1)}
                        </div>
                      )}
                    </div>
                  )}

                  {appt.voiceCall && (
                    <span className={cn("badge text-[10px]", getStatusColor(appt.voiceCall.status))}>
                      Call: {appt.voiceCall.status}
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

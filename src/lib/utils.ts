import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

export function getRiskColor(score: number): string {
  if (score >= 8) return "text-red-600 bg-red-50 border-red-200";
  if (score >= 6) return "text-amber-600 bg-amber-50 border-amber-200";
  if (score >= 4) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-green-600 bg-green-50 border-green-200";
}

export function getRiskLabel(score: number): string {
  if (score >= 8) return "High";
  if (score >= 6) return "Moderate";
  if (score >= 4) return "Low-Moderate";
  return "Low";
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: "bg-slate-100 text-slate-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    PRE_VISIT_STARTED: "bg-indigo-100 text-indigo-700",
    PRE_VISIT_COMPLETE: "bg-brand-100 text-brand-700",
    CHECKED_IN: "bg-teal-100 text-teal-700",
    IN_PROGRESS: "bg-purple-100 text-purple-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-gray-100 text-gray-500",
    NO_SHOW: "bg-red-100 text-red-700",
    // Brief
    PENDING: "bg-slate-100 text-slate-600",
    CALL_SCHEDULED: "bg-blue-100 text-blue-700",
    CALL_IN_PROGRESS: "bg-indigo-100 text-indigo-700",
    DATA_COLLECTED: "bg-cyan-100 text-cyan-700",
    ANALYZING: "bg-violet-100 text-violet-700",
    READY: "bg-brand-100 text-brand-700",
    DELIVERED: "bg-green-100 text-green-700",
    REVIEWED: "bg-emerald-100 text-emerald-800",
    EXPIRED: "bg-gray-100 text-gray-500",
    // Calls
    QUEUED: "bg-slate-100 text-slate-600",
    RINGING: "bg-amber-100 text-amber-700",
    VOICEMAIL: "bg-orange-100 text-orange-700",
    FAILED: "bg-red-100 text-red-700",
    NO_ANSWER: "bg-red-50 text-red-600",
    CALLBACK_REQUESTED: "bg-yellow-100 text-yellow-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

export function getCallTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PRE_VISIT: "Pre-Visit Intake",
    SCHEDULING: "Scheduling",
    INSURANCE_VERIFY: "Insurance Verification",
    FOLLOW_UP: "Follow-Up",
    GENERAL_INQUIRY: "General Inquiry",
    AFTER_HOURS: "After Hours",
  };
  return map[type] || type;
}

export function getVisitTypeLabel(type: string): string {
  const map: Record<string, string> = {
    NEW_PATIENT: "New Patient",
    FOLLOW_UP: "Follow-Up",
    ANNUAL_WELLNESS: "Annual Wellness",
    URGENT: "Urgent",
    TELEHEALTH: "Telehealth",
    PROCEDURE: "Procedure",
    PRE_OP: "Pre-Op",
    POST_OP: "Post-Op",
  };
  return map[type] || type;
}

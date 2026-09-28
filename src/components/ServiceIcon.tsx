"use client";

import {
  ClipboardList, Link2, Pill, CalendarDays, UserPlus, Heart, FlaskConical,
  Stethoscope, Bell, CalendarPlus, Shield, MessageCircle, Brain, Phone,
  AlertTriangle, CheckCircle2, Clock, FileText, Send, Lock, Globe,
  Mail, Zap, Database, Settings, Users,
} from "lucide-react";

const SERVICE_ICONS: Record<string, { icon: any; bg: string; ring: string }> = {
  pre_visit_intake:       { icon: ClipboardList, bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-500/20" },
  referral_coordinator:   { icon: Link2,         bg: "from-violet-500 to-purple-600", ring: "ring-violet-500/20" },
  refill_manager:         { icon: Pill,          bg: "from-rose-500 to-pink-600", ring: "ring-rose-500/20" },
  schedule_assistant:     { icon: CalendarDays,  bg: "from-blue-500 to-indigo-600", ring: "ring-blue-500/20" },
  new_patient_onboarding: { icon: UserPlus,      bg: "from-amber-500 to-orange-600", ring: "ring-amber-500/20" },
  chronic_disease_checkin: { icon: Heart,        bg: "from-red-500 to-rose-600", ring: "ring-red-500/20" },
  lab_results_review:     { icon: FlaskConical,  bg: "from-cyan-500 to-blue-600", ring: "ring-cyan-500/20" },
  post_visit_followup:    { icon: Stethoscope,   bg: "from-teal-500 to-emerald-600", ring: "ring-teal-500/20" },
  appointment_reminder:   { icon: Bell,          bg: "from-yellow-500 to-amber-600", ring: "ring-yellow-500/20" },
  appointment_scheduler:  { icon: CalendarPlus,  bg: "from-indigo-500 to-blue-600", ring: "ring-indigo-500/20" },
};

const GENERIC_ICONS: Record<string, { icon: any; bg: string; ring: string }> = {
  consent:    { icon: Shield,       bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-500/20" },
  verify:     { icon: Users,        bg: "from-blue-500 to-indigo-600", ring: "ring-blue-500/20" },
  appointment: { icon: CalendarDays, bg: "from-violet-500 to-purple-600", ring: "ring-violet-500/20" },
  complaint:  { icon: Stethoscope,  bg: "from-rose-500 to-pink-600", ring: "ring-rose-500/20" },
  symptoms:   { icon: ClipboardList, bg: "from-amber-500 to-orange-600", ring: "ring-amber-500/20" },
  ros:        { icon: Heart,        bg: "from-red-500 to-rose-600", ring: "ring-red-500/20" },
  medications: { icon: Pill,        bg: "from-cyan-500 to-blue-600", ring: "ring-cyan-500/20" },
  wellness:   { icon: Brain,        bg: "from-purple-500 to-violet-600", ring: "ring-purple-500/20" },
  additional: { icon: MessageCircle, bg: "from-teal-500 to-emerald-600", ring: "ring-teal-500/20" },
  submit:     { icon: CheckCircle2, bg: "from-emerald-500 to-green-600", ring: "ring-emerald-500/20" },
  voice:      { icon: Phone,        bg: "from-blue-500 to-indigo-600", ring: "ring-blue-500/20" },
  alert:      { icon: AlertTriangle, bg: "from-red-500 to-rose-600", ring: "ring-red-500/20" },
  pending:    { icon: Clock,        bg: "from-amber-500 to-yellow-600", ring: "ring-amber-500/20" },
  complete:   { icon: CheckCircle2, bg: "from-emerald-500 to-green-600", ring: "ring-emerald-500/20" },
  document:   { icon: FileText,     bg: "from-slate-500 to-slate-600", ring: "ring-slate-500/20" },
  send:       { icon: Send,         bg: "from-brand-500 to-brand-700", ring: "ring-brand-500/20" },
  security:   { icon: Lock,         bg: "from-amber-500 to-orange-600", ring: "ring-amber-500/20" },
  platform:   { icon: Globe,        bg: "from-blue-500 to-indigo-600", ring: "ring-blue-500/20" },
  email:      { icon: Mail,         bg: "from-cyan-500 to-teal-600", ring: "ring-cyan-500/20" },
  ai:         { icon: Zap,          bg: "from-purple-500 to-violet-600", ring: "ring-purple-500/20" },
  database:   { icon: Database,     bg: "from-blue-500 to-indigo-600", ring: "ring-blue-500/20" },
  settings:   { icon: Settings,     bg: "from-slate-500 to-slate-600", ring: "ring-slate-500/20" },
};

interface ServiceIconProps {
  type: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ServiceIcon({ type, size = "md", className = "" }: ServiceIconProps) {
  const config = SERVICE_ICONS[type] || GENERIC_ICONS[type] || { icon: Zap, bg: "from-slate-500 to-slate-600", ring: "ring-slate-500/20" };
  const Icon = config.icon;

  const sizes = {
    sm: { container: "w-7 h-7", icon: "w-3.5 h-3.5", ring: "ring-2" },
    md: { container: "w-10 h-10", icon: "w-5 h-5", ring: "ring-2" },
    lg: { container: "w-14 h-14", icon: "w-7 h-7", ring: "ring-4" },
  };

  const s = sizes[size];

  return (
    <div className={`${s.container} rounded-xl bg-gradient-to-br ${config.bg} ${s.ring} ${config.ring} flex items-center justify-center shadow-lg flex-shrink-0 ${className}`}>
      <Icon className={`${s.icon} text-white drop-shadow-sm`} />
    </div>
  );
}

/** Inline colored dot for service type — used in lists and badges */
export function ServiceDot({ type, className = "" }: { type: string; className?: string }) {
  const config = SERVICE_ICONS[type] || GENERIC_ICONS[type] || { bg: "from-slate-500 to-slate-600" };
  return <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${config.bg} inline-block ${className}`} />;
}

export { SERVICE_ICONS, GENERIC_ICONS };

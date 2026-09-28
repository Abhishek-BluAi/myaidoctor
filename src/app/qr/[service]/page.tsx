"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Stethoscope, ArrowRight } from "lucide-react";
import { ServiceIcon } from "@/components/ServiceIcon";

const SERVICES: Record<string, { label: string; desc: string }> = {
  pre_visit_intake: { label: "Pre-Visit Intake", desc: "Complete your pre-visit questionnaire" },
  referral_coordinator: { label: "Referral Coordinator", desc: "Process your referral request" },
  refill_manager: { label: "Medication Refill", desc: "Request a medication refill" },
  schedule_assistant: { label: "Schedule Assistant", desc: "Schedule or reschedule an appointment" },
  new_patient_onboarding: { label: "New Patient Onboarding", desc: "Complete your registration" },
  chronic_disease_checkin: { label: "Health Check-In", desc: "Monthly health check-in" },
  lab_results_review: { label: "Lab Results", desc: "Review your lab results" },
  post_visit_followup: { label: "Post-Visit Follow-Up", desc: "Post-visit recovery check" },
  appointment_reminder: { label: "Appointment Reminder", desc: "Confirm your appointment" },
  appointment_scheduler: { label: "Appointment Scheduler", desc: "Book a new appointment" },
};

export default function QRServicePage() {
  const { service } = useParams();
  const serviceId = service as string;
  const svc = SERVICES[serviceId];
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleStart() {
    if (!phone) return; setLoading(true);
    // Look up patient by phone, create link
    const res = await fetch("/api/messaging", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_by_phone", phone, serviceType: serviceId }),
    });
    const data = await res.json();
    if (data.link) { window.location.href = data.link.replace(window.location.origin, ""); }
    else setResult(data);
    setLoading(false);
  }

  if (!svc) return <div className="min-h-screen bg-midnight-950 flex items-center justify-center"><p className="text-red-400">Unknown service</p></div>;

  return (
    <div className="min-h-screen bg-midnight-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full px-4 space-y-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 ring-2 ring-brand-500/20 flex items-center justify-center shadow-lg">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-display font-bold text-white">MyAI<span className="text-brand-400">Doctor</span></span>
        </div>

        <ServiceIcon type={serviceId} size="lg" className="mx-auto" />
        <h1 className="text-xl font-display font-bold text-white">{svc.label}</h1>
        <p className="text-sm text-slate-400">{svc.desc}</p>

        <div className="card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Enter your phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(248) 555-1234" className="input-field text-center text-lg" />
          </div>
          <button onClick={handleStart} disabled={!phone || loading} className="btn-primary w-full justify-center py-3 disabled:opacity-40">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Get Started
          </button>
          {result?.error && <p className="text-xs text-red-400">{result.error}</p>}
        </div>
        <p className="text-[10px] text-slate-600">Your information is protected under HIPAA</p>
      </div>
    </div>
  );
}

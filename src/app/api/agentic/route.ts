import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const SERVICES = [
  { id: "appointment_reminder", label: "Appointment Reminder", priority: 1, trigger: "appointment_within_48hr" },
  { id: "pre_visit_intake", label: "Pre-Visit Clinical Intake", priority: 2, trigger: "appointment_within_48hr_no_intake" },
  { id: "refill_manager", label: "Refill Manager", priority: 3, trigger: "medication_refill_due" },
  { id: "chronic_disease_checkin", label: "Chronic Disease Check-In", priority: 4, trigger: "chronic_condition_monthly" },
  { id: "lab_results_review", label: "Lab Results Review", priority: 5, trigger: "lab_results_pending" },
  { id: "post_visit_followup", label: "Post-Visit Follow-Up", priority: 6, trigger: "visit_within_48hr_past" },
  { id: "referral_coordinator", label: "Referral Coordinator", priority: 7, trigger: "referral_pending" },
  { id: "schedule_assistant", label: "Schedule Assistant", priority: 8, trigger: "no_upcoming_appointment" },
  { id: "new_patient_onboarding", label: "New Patient Onboarding", priority: 9, trigger: "new_patient_no_history" },
  { id: "appointment_scheduler", label: "Appointment Scheduler", priority: 10, trigger: "overdue_for_visit" },
];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ── Analyze all patients and decide what to send ──────
  if (action === "analyze") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const in48hr = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const ago48hr = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const patients = await prisma.patient.findMany({
      include: {
        appointments: { orderBy: { scheduledAt: "asc" }, include: { preVisitBrief: { select: { id: true, status: true } }, provider: { select: { firstName: true, lastName: true } } } },
        messageLinks: { where: { sentAt: { gte: ago30d } }, orderBy: { sentAt: "desc" }, take: 10 },
      },
    });

    const recommendations: any[] = [];

    for (const patient of patients) {
      const upcoming = patient.appointments.filter((a: any) => new Date(a.scheduledAt) >= now && new Date(a.scheduledAt) <= in48hr && a.status !== "CANCELLED");
      const recentPast = patient.appointments.filter((a: any) => new Date(a.scheduledAt) >= ago48hr && new Date(a.scheduledAt) < now);
      const hasIntake = upcoming.some((a: any) => a.preVisitBrief?.status === "READY");
      const recentLinks = patient.messageLinks.map((l: any) => l.serviceType);
      const conditions = (patient.conditions as string[]) || [];
      const medications = (patient.medications as string[]) || [];
      const hasChronic = conditions.some((c: any) => /diabetes|hypertension|copd|chf|asthma|heart failure/i.test(c));
      const isNewPatient = patient.appointments.length <= 1;
      const noUpcoming = patient.appointments.filter((a: any) => new Date(a.scheduledAt) >= now).length === 0;

      const services: { serviceId: string; reason: string; priority: number; appointmentId?: string }[] = [];

      // Appointment reminder for upcoming in 24-48hr
      for (const appt of upcoming) {
        if (!recentLinks.includes("appointment_reminder")) {
          services.push({ serviceId: "appointment_reminder", reason: `Appointment with Dr. ${appt.provider?.lastName} on ${new Date(appt.scheduledAt).toLocaleDateString()}`, priority: 1, appointmentId: appt.id });
        }
      }

      // Pre-visit intake if upcoming and no intake completed
      for (const appt of upcoming) {
        if (!hasIntake && !recentLinks.includes("pre_visit_intake")) {
          services.push({ serviceId: "pre_visit_intake", reason: `No intake completed for appointment on ${new Date(appt.scheduledAt).toLocaleDateString()}`, priority: 2, appointmentId: appt.id });
        }
      }

      // Post-visit follow-up for recent visits
      for (const appt of recentPast) {
        if (!recentLinks.includes("post_visit_followup")) {
          services.push({ serviceId: "post_visit_followup", reason: `Follow up on visit ${new Date(appt.scheduledAt).toLocaleDateString()}`, priority: 6, appointmentId: appt.id });
        }
      }

      // Chronic disease check-in (monthly)
      if (hasChronic && !recentLinks.includes("chronic_disease_checkin")) {
        services.push({ serviceId: "chronic_disease_checkin", reason: `Monthly check-in for ${conditions.filter(c => /diabetes|hypertension|copd/i.test(c)).join(", ")}`, priority: 4 });
      }

      // Medication refill check
      if (medications.length > 0 && !recentLinks.includes("refill_manager")) {
        const needsRefill = medications.length >= 3;
        if (needsRefill) services.push({ serviceId: "refill_manager", reason: `${medications.length} active medications — refill check`, priority: 3 });
      }

      // New patient onboarding
      if (isNewPatient && !recentLinks.includes("new_patient_onboarding")) {
        services.push({ serviceId: "new_patient_onboarding", reason: "New patient — needs complete medical history", priority: 9 });
      }

      // No upcoming appointment
      if (noUpcoming && !recentLinks.includes("schedule_assistant") && patient.appointments.length > 0) {
        services.push({ serviceId: "schedule_assistant", reason: "No upcoming appointments scheduled", priority: 8 });
      }

      if (services.length > 0) {
        services.sort((a, b) => a.priority - b.priority);
        recommendations.push({
          patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, phone: patient.phone, conditions, medications: medications.length },
          services,
          totalServices: services.length,
        });
      }
    }

    recommendations.sort((a, b) => b.totalServices - a.totalServices);

    return NextResponse.json({
      analyzed: patients.length,
      patientsWithActions: recommendations.length,
      recommendations,
      timestamp: now.toISOString(),
    });
  }

  // ── Execute: send messages in sequence ────────────────
  if (action === "execute") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { patientId, services, channel } = body;
    if (!patientId || !services?.length) return NextResponse.json({ error: "patientId and services required" }, { status: 400 });

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const results = [];

    // Send first message immediately, queue rest as sequential
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      const linkToken = randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      await prisma.messageLink.create({
        data: {
          token: linkToken, patientId, appointmentId: svc.appointmentId || null,
          serviceType: svc.serviceId, channel: channel || "sms",
          phone: patient.phone, status: i === 0 ? "sent" : "queued",
          expiresAt, sentBy: "agentic_ai",
          metadata: { order: i + 1, total: services.length, previousToken: i > 0 ? results[i - 1]?.token : null, reason: svc.reason },
        },
      });

      results.push({ serviceId: svc.serviceId, token: linkToken, order: i + 1, status: i === 0 ? "sent" : "queued_waiting_for_previous" });
    }

    return NextResponse.json({ success: true, patient: `${patient.firstName} ${patient.lastName}`, queued: results.length, sequence: results });
  }

  // ── Execute all recommendations ───────────────────────
  if (action === "execute_all") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { recommendations, channel } = body;
    let totalSent = 0;

    for (const rec of recommendations) {
      const patient = await prisma.patient.findUnique({ where: { id: rec.patient.id } });
      if (!patient) continue;
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      for (let i = 0; i < rec.services.length; i++) {
        const svc = rec.services[i];
        const linkToken = randomUUID().replace(/-/g, "");
        await prisma.messageLink.create({
          data: {
            token: linkToken, patientId: rec.patient.id, appointmentId: svc.appointmentId || null,
            serviceType: svc.serviceId, channel: channel || "sms",
            phone: patient.phone, status: i === 0 ? "sent" : "queued",
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), sentBy: "agentic_ai",
            metadata: { order: i + 1, reason: svc.reason },
          },
        });
        totalSent++;
      }
    }

    return NextResponse.json({ success: true, totalPatients: recommendations.length, totalMessages: totalSent });
  }

  // ── Generate QR codes for services ────────────────────
  if (action === "qr_codes") {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const qrData = SERVICES.map(s => ({
      serviceId: s.id,
      label: s.label,
      url: `${baseUrl}/qr/${s.id}`,
    }));
    return NextResponse.json({ services: qrData, baseUrl });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

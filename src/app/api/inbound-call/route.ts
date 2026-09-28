import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";


/** Match patient by phone — handles all formats */
async function findPatientByPhone(phone: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 4) return null;
  const last4 = digits.slice(-4);
  // Search by last 4 digits, then verify full match
  const candidates = await prisma.patient.findMany({ where: { phone: { contains: last4 } } });
  return candidates.find(p => p.phone.replace(/\D/g, "").slice(-10) === digits) || null;
}

const INTENT_KEYWORDS: Record<string, string[]> = {
  refill_manager: ["refill", "prescription", "medication", "medicine", "pharmacy", "pills", "ran out", "need more"],
  schedule_assistant: ["schedule", "reschedule", "cancel", "appointment", "book", "move my", "change my"],
  referral_coordinator: ["referral", "specialist", "refer", "dermatologist", "cardiologist", "orthopedic"],
  lab_results_review: ["lab", "results", "blood work", "test results", "labs"],
  pre_visit_intake: ["intake", "pre-visit", "questionnaire", "before my appointment", "paperwork"],
  appointment_reminder: ["when is my", "appointment", "what time", "confirm"],
  chronic_disease_checkin: ["check-in", "diabetes", "blood pressure", "sugar", "a1c"],
  post_visit_followup: ["follow up", "after my visit", "still feeling", "not better"],
  new_patient_onboarding: ["new patient", "first time", "never been", "register", "sign up"],
  appointment_scheduler: ["see a doctor", "need to come in", "available", "open slots", "walk-in"],
};

const SERVICE_LABELS: Record<string, string> = {
  pre_visit_intake: "Pre-Visit Intake", appointment_reminder: "Appointment Reminder",
  refill_manager: "Medication Refill", schedule_assistant: "Schedule Assistant",
  referral_coordinator: "Referral Coordinator", post_visit_followup: "Post-Visit Follow-Up",
  lab_results_review: "Lab Results Review", new_patient_onboarding: "New Patient Onboarding",
  chronic_disease_checkin: "Chronic Disease Check-In", appointment_scheduler: "Appointment Scheduler",
  custom: "Custom Message",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ── Webhook: incoming call from phone system ──────────
  if (action === "webhook" || body.event === "call.received" || body.type === "inbound") {
    const callerPhone = body.from || body.caller_phone || body.customer?.number || "";
    const clinicPhone = body.to || body.clinic_phone || body.phone_number || "";
    const transcript = body.transcript || body.message || "";

    // Identify patient
    const phone10 = callerPhone.replace(/\D/g, "").slice(-10);
    const patient = await findPatientByPhone(callerPhone);

    // Detect intent from transcript
    const intent = transcript ? detectIntent(transcript) : null;

    // Create inbound call record
    const call = await prisma.inboundCall.create({
      data: {
        callerPhone, clinicPhone,
        patientId: patient?.id || null,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : null,
        intent, customMessage: intent === "custom" ? transcript : null,
        status: patient ? "identified" : "received",
        callDuration: body.duration || null,
        metadata: { source: body.source || "webhook", raw: body },
      },
    });

    // Auto-send link if patient identified and intent detected
    if (patient && intent && intent !== "custom") {
      const linkToken = randomUUID().replace(/-/g, "");
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      await prisma.messageLink.create({
        data: {
          token: linkToken, patientId: patient.id,
          serviceType: intent, channel: "sms",
          phone: callerPhone, status: "sent",
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
          sentBy: "inbound_call_agent",
        },
      });
      await prisma.inboundCall.update({
        where: { id: call.id },
        data: { status: "link_sent", linkToken, processedAt: new Date() },
      });

      return NextResponse.json({ handled: true, patient: patient.firstName, intent, linkSent: true, link: `${baseUrl}/m/${linkToken}` });
    }

    return NextResponse.json({ handled: true, callId: call.id, patientIdentified: !!patient, intentDetected: intent });
  }

  // ── Manual: process a call from dashboard ─────────────
  if (action === "process") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { callId, serviceType, customMessage, channel } = body;
    const call = await prisma.inboundCall.findUnique({ where: { id: callId } });
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    const phone10 = call.callerPhone.replace(/\D/g, "").slice(-10);
    let patient = call.patientId ? await prisma.patient.findUnique({ where: { id: call.patientId } }) : null;
    if (!patient) patient = await findPatientByPhone(call.callerPhone);

    if (serviceType === "custom") {
      await prisma.inboundCall.update({
        where: { id: callId },
        data: { intent: "custom", customMessage: customMessage || call.customMessage, status: "completed", processedAt: new Date() },
      });
      // Send custom SMS if patient found
      if (patient) {
        const linkToken = randomUUID().replace(/-/g, "");
        await prisma.messageLink.create({
          data: {
            token: linkToken, patientId: patient.id,
            serviceType: "custom", channel: channel || "sms",
            phone: call.callerPhone, status: "sent",
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
            sentBy: token.id as string,
            metadata: { customMessage },
          },
        });
      }
      return NextResponse.json({ success: true, type: "custom", message: "Custom message recorded and patient notified" });
    }

    if (!patient) return NextResponse.json({ error: "Patient not found for this phone number" }, { status: 404 });

    const linkToken = randomUUID().replace(/-/g, "");
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    await prisma.messageLink.create({
      data: {
        token: linkToken, patientId: patient.id,
        serviceType, channel: channel || "sms",
        phone: call.callerPhone, status: "sent",
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        sentBy: token.id as string,
      },
    });

    await prisma.inboundCall.update({
      where: { id: callId },
      data: { intent: serviceType, status: "link_sent", linkToken, processedAt: new Date(), patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}` },
    });

    return NextResponse.json({ success: true, link: `${baseUrl}/m/${linkToken}`, service: SERVICE_LABELS[serviceType] });
  }

  // ── Simulate an inbound call (for testing) ────────────
  if (action === "simulate") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { callerPhone, transcript } = body;
    const phone10 = (callerPhone || "").replace(/\D/g, "").slice(-10);
    const patient = await findPatientByPhone(callerPhone);
    const intent = transcript ? detectIntent(transcript) : null;

    const call = await prisma.inboundCall.create({
      data: {
        callerPhone: callerPhone || "+12485550000", clinicPhone: "+12485551000",
        patientId: patient?.id || null,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : null,
        intent, customMessage: intent === "custom" || !intent ? transcript : null,
        status: patient ? "identified" : "received",
        metadata: { source: "simulation" },
      },
    });

    return NextResponse.json({ success: true, callId: call.id, patient: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", intent: intent || "unknown" });
  }

  // ── List inbound calls ────────────────────────────────
  if (action === "list") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const calls = await prisma.inboundCall.findMany({
      orderBy: { receivedAt: "desc" }, take: 50,
    });
    return NextResponse.json({ calls });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

function detectIntent(transcript: string): string | null {
  const lower = transcript.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestMatch = intent; }
  }

  return bestMatch || (transcript.length > 10 ? "custom" : null);
}

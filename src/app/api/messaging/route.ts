import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const SERVICE_TYPES = {
  pre_visit_intake: { label: "Pre-Visit Intake", emoji: "📋", message: "Complete your pre-visit questionnaire before your upcoming appointment." },
  referral_coordinator: { label: "Referral Request", emoji: "🔗", message: "We have a referral update for you. Tap to review and provide information." },
  refill_manager: { label: "Medication Refill", emoji: "💊", message: "Request or manage your medication refill." },
  schedule_assistant: { label: "Appointment Scheduling", emoji: "📅", message: "Schedule, reschedule, or manage your appointment." },
  new_patient_onboarding: { label: "New Patient Registration", emoji: "👋", message: "Welcome! Complete your registration and medical history." },
  chronic_disease_checkin: { label: "Health Check-In", emoji: "❤️", message: "Time for your monthly health check-in. Let us know how you're doing." },
  lab_results_review: { label: "Lab Results", emoji: "🔬", message: "Your lab results are ready. Tap to review and discuss." },
  post_visit_followup: { label: "Post-Visit Follow-Up", emoji: "🩺", message: "How are you feeling after your visit? We'd like to check in." },
  appointment_reminder: { label: "Appointment Reminder", emoji: "⏰", message: "Reminder: You have an upcoming appointment. Tap to confirm." },
  appointment_scheduler: { label: "Schedule Appointment", emoji: "📆", message: "It's time to schedule your next appointment." },
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ── Send a message link ────────────────────────────────
  if (action === "send") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { patientId, appointmentId, serviceType, channel } = body;
    if (!patientId || !serviceType) return NextResponse.json({ error: "patientId and serviceType required" }, { status: 400 });

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const service = SERVICE_TYPES[serviceType as keyof typeof SERVICE_TYPES];
    if (!service) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

    // Generate secure token
    const linkToken = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    await prisma.messageLink.create({
      data: {
        token: linkToken,
        patientId, appointmentId: appointmentId || null,
        serviceType, channel: channel || "sms",
        phone: patient.phone, status: "sent",
        expiresAt, sentBy: token.id as string,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const link = `${baseUrl}/m/${linkToken}`;
    const smsBody = `${service.emoji} MyAIDoctor: ${service.message}\n\nTap here: ${link}\n\nThis link expires in 72 hours.`;

    // Send via configured provider
    const smsResult = await sendSMS(patient.phone, smsBody, channel || "sms");

    return NextResponse.json({ success: true, token: linkToken, link, smsResult, service: service.label });
  }

  // ── Bulk send (for AI agents) ──────────────────────────
  if (action === "bulk_send") {
    const { patients, serviceType, appointmentIds } = body;
    if (!patients?.length || !serviceType) return NextResponse.json({ error: "patients array and serviceType required" }, { status: 400 });

    const results = [];
    for (let i = 0; i < patients.length; i++) {
      const linkToken = randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const service = SERVICE_TYPES[serviceType as keyof typeof SERVICE_TYPES];
      if (!service) continue;

      await prisma.messageLink.create({
        data: {
          token: linkToken, patientId: patients[i].id,
          appointmentId: appointmentIds?.[i] || null,
          serviceType, channel: "sms", phone: patients[i].phone,
          status: "sent", expiresAt, sentBy: "system",
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const link = `${baseUrl}/m/${linkToken}`;
      const smsBody = `${service.emoji} MyAIDoctor: ${service.message}\n\nTap here: ${link}`;
      await sendSMS(patients[i].phone, smsBody, "sms");
      results.push({ patientId: patients[i].id, sent: true });
    }

    return NextResponse.json({ success: true, sent: results.length, results });
  }

  // ── Validate token ─────────────────────────────────────
  if (action === "validate") {
    const { token: linkToken } = body;
    const link = await prisma.messageLink.findUnique({
      where: { token: linkToken },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
    });

    if (!link) return NextResponse.json({ valid: false, error: "Invalid link" });
    if (link.expiresAt < new Date()) return NextResponse.json({ valid: false, error: "This link has expired" });
    if (link.status === "completed") return NextResponse.json({ valid: false, error: "This intake has already been completed" });

    // Mark as opened
    if (link.status === "sent") {
      await prisma.messageLink.update({ where: { token: linkToken }, data: { status: "opened", openedAt: new Date() } });
    }

    const service = SERVICE_TYPES[link.serviceType as keyof typeof SERVICE_TYPES];
    return NextResponse.json({
      valid: true, serviceType: link.serviceType, serviceLabel: service?.label,
      patient: link.patient, appointmentId: link.appointmentId,
    });
  }

  // ── Mark completed ─────────────────────────────────────
  if (action === "complete") {
    const { token: linkToken } = body;
    await prisma.messageLink.update({
      where: { token: linkToken },
      data: { status: "completed", completedAt: new Date() },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  // ── Get sent messages (for dashboard) ──────────────────
  if (action === "list") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const links = await prisma.messageLink.findMany({
      include: { patient: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { sentAt: "desc" }, take: 50,
    });
    return NextResponse.json({ links });
  }

  // ── Get service types ──────────────────────────────────
  if (action === "services") {
    return NextResponse.json({ services: Object.entries(SERVICE_TYPES).map(([id, s]) => ({ id, ...s })) });
  }

  // ── Send by phone (QR code flow — no auth required) ───
  if (action === "send_by_phone") {
    const { phone, serviceType } = body;
    if (!phone || !serviceType) return NextResponse.json({ error: "phone and serviceType required" }, { status: 400 });

    const digits = phone.replace(/\D/g, "").slice(-10);
    const last4 = digits.slice(-4);
    const candidates = await prisma.patient.findMany({ where: { phone: { contains: last4 } } });
    const patient = candidates.find(p => p.phone.replace(/\D/g, "").slice(-10) === digits) || null;
    if (!patient) return NextResponse.json({ error: "No patient found with this phone number. Please contact the front desk." }, { status: 404 });

    const linkToken = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.messageLink.create({
      data: { token: linkToken, patientId: patient.id, serviceType, channel: "qr_scan", phone: patient.phone, status: "opened", openedAt: new Date(), expiresAt, sentBy: "qr_scan" },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return NextResponse.json({ success: true, link: `${baseUrl}/m/${linkToken}` });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ── SMS Sending ──────────────────────────────────────────

async function sendSMS(to: string, body: string, channel: string): Promise<any> {
  const config = await getSMSConfig();

  if (!config.provider) {
    console.log(`[SMS] (mock) To: ${to}\n${body}`);
    return { mock: true, message: "SMS logged to console (no provider configured)" };
  }

  if (config.provider === "twilio") return sendViaTwilio(config, to, body);
  if (config.provider === "telnyx") return sendViaTelnyx(config, to, body);
  return { error: "Unknown SMS provider" };
}

async function getSMSConfig() {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["sms_provider", "twilio_account_sid", "twilio_auth_token", "twilio_phone_number", "telnyx_api_key", "telnyx_phone_number"] } },
    });
    const s: Record<string, string> = {};
    rows.forEach(r => { s[r.key] = r.value; });
    return {
      provider: s.sms_provider || process.env.SMS_PROVIDER || "",
      twilioSid: s.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || "",
      twilioToken: s.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || "",
      twilioPhone: s.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || "",
      telnyxKey: s.telnyx_api_key || process.env.TELNYX_API_KEY || "",
      telnyxPhone: s.telnyx_phone_number || process.env.TELNYX_PHONE_NUMBER || "",
    };
  } catch {
    return { provider: "", twilioSid: "", twilioToken: "", twilioPhone: "", telnyxKey: "", telnyxPhone: "" };
  }
}

async function sendViaTwilio(config: any, to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: config.twilioPhone, Body: body }).toString(),
  });
  return res.json();
}

async function sendViaTelnyx(config: any, to: string, body: string) {
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.telnyxKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.telnyxPhone, to, text: body }),
  });
  return res.json();
}

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { buildClaudeSystemPrompt } from "@/lib/clinical/conversation";
import { generateSOAPNote, generateBrief } from "@/lib/clinical/engine";
import { MockEHRAdapter, createAdapter } from "@/lib/ehr/adapters";
import { buildFHIRBundle } from "@/lib/fhir/resources";

/**
 * Voice Call Integration
 *
 * Supports two providers (configure in Super Admin → Settings → Voice AI):
 *
 * 1. Vapi.ai — CHEAPEST at ~$0.05/min all-in (telephony + STT + TTS + orchestration)
 *    - Sign up: https://vapi.ai → get API key
 *    - Set webhook URL in Vapi dashboard: YOUR_DOMAIN/api/voice-call
 *
 * 2. Retell AI — ~$0.07-0.10/min
 *    - Sign up: https://retellai.com → get API key + create agent
 *    - Already partially integrated in the platform
 *
 * Per-call cost estimate (10-min intake):
 *   Vapi.ai:   ~$0.50/call
 *   Retell AI: ~$0.70-1.00/call
 */

async function getVoiceConfig() {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["voice_provider", "voice_api_key", "voice_phone_number", "voice_agent_id", "voice_ai_retell_api_key", "voice_ai_retell_agent_id"] } },
    });
    const s: Record<string, string> = {};
    rows.forEach(r => { s[r.key] = r.value; });

    return {
      provider: s.voice_provider || process.env.VOICE_PROVIDER || "vapi",
      vapiKey: s.voice_api_key || process.env.VAPI_API_KEY || "",
      retellKey: s.voice_ai_retell_api_key || process.env.RETELL_API_KEY || "",
      retellAgentId: s.voice_ai_retell_agent_id || "",
      phoneNumber: s.voice_phone_number || process.env.VAPI_PHONE_NUMBER_ID || process.env.VOICE_PHONE_NUMBER || "",
      vapiAgentId: s.voice_agent_id || process.env.VAPI_AGENT_ID || "",
    };
  } catch {
    return {
      provider: process.env.VOICE_PROVIDER || "vapi",
      vapiKey: process.env.VAPI_API_KEY || "",
      retellKey: process.env.RETELL_API_KEY || "",
      retellAgentId: "",
      phoneNumber: process.env.VAPI_PHONE_NUMBER_ID || process.env.VOICE_PHONE_NUMBER || "",
      vapiAgentId: process.env.VAPI_AGENT_ID || "",
    };
  }
}

type OutboundCallInput = {
  patient: any;
  appointmentId: string | null;
  phoneNumber: string;
  callRequestId: string;
};

async function buildPatientVoiceContext(patient: any, appointmentId: string | null) {
  const appointment = appointmentId
    ? await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { provider: true, clinic: true },
    })
    : null;

  if (appointment && appointment.patientId !== patient.id) {
    throw new Error("Appointment does not belong to this patient");
  }

  const upcomingAppointments = await prisma.appointment.findMany({
    where: { patientId: patient.id, scheduledAt: { gte: new Date() }, status: { not: "CANCELLED" } },
    orderBy: { scheduledAt: "asc" },
    take: 10,
    include: { provider: true, clinic: true },
  });

  const pastAppointments = await prisma.appointment.findMany({
    where: {
      patientId: patient.id,
      ...(appointment ? { scheduledAt: { lt: appointment.scheduledAt } } : {}),
    },
    orderBy: { scheduledAt: "desc" },
    take: 5,
    include: { preVisitBrief: true },
  });

  const context = {
    personalDetails: {
      name: `${patient.firstName} ${patient.lastName}`,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      preferredLanguage: patient.preferredLanguage,
      phone: patient.phone,
      email: patient.email,
    },
    medicalDetails: {
      allergies: patient.allergies,
      medications: patient.medications,
      conditions: patient.conditions,
      upcomingAppointment: appointment ? {
        date: appointment.scheduledAt,
        visitType: appointment.visitType,
        reasonForVisit: appointment.reasonForVisit,
        chiefComplaint: appointment.chiefComplaint,
        provider: `${appointment.provider.firstName} ${appointment.provider.lastName}`,
        clinic: appointment.clinic?.name,
      } : null,
      upcomingAppointments: upcomingAppointments.map((upcoming) => ({
        id: upcoming.id,
        date: upcoming.scheduledAt,
        durationMinutes: upcoming.duration,
        status: upcoming.status,
        visitType: upcoming.visitType,
        reasonForVisit: upcoming.reasonForVisit,
        chiefComplaint: upcoming.chiefComplaint,
        provider: upcoming.provider ? `${upcoming.provider.firstName} ${upcoming.provider.lastName}` : "Provider not assigned",
        clinic: upcoming.clinic?.name,
      })),
    },
    previousRecords: pastAppointments.map((pastAppointment) => ({
      date: pastAppointment.scheduledAt,
      visitType: pastAppointment.visitType,
      reasonForVisit: pastAppointment.reasonForVisit,
      summary: pastAppointment.preVisitBrief?.clinicalSummary || "No clinical summary available",
    })),
  };

  const systemPrompt = buildClaudeSystemPrompt({
    phase: "consent",
    phaseStep: 0,
    data: {
      patientDetails: context.personalDetails,
      upcomingAppointment: context.medicalDetails.upcomingAppointment,
      pastHistory: context.previousRecords,
    },
    consentGiven: false,
    complete: false,
  });

  return {
    context,
    systemPrompt: `${systemPrompt}

VOICE CALL RULES:
- This is a live phone conversation. Speak in short, natural sentences and ask one question at a time.
- Begin by confirming you are speaking with the patient, then explain that this is a pre-visit intake and obtain consent before discussing or collecting medical information.
- You have access to the patient's upcomingAppointments and upcomingAppointment in the private context. Use those records to answer appointment questions accurately. If the patient asks for an appointment with a named provider, search the provided list by provider name and state the date, time, visit type, clinic, and status when found. Never say you cannot fetch appointment details when the details are present in the context.
- When checking records or preparing an answer, tell the patient what you are doing in a brief progress phrase, such as "Let me check your upcoming appointments" or "I am reviewing that appointment now." Then answer as soon as the lookup is complete.
- If no matching appointment exists in the provided context, say that no matching appointment was found and offer to help with scheduling. Do not invent an appointment.
- Use the patient context below to personalize the conversation, but never read the full record aloud unless the patient asks.
- Treat the previous records as background only. Never invent, diagnose, prescribe, or change medication instructions.
- If the patient reports chest pain, severe trouble breathing, stroke symptoms, severe bleeding, loss of consciousness, or immediate danger, tell them to hang up and call 911 now. Do not continue the intake.
- For urgent but non-emergency concerns, advise the patient to contact the clinic and clearly mark the concern for the provider.
- Repeat important names, dates, medication names, and numbers for confirmation. Say when you are unsure.
- End by briefly summarizing what was collected, asking whether anything is missing, and explaining that the provider will review it.

PATIENT CONTEXT (private; use only for this call):
${JSON.stringify(context, null, 2)}`,
  };
}

async function startOutboundCall({ patient, appointmentId, phoneNumber, callRequestId }: OutboundCallInput) {
  const config = await getVoiceConfig();

  try {
    const { context, systemPrompt } = await buildPatientVoiceContext(patient, appointmentId);
    await prisma.callRequest.update({
      where: { id: callRequestId },
      data: { phoneNumber, provider: config.provider, status: "QUEUED", errorMessage: null },
    });

    if (config.provider === "vapi" && config.vapiKey) {
      return triggerVapiCall(config, phoneNumber, appointmentId, systemPrompt, callRequestId, context);
    }
    if (config.provider === "retell" && config.retellKey) {
      return triggerRetellCall(config, phoneNumber, appointmentId, callRequestId);
    }

    throw new Error("No voice provider configured. Set VAPI_API_KEY and VAPI_PHONE_NUMBER_ID.");
  } catch (error: any) {
    await prisma.callRequest.update({
      where: { id: callRequestId },
      data: { status: "FAILED", errorMessage: error.message },
    }).catch(() => { });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "request") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id || !token.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const patient = await prisma.patient.findFirst({ where: { email: token.email as string } });
    if (!patient) return NextResponse.json({ error: "Patient record not found" }, { status: 404 });

    const { appointmentId } = body;
    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      if (appointment.patientId !== patient.id) return NextResponse.json({ error: "Appointment does not belong to this patient" }, { status: 403 });
    }

    const callRequest = await prisma.callRequest.create({
      data: {
        userId: token.id as string,
        patientId: patient.id,
        appointmentId: appointmentId || null,
        phoneNumber: patient.phone,
        status: "QUEUED",
      },
    });
    return startOutboundCall({
      patient,
      appointmentId: appointmentId || null,
      phoneNumber: patient.phone,
      callRequestId: callRequest.id,
    });
  }

  // ── Trigger outbound call ──────────────────────────────
  if (action === "call") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id || !token.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { appointmentId, phoneNumber } = body;
    if (!phoneNumber) return NextResponse.json({ error: "phoneNumber required" }, { status: 400 });

    const patient = await prisma.patient.findFirst({ where: { email: token.email as string } });
    if (!patient) return NextResponse.json({ error: "Patient record not found" }, { status: 404 });

    const callRequest = body.callRequestId
      ? await prisma.callRequest.updateMany({
        where: { id: body.callRequestId, userId: token.id as string, patientId: patient.id },
        data: { phoneNumber, status: "QUEUED", errorMessage: null },
      }).then(async result => {
        if (result.count === 0) throw new Error("Call request not found");
        return prisma.callRequest.findUniqueOrThrow({ where: { id: body.callRequestId } });
      })
      : await prisma.callRequest.create({
        data: { userId: token.id as string, patientId: patient.id, appointmentId: appointmentId || null, phoneNumber, status: "QUEUED" },
      });
    return startOutboundCall({ patient, appointmentId: appointmentId || null, phoneNumber, callRequestId: callRequest.id });
  }

  // ── Check voice service status ─────────────────────────
  if (action === "status") {
    const config = await getVoiceConfig();
    const hasVapi = !!config.vapiKey;
    const hasRetell = !!config.retellKey;

    return NextResponse.json({
      configured: hasVapi || hasRetell,
      provider: hasVapi ? "Vapi.ai" : hasRetell ? "Retell AI" : "None",
      phoneNumber: config.phoneNumber || "Not configured",
      costPerMin: hasVapi ? "$0.05" : hasRetell ? "$0.07-0.10" : "N/A",
    });
  }


  // ── Vapi.ai inbound call (assistant-request) ─────────────
  if (body.message?.type === "assistant-request") {
    return handleVapiAssistantRequest(body);
  }

  // ── Vapi.ai webhook (call completed) ───────────────────
  if (action === "vapi_webhook" || body.message?.type === "end-of-call-report") {
    return handleVapiWebhook(body);
  }

  // ── Retell webhook (call completed) ────────────────────
  if (action === "retell_webhook" || body.event === "call_ended") {
    return handleRetellWebhook(body);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ── Vapi.ai ──────────────────────────────────────────────

async function triggerVapiCall(config: any, phone: string, appointmentId: string | null, systemPrompt: string, callRequestId: string, patientContext: Record<string, any>) {
  try {
    const payload: any = {
      phoneNumberId: config.phoneNumber,
      customer: { number: phone },
      metadata: { appointmentId: appointmentId || "", callRequestId },
    };

    if (config.vapiAgentId) {
      payload.assistantId = config.vapiAgentId;
      payload.assistantOverrides = {
        firstMessage: appointmentId
          ? "Hi, this is Riley from MyAIDoctor. I am calling to help prepare for your upcoming appointment. Before we begin, do I have your permission to continue?"
          : "Hi, this is Riley from MyAIDoctor. How can I help you today?",
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }],
        },
        variableValues: {
          patientContext: JSON.stringify(patientContext),
          appointmentId: appointmentId || "",
          callRequestId,
        },
      };
    } else {
      payload.assistant = {
        model: {
          provider: "anthropic",
          model: "claude-3-5-sonnet-20241022",
          messages: [{ role: "system", content: systemPrompt }]
        },
        voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
        firstMessage: appointmentId
          ? "Hi there! I'm your MyAIDoctor pre-visit assistant. I'm calling to help prepare for your upcoming appointment. This should take about 8 to 12 minutes. Before we begin, I need to let you know that your responses will be shared with your healthcare provider and stored securely. Do you understand and agree to proceed?"
          : "Hi there! I am the MyAIDoctor assistant. How can I help you today?",
        endCallMessage: appointmentId
          ? "Thank you for completing your pre-visit intake! Your provider will review everything before your appointment. Take care!"
          : "Thank you for calling. Take care!",
        recordingEnabled: true,
        transcriptionEnabled: true,
      };
    }

    const res = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.vapiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[VAPI ERROR] ${res.status}: ${err}`);
      await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "FAILED", errorMessage: `Vapi error: ${res.status}` } });
      return NextResponse.json({ error: `Vapi error: ${res.status}`, details: err.slice(0, 1000) }, { status: 500 });
    }

    const data = await res.json();
    await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "RINGING", externalCallId: data.id, startedAt: new Date() } });
    return NextResponse.json({ success: true, callId: data.id, provider: "Vapi.ai", message: "Call initiated — patient will receive a call shortly" });
  } catch (e: any) {
    console.error("[VAPI CATCH ERROR]", e, "CAUSE:", e.cause);
    await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "FAILED", errorMessage: e.message } }).catch(() => { });
    return NextResponse.json({ error: e.message, cause: e.cause ? String(e.cause) : undefined }, { status: 500 });
  }
}

async function handleVapiWebhook(body: any) {
  const report = body.message || body;
  const appointmentId = report.metadata?.appointmentId || report.call?.metadata?.appointmentId;
  const callRequestId = report.metadata?.callRequestId || report.call?.metadata?.callRequestId;
  const transcript = report.transcript || report.artifact?.transcript || "";

  if (appointmentId && transcript) {
    await saveCallIntake(appointmentId, transcript, "vapi");
  }
  if (callRequestId) {
    await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "COMPLETED", completedAt: new Date() } }).catch(() => { });
  }

  return NextResponse.json({ ok: true });
}

// ── Retell AI ────────────────────────────────────────────

async function triggerRetellCall(config: any, phone: string, appointmentId: string | null, callRequestId: string) {
  try {
    const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.retellKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: config.retellAgentId,
        to_number: phone,
        metadata: { appointmentId, callRequestId },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "FAILED", errorMessage: `Retell error: ${res.status}` } });
      return NextResponse.json({ error: `Retell error: ${res.status}`, details: err.slice(0, 200) }, { status: 500 });
    }

    const data = await res.json();
    await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "RINGING", externalCallId: data.call_id, startedAt: new Date() } });
    return NextResponse.json({ success: true, callId: data.call_id, provider: "Retell AI", message: "Call initiated — patient will receive a call shortly" });
  } catch (e: any) {
    await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "FAILED", errorMessage: e.message } }).catch(() => { });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function handleRetellWebhook(body: any) {
  const appointmentId = body.metadata?.appointmentId || body.call?.metadata?.appointmentId;
  const callRequestId = body.metadata?.callRequestId || body.call?.metadata?.callRequestId;
  const transcript = body.transcript || body.call?.transcript || "";

  if (appointmentId && transcript) {
    await saveCallIntake(appointmentId, transcript, "retell");
  }
  if (callRequestId) {
    await prisma.callRequest.update({ where: { id: callRequestId }, data: { status: "COMPLETED", completedAt: new Date() } }).catch(() => { });
  }

  return NextResponse.json({ ok: true });
}

// ── Shared: save call transcript as intake ───────────────

async function saveCallIntake(appointmentId: string, transcript: string, provider: string) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { clinic: { include: { ehrConnections: { where: { isActive: true }, take: 1 } } } } },
        provider: { select: { firstName: true, lastName: true } },
        clinic: { select: { name: true } },
      },
    });

    if (!appointment) return;

    const intake = {
      chiefComplaint: extractFromTranscript(transcript, /(?:reason|brings you|what's been|concern)\s*(?:is|for)?\s*(.+?)(?:\.|$)/im),
      hpiNarrative: transcript.slice(0, 1500),
      symptomDetails: {},
      reviewOfSystems: {},
      medicationCompliance: "discussed via phone",
      medicationChanges: [],
      allergyUpdates: [],
      surgicalHistoryUpdates: [],
      socialHistoryUpdates: {},
      reasonForVisit: extractFromTranscript(transcript, /(?:reason|visit|appointment)\s*(?:is|for)?\s*(.+?)(?:\.|$)/im),
      additionalConcerns: [],
      patientQuestions: [],
      conversationTranscript: transcript,
    };

    const ehrConn = appointment.patient?.clinic?.ehrConnections?.[0];
    const adapter = ehrConn ? createAdapter(ehrConn.adapter, ehrConn.credentials) : new MockEHRAdapter();
    const context = await adapter.getPatientContext(appointment.patientId);

    const soap = await generateSOAPNote(intake as any, context);
    soap.subjective = `[Collected via ${provider} voice call]\n\n${soap.subjective}`;

    const brief = generateBrief(intake as any, context, soap);

    const fhirBundle = buildFHIRBundle({
      patient: { id: appointment.patientId, firstName: appointment.patient.firstName, lastName: appointment.patient.lastName, dob: appointment.patient.dateOfBirth?.toISOString().slice(0, 10) || "", gender: appointment.patient.gender || "unknown", phone: appointment.patient.phone },
      encounter: { id: appointmentId, date: appointment.scheduledAt.toISOString(), type: appointment.visitType, provider: `Dr. ${appointment.provider?.lastName}`, clinic: appointment.clinic?.name || "" },
      intake: intake as any, soap,
    });

    await prisma.preVisitBrief.upsert({
      where: { appointmentId },
      update: { status: "READY", chiefComplaint: intake.chiefComplaint, hpiNarrative: soap.subjective, soapNote: soap as any, transcript, fhirBundle: fhirBundle as any, clinicalSummary: brief.clinicalNarrative, riskScore: brief.riskScore, protocolsApplied: soap.protocolsApplied, generatedAt: new Date() },
      create: { appointmentId, patientId: appointment.patientId, providerId: appointment.providerId || "", status: "READY", chiefComplaint: intake.chiefComplaint, hpiNarrative: soap.subjective, soapNote: soap as any, transcript, fhirBundle: fhirBundle as any, clinicalSummary: brief.clinicalNarrative, riskScore: brief.riskScore, protocolsApplied: soap.protocolsApplied, generatedAt: new Date() },
    });

    console.log(`[Voice] Saved intake from ${provider} call for appointment ${appointmentId}`);
  } catch (e: any) {
    console.error(`[Voice] Failed to save call intake: ${e.message}`);
  }
}

function extractFromTranscript(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match?.[1]?.trim().slice(0, 200) || "";
}


async function handleVapiAssistantRequest(body: any) {
  try {
    const customerNumber = body.message?.call?.customer?.number;
    let systemPrompt = "";

    if (customerNumber) {
      // Find patient by phone
      const patient = await prisma.patient.findFirst({
        where: { phone: { contains: customerNumber.slice(-10) } }, // match last 10 digits
        include: { clinic: true }
      });

      if (patient) {
        // Find upcoming appointment
        const appointment = await prisma.appointment.findFirst({
          where: { patientId: patient.id, status: { in: ["SCHEDULED", "CONFIRMED"] } },
          orderBy: { scheduledAt: 'asc' },
          include: { provider: true }
        });

        const data = {
          patientDetails: patient,
          upcomingAppointment: appointment ? {
            date: appointment.scheduledAt,
            provider: appointment.provider ? `${appointment.provider.firstName} ${appointment.provider.lastName}` : 'Unknown Provider',
            visitType: appointment.visitType,
            clinic: patient.clinic?.name
          } : null,
          pastHistory: []
        };

        systemPrompt = buildClaudeSystemPrompt({ phase: "consent", phaseStep: 0, data, consentGiven: false, complete: false });
      } else {
        systemPrompt = "You are Riley from Wellness Partners. A new patient is calling. Ask for their name and how you can help them.";
      }
    }

    return NextResponse.json({
      assistant: {
        variableValues: {
          patientInfo: systemPrompt
        }
      }
    });
  } catch (e: any) {
    console.error("[VAPI Assistant Request Error]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

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
      phoneNumber: s.voice_phone_number || process.env.VOICE_PHONE_NUMBER || "",
    };
  } catch {
    return {
      provider: process.env.VOICE_PROVIDER || "vapi",
      vapiKey: process.env.VAPI_API_KEY || "",
      retellKey: process.env.RETELL_API_KEY || "",
      retellAgentId: "",
      phoneNumber: process.env.VOICE_PHONE_NUMBER || "",
    };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ── Trigger outbound call ──────────────────────────────
  if (action === "call") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { appointmentId, phoneNumber } = body;
    if (!appointmentId || !phoneNumber) return NextResponse.json({ error: "appointmentId and phoneNumber required" }, { status: 400 });

    const config = await getVoiceConfig();

    // Build the clinical system prompt
    const systemPrompt = buildClaudeSystemPrompt({ phase: "consent", phaseStep: 0, data: {}, consentGiven: false, complete: false });

    if (config.provider === "vapi" && config.vapiKey) {
      return triggerVapiCall(config, phoneNumber, appointmentId, systemPrompt);
    } else if (config.provider === "retell" && config.retellKey) {
      return triggerRetellCall(config, phoneNumber, appointmentId);
    } else {
      return NextResponse.json({
        error: "No voice provider configured",
        setup: {
          vapi: { url: "https://vapi.ai", steps: ["Sign up at vapi.ai", "Get API key from dashboard", "Add phone number ($1-2/mo)", "Set API key in Super Admin → Settings → Voice AI"] },
          retell: { url: "https://retellai.com", steps: ["Sign up at retellai.com", "Create an agent", "Get API key", "Set in Super Admin → Settings → Voice AI"] },
        }
      }, { status: 400 });
    }
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

async function triggerVapiCall(config: any, phone: string, appointmentId: string, systemPrompt: string) {
  try {
    const res = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.vapiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: config.phoneNumber,
        customer: { number: phone },
        assistant: {
          model: { provider: "anthropic", model: "claude-3-5-sonnet-20241022", systemPrompt },
          voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
          firstMessage: "Hi there! I'm your MyAIDoctor pre-visit assistant. I'm calling to help prepare for your upcoming appointment. This should take about 8 to 12 minutes. Before we begin, I need to let you know that your responses will be shared with your healthcare provider and stored securely. Do you understand and agree to proceed?",
          endCallMessage: "Thank you for completing your pre-visit intake! Your provider will review everything before your appointment. Take care!",
          recordingEnabled: true,
          transcriptionEnabled: true,
        },
        metadata: { appointmentId },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return NextResponse.json({ error: `Vapi error: ${res.status}`, details: err.slice(0, 200) }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, callId: data.id, provider: "Vapi.ai", message: "Call initiated — patient will receive a call shortly" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function handleVapiWebhook(body: any) {
  const report = body.message || body;
  const appointmentId = report.metadata?.appointmentId || report.call?.metadata?.appointmentId;
  const transcript = report.transcript || report.artifact?.transcript || "";

  if (appointmentId && transcript) {
    await saveCallIntake(appointmentId, transcript, "vapi");
  }

  return NextResponse.json({ ok: true });
}

// ── Retell AI ────────────────────────────────────────────

async function triggerRetellCall(config: any, phone: string, appointmentId: string) {
  try {
    const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.retellKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: config.retellAgentId,
        to_number: phone,
        metadata: { appointmentId },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return NextResponse.json({ error: `Retell error: ${res.status}`, details: err.slice(0, 200) }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, callId: data.call_id, provider: "Retell AI", message: "Call initiated — patient will receive a call shortly" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function handleRetellWebhook(body: any) {
  const appointmentId = body.metadata?.appointmentId || body.call?.metadata?.appointmentId;
  const transcript = body.transcript || body.call?.transcript || "";

  if (appointmentId && transcript) {
    await saveCallIntake(appointmentId, transcript, "retell");
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

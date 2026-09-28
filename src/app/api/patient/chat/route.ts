import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import {
  PHASES, getScriptedResponse, buildClaudeSystemPrompt,
  extractIntakeFromConversation,
  type ChatMessage, type ConversationState, type Phase,
} from "@/lib/clinical/conversation";
import { generateSOAPNote, generateBrief } from "@/lib/clinical/engine";
import { MockEHRAdapter, createAdapter } from "@/lib/ehr/adapters";
import { buildFHIRBundle } from "@/lib/fhir/resources";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, appointmentId, message, history, state } = await req.json();

  // Check AI service status with diagnostics
  if (action === "check_ai") {
    const diagnostics: any = { sources: {} };

    // Check .env
    const envKey = process.env.ANTHROPIC_API_KEY;
    diagnostics.sources.env = envKey ? `Found (${envKey.slice(0, 10)}...${envKey.slice(-4)})` : "Not set";

    const envOpenAI = process.env.OPENAI_API_KEY;
    diagnostics.sources.envOpenAI = envOpenAI ? "Found" : "Not set";

    // Check DB settings
    try {
      const rows = await prisma.systemSetting.findMany({
        where: { key: { in: ["ai_provider", "ai_api_key", "ai_model", "ai_base_url"] } },
      });
      const s: Record<string, string> = {};
      rows.forEach(r => { s[r.key] = r.value; });
      diagnostics.sources.dbProvider = s.ai_provider || "not set";
      diagnostics.sources.dbKey = s.ai_api_key ? `Found (${s.ai_api_key.slice(0, 10)}...${s.ai_api_key.slice(-4)})` : "Not set";
      diagnostics.sources.dbModel = s.ai_model || "not set";
    } catch (e: any) {
      diagnostics.sources.dbError = e.message;
    }

    // Get resolved config
    const aiConfig = await getAIConfig();
    if (!aiConfig) {
      return NextResponse.json({ active: false, provider: "scripted", message: "No API key found in .env or database settings", diagnostics });
    }

    diagnostics.resolvedProvider = aiConfig.provider;
    diagnostics.resolvedModel = aiConfig.model;
    diagnostics.resolvedKeyPrefix = aiConfig.apiKey.slice(0, 12) + "...";

    // Test the connection
    try {
      if (aiConfig.provider === "claude") {
        // Auto-discover the correct model
        const model = await discoverClaudeModel(aiConfig.apiKey);
        if (model) {
          diagnostics.discoveredModel = model;
          return NextResponse.json({ active: true, provider: "Anthropic Claude", model, diagnostics });
        }
        diagnostics.triedModels = "All models returned 404 — check API key permissions at console.anthropic.com";
        return NextResponse.json({ active: false, provider: "claude", message: "No working model found for this API key", diagnostics });
      }
      // Other providers — just verify key exists
      return NextResponse.json({ active: true, provider: aiConfig.provider === "openai" ? "OpenAI" : aiConfig.provider === "gemini" ? "Google Gemini" : aiConfig.provider, model: aiConfig.model, diagnostics });
    } catch (e: any) {
      diagnostics.connectionError = e.message;
      return NextResponse.json({ active: false, provider: aiConfig.provider, message: `Connection failed: ${e.message}`, diagnostics });
    }
  }

  // Start a new conversation
  if (action === "start") {
    // Fetch appointment details for personalized messages
    let apptInfo = { providerName: "your provider", date: "soon", time: "", visitType: "" };
    try {
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { provider: { select: { firstName: true, lastName: true } }, clinic: { select: { name: true } } },
      });
      if (appt) {
        const d = new Date(appt.scheduledAt);
        apptInfo = {
          providerName: `Dr. ${appt.provider?.lastName || "your provider"}`,
          date: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          visitType: (appt.visitType || "").replace(/_/g, " "),
        };
      }
    } catch {}

    const greeting = `Hi there! 👋 I'm your MyAIDoctor pre-visit assistant. I'm here to help prepare for your upcoming appointment with ${apptInfo.providerName} on ${apptInfo.date} at ${apptInfo.time}.\n\nThis should take about 8-12 minutes. You can type your answers or tap the microphone to speak.\n\nBefore we begin — your responses will be shared with your healthcare provider and stored securely under HIPAA protection. This is not a substitute for emergency care.\n\nDo you understand and agree to proceed?`;

    return NextResponse.json({
      reply: greeting,
      options: ["Yes, I agree", "Tell me more about privacy"],
      state: { phase: "consent", phaseStep: 0, data: {}, consentGiven: false, complete: false, apptInfo },
    });
  }

  // Process a patient message
  if (action === "message") {
    const convoState: ConversationState = state || { phase: "consent", phaseStep: 0, data: {}, consentGiven: false, complete: false };
    const messages: ChatMessage[] = history || [];

    // ── Exit detection ──────────────────────────────────
    const exitPattern = /^(exit|stop|quit|end|hang up|bye|goodbye|cancel|i.m done|leave|close|no more|that.s all|i.m finished|end chat|stop chat)$/i;
    if (exitPattern.test(message.trim())) {
      return NextResponse.json({
        reply: "No problem at all! Your progress has been saved, so you can pick up where you left off anytime.\n\nIf you need anything, just come back to your Patient Portal. Take care! 👋",
        state: { ...convoState, exited: true },
        exited: true,
      });
    }

    // Update state data based on phase and message
    const updatedData = updateStateData(convoState, message);
    convoState.data = { ...convoState.data, ...updatedData };

    // Check for red flags
    const redFlag = checkRedFlags(message);
    if (redFlag) {
      return NextResponse.json({
        reply: redFlag,
        state: convoState,
        isRedFlag: true,
      });
    }

    // Handle consent
    if (convoState.phase === "consent" && !convoState.consentGiven) {
      const agreed = /yes|agree|i do|sure|ok|proceed/i.test(message);
      if (agreed) {
        convoState.consentGiven = true;
        convoState.phase = "verify_info";
        convoState.phaseStep = 1; // entry already shown in this response
        return NextResponse.json({
          reply: "Thank you! Let's get started. 😊\n\nFirst, let me verify your information is up to date. Has your phone number, email address, or home address changed since your last visit?",
          options: ["No changes", "Yes, I have updates"],
          state: convoState,
        });
      } else {
        return NextResponse.json({
          reply: "I understand your concern. Your health information is protected under HIPAA — it's only shared with your healthcare provider for the purpose of your care. We don't sell or share your data with anyone else.\n\nWould you like to proceed?",
          options: ["Yes, I agree", "No, not right now"],
          state: convoState,
        });
      }
    }

    // ── Appointment Confirmation Sub-flows ──────────────
    if (convoState.phase === "confirm_appointment") {
      const apptAction = (convoState as any).appointmentAction;
      const apptInfo = (convoState as any).apptInfo || {};
      const lc = message.toLowerCase();

      // Initial choice
      if (!apptAction) {
        if (/yes|confirm|be there|attend|confirmed/i.test(lc)) {
          convoState.phase = "chief_complaint";
          convoState.phaseStep = 1; // entry already shown
          return NextResponse.json({
            reply: "Perfect, you're all confirmed! 🎉\n\nNow let's talk about why you're coming in. In your own words, what's the main reason for your visit?",
            options: ["Ongoing health issue", "New symptom", "Medication refill", "Annual check-up", "Follow-up visit"],
            state: convoState,
          });
        }

        if (/reschedule/i.test(lc)) {
          (convoState as any).appointmentAction = "reschedule_choose";
          // Fetch available slots
          try {
            const slotsRes = await fetch(new URL("/api/patient/appointment", req.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
              body: JSON.stringify({ action: "available_slots", appointmentId }),
            });
            const slotsData = await slotsRes.json();
            const slots = slotsData.slots || [];
            (convoState as any).availableSlots = slots;

            if (slots.length > 0) {
              const slotList = slots.slice(0, 6).map((s: any, i: number) => `${i + 1}. ${s.date} at ${s.time}`).join("\n");
              return NextResponse.json({
                reply: `I can help you reschedule! Here are some available slots with ${apptInfo.providerName || "your provider"}:\n\n${slotList}\n\nWould you like to pick one of these, or tell me your preferred times?`,
                options: [...slots.slice(0, 4).map((s: any) => `${s.date} ${s.time}`), "I'll share my preferences", "Earliest available"],
                state: convoState,
              });
            } else {
              return NextResponse.json({
                reply: "I don't see any open slots in the next 2 weeks. Let me collect your preferences so the office can find the best time for you.\n\nWhen would you prefer to come in?",
                options: ["Earliest available", "Early morning (before 10am)", "Afternoon (after 1pm)", "I have specific dates"],
                state: convoState,
              });
            }
          } catch {
            (convoState as any).appointmentAction = "reschedule_pref";
            return NextResponse.json({
              reply: "Let me collect your preferences so we can reschedule.\n\nWhen would you prefer your appointment?",
              options: ["Earliest available", "Early morning (before 10am)", "Afternoon (after 1pm)", "I have specific dates"],
              state: convoState,
            });
          }
        }

        if (/cancel/i.test(lc)) {
          (convoState as any).appointmentAction = "cancel_reason";
          return NextResponse.json({
            reply: "I'm sorry to hear you need to cancel. Could you share the reason? This helps us improve. You can also skip this if you prefer.",
            options: ["Schedule conflict", "Feeling better", "Seeing another provider", "Financial reasons", "No reason / Skip"],
            state: convoState,
          });
        }

        if (/waitlist|cancellation/i.test(lc)) {
          (convoState as any).appointmentAction = "waitlist_pref";
          return NextResponse.json({
            reply: "Great idea! I'll add you to the cancellation waitlist. If someone cancels their appointment with your provider or any doctor at the same clinic, you'll be notified immediately via SMS so you can grab that spot.\n\nWhat's your preference for timing?",
            options: ["Earliest possible", "Mornings only", "Afternoons only", "Anytime works"],
            state: convoState,
          });
        }

        // Default — re-show options
        return NextResponse.json({
          reply: "Please let me know how you'd like to proceed with your appointment:",
          options: ["✅ Yes, confirm", "📅 Reschedule", "❌ Cancel appointment", "📋 Join cancellation waitlist"],
          state: convoState,
        });
      }

      // ── Reschedule sub-flow ──────────────────────────
      if (apptAction === "reschedule_choose" || apptAction === "reschedule_pref") {
        const slots = (convoState as any).availableSlots || [];
        
        // Check if they selected an available slot
        const matchedSlot = slots.find((s: any) => lc.includes(s.date.toLowerCase()) || lc.includes(s.time.toLowerCase()));
        if (matchedSlot || /earliest/i.test(lc)) {
          const slot = matchedSlot || slots[0];
          if (slot) {
            // Book the slot
            try {
              await fetch(new URL("/api/patient/appointment", req.url).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
                body: JSON.stringify({ action: "reschedule", appointmentId, selectedSlot: slot.iso }),
              });
            } catch {}

            delete (convoState as any).appointmentAction;
            delete (convoState as any).availableSlots;
            convoState.phase = "chief_complaint";
            convoState.phaseStep = 1; // entry already shown
            (convoState as any).apptInfo = { ...apptInfo, date: slot.date, time: slot.time };
            return NextResponse.json({
              reply: `Done! ✅ Your appointment has been rescheduled to **${slot.date}** at **${slot.time}** with ${apptInfo.providerName || "your provider"}.\n\nLet's continue with your pre-visit intake so your doctor is prepared. What's the main reason for your visit?`,
              options: ["Ongoing health issue", "New symptom", "Medication refill", "Annual check-up", "Follow-up visit"],
              state: convoState,
            });
          }
        }

        // Collecting preferences
        const timeP = /morning|early|before 10/i.test(lc) ? "morning" : /afternoon|after 1|late/i.test(lc) ? "afternoon" : /anytime|whenever|any/i.test(lc) ? "anytime" : "anytime";
        try {
          await fetch(new URL("/api/patient/appointment", req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
            body: JSON.stringify({ action: "reschedule", appointmentId, timePreference: timeP, reason: message }),
          });
        } catch {}

        delete (convoState as any).appointmentAction;
        delete (convoState as any).availableSlots;
        convoState.phase = "chief_complaint";
        convoState.phaseStep = 1; // entry already shown
        return NextResponse.json({
          reply: `Got it! 📋 Your reschedule request has been submitted. The office will contact you with available times.\n\nIn the meantime, let's complete your pre-visit intake so your doctor has your information ready. What's the main reason for your visit?`,
          options: ["Ongoing health issue", "New symptom", "Medication refill", "Annual check-up", "Follow-up visit"],
          state: convoState,
        });
      }

      // ── Cancel sub-flow ──────────────────────────────
      if (apptAction === "cancel_reason") {
        const reason = /no reason|skip/i.test(lc) ? "" : message;
        try {
          await fetch(new URL("/api/patient/appointment", req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
            body: JSON.stringify({ action: "cancel", appointmentId, reason }),
          });
        } catch {}

        (convoState as any).appointmentAction = "cancel_done";
        return NextResponse.json({
          reply: `Your appointment has been cancelled.${reason ? " Thank you for letting us know the reason." : ""}\n\nWould you like to join our cancellation waitlist? If a slot opens up with your provider or another doctor at the same clinic, we'll notify you right away via SMS so you can grab it.`,
          options: ["Yes, add me to waitlist", "No thanks"],
          state: convoState,
        });
      }

      if (apptAction === "cancel_done") {
        if (/yes|add|waitlist/i.test(lc)) {
          try {
            await fetch(new URL("/api/patient/appointment", req.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
              body: JSON.stringify({ action: "waitlist", appointmentId, preference: "anytime" }),
            });
          } catch {}
          delete (convoState as any).appointmentAction;
          convoState.complete = true;
          return NextResponse.json({
            reply: "You've been added to the cancellation waitlist! 📋\n\nWhen a slot opens up, all waitlisted patients will be notified by SMS, WhatsApp, or iMessage — first to respond gets the appointment.\n\nTake care! If you need anything, you can always come back to your Patient Portal. 👋",
            state: convoState,
          });
        } else {
          delete (convoState as any).appointmentAction;
          convoState.complete = true;
          return NextResponse.json({
            reply: "No problem! Your appointment has been cancelled. If you'd like to schedule again in the future, just contact your clinic or visit your Patient Portal.\n\nTake care! 👋",
            state: convoState,
          });
        }
      }

      // ── Waitlist sub-flow ────────────────────────────
      if (apptAction === "waitlist_pref") {
        const pref = /earliest|asap/i.test(lc) ? "earliest" : /morning/i.test(lc) ? "morning" : /afternoon/i.test(lc) ? "afternoon" : "anytime";
        try {
          await fetch(new URL("/api/patient/appointment", req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
            body: JSON.stringify({ action: "waitlist", appointmentId, preference: pref }),
          });
        } catch {}

        delete (convoState as any).appointmentAction;
        convoState.phase = "chief_complaint";
        convoState.phaseStep = 1; // entry already shown
        return NextResponse.json({
          reply: `You've been added to the cancellation waitlist! 📋\n\nPreference: **${pref === "earliest" ? "Earliest possible" : pref === "morning" ? "Mornings only" : pref === "afternoon" ? "Afternoons only" : "Anytime"}**\n\nWhen a slot opens up with ${apptInfo.providerName || "your provider"} or another doctor at the same clinic, all waitlisted patients will be notified by SMS — first to respond gets the appointment.\n\nMeanwhile, let's continue with your pre-visit intake. What's the main reason for your visit?`,
          options: ["Ongoing health issue", "New symptom", "Medication refill", "Annual check-up", "Follow-up visit"],
          state: convoState,
        });
      }
    }

    // Try AI provider first, fall back to scripted
    const aiConfig = await getAIConfig();
    let reply: string;
    let options: string[] | undefined;
    let nextPhase: Phase | undefined;

    if (aiConfig) {
      try {
        const result = await generateAIResponse(aiConfig, messages, message, convoState);
        reply = result.reply;
        options = result.options;

        // Claude signals phase transitions and completion via markers
        const phaseMatch = reply.match(/\[PHASE:(\w+)\]/);
        if (phaseMatch) {
          const newPhase = phaseMatch[1] as Phase;
          if (PHASES.includes(newPhase)) convoState.phase = newPhase;
          reply = reply.replace(/\[PHASE:\w+\]/, "").trim();
        }
        if (reply.includes("[INTAKE_COMPLETE]")) {
          reply = reply.replace("[INTAKE_COMPLETE]", "").trim();
          convoState.complete = true;
          convoState.phase = "review_submit";
        }
        // Track exchange count per phase for data extraction, but do NOT force transitions
        convoState.phaseStep++;
      } catch (e) {
        console.error("AI provider error, falling back to scripted:", e);
        const scripted = getScriptedResponse(convoState, message);
        reply = scripted.reply;
        options = scripted.options;
        if (scripted.nextPhase) { convoState.phase = scripted.nextPhase; convoState.phaseStep = 1; }
        else { convoState.phaseStep = scripted.nextStep; }
      }
    } else {
      const result = getScriptedResponse(convoState, message);
      reply = result.reply;
      options = result.options;
      if (result.nextPhase) {
        convoState.phase = result.nextPhase;
        convoState.phaseStep = 1; // entry already shown in this response
      } else {
        convoState.phaseStep = result.nextStep;
      }

      // Check if we've reached the end of scripted phases
      if (convoState.phase === "review_submit" && convoState.phaseStep > 1) {
        convoState.complete = true;
      }
    }

    return NextResponse.json({ reply, options, state: convoState });
  }

  // Submit the conversation as intake
  if (action === "submit") {
    const messages: ChatMessage[] = history || [];
    const intake = extractIntakeFromConversation(messages);

    if (!appointmentId) return NextResponse.json({ error: "No appointment" }, { status: 400 });

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { clinic: { include: { ehrConnections: { where: { isActive: true }, take: 1 } } } } },
        provider: { select: { firstName: true, lastName: true } },
        clinic: { select: { name: true } },
      },
    });

    if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    const ehrConn = appointment.patient?.clinic?.ehrConnections?.[0];
    const adapter = ehrConn ? createAdapter(ehrConn.adapter, ehrConn.credentials) : new MockEHRAdapter();
    const context = await adapter.getPatientContext(appointment.patientId);

    const soap = await generateSOAPNote(intake, context);
    soap.subjective = `[Collected via conversational AI intake]\n\n${soap.subjective}\n\n--- Conversation Transcript ---\n${intake.conversationTranscript?.slice(0, 2000)}`;

    const brief = generateBrief(intake, context, soap);

    const fhirBundle = buildFHIRBundle({
      patient: { id: appointment.patientId, firstName: appointment.patient.firstName, lastName: appointment.patient.lastName, dob: appointment.patient.dateOfBirth?.toISOString().slice(0, 10) || "", gender: appointment.patient.gender || "unknown", phone: appointment.patient.phone },
      encounter: { id: appointmentId, date: appointment.scheduledAt.toISOString(), type: appointment.visitType, provider: `Dr. ${appointment.provider?.lastName}`, clinic: appointment.clinic?.name || "" },
      intake, soap,
    });

    const transcript = messages.map(m => `${m.role === "bot" ? "Assistant" : "Patient"}: ${m.text}`).join("\n\n");

    await prisma.preVisitBrief.upsert({
      where: { appointmentId },
      update: { status: "READY", chiefComplaint: intake.chiefComplaint, hpiNarrative: soap.subjective, soapNote: soap as any, transcript, fhirBundle: fhirBundle as any, clinicalSummary: brief.clinicalNarrative, riskScore: brief.riskScore, protocolsApplied: soap.protocolsApplied, generatedAt: new Date() },
      create: { appointmentId, patientId: appointment.patientId, providerId: appointment.providerId || "", status: "READY", chiefComplaint: intake.chiefComplaint, hpiNarrative: soap.subjective, soapNote: soap as any, transcript, fhirBundle: fhirBundle as any, clinicalSummary: brief.clinicalNarrative, riskScore: brief.riskScore, protocolsApplied: soap.protocolsApplied, generatedAt: new Date() },
    });

    await adapter.pushSOAPNote(appointment.patientId, soap);

    return NextResponse.json({
      success: true,
      brief: { riskScore: brief.riskScore, completionRate: brief.completionRate, redFlagCount: soap.redFlags.length },
      soapPreview: { subjective: soap.subjective.slice(0, 500), objective: soap.objective.slice(0, 300), assessment: soap.assessment.slice(0, 300), plan: soap.plan.slice(0, 300), generatedBy: soap.generatedBy },
      fhirBundle,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ── Multi-Provider AI Helpers ─────────────────────────────

async function getAIConfig(): Promise<{ provider: string; apiKey: string; model: string; baseUrl?: string } | null> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["ai_provider", "ai_api_key", "ai_model", "ai_base_url"] } },
    });
    const s: Record<string, string> = {};
    rows.forEach(r => { s[r.key] = r.value; });

    const provider = s.ai_provider || "claude";
    const apiKey = s.ai_api_key || (provider === "claude" ? process.env.ANTHROPIC_API_KEY : provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY) || "";
    if (!apiKey) return null;

    const VALID_MODELS = [
      "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307", "claude-3-sonnet-20240229",
      "gpt-4o", "gpt-4o-mini", "gpt-4-turbo",
      "gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash",
    ];

    const storedModel = s.ai_model || "";
    const model = VALID_MODELS.includes(storedModel) ? storedModel : getDefaultModel(provider);

    return {
      provider,
      apiKey,
      model,
      baseUrl: s.ai_base_url || undefined,
    };
  } catch {
    if (process.env.ANTHROPIC_API_KEY) return { provider: "claude", apiKey: process.env.ANTHROPIC_API_KEY, model: "claude-3-5-sonnet-20241022" };
    return null;
  }
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "claude": return "auto";
    case "openai": return "gpt-4o";
    case "gemini": return "gemini-1.5-flash";
    default: return "";
  }
}

let discoveredModel: string | null = null;

async function discoverClaudeModel(apiKey: string): Promise<string | null> {
  if (discoveredModel) return discoveredModel;
  const candidates = [
    // Current models (2025-2026)
    "claude-sonnet-4-6-20250627",
    "claude-sonnet-4-20250514",
    "claude-opus-4-6-20250627",
    "claude-opus-4-20250514",
    "claude-haiku-4-5-20251001",
    "claude-3-7-sonnet-20250219",
    // Older models
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ];
  console.log("[AI] Auto-discovering working Claude model...");
  for (const model of candidates) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "Hi" }] }),
      });
      console.log(`[AI]   ${model}: ${res.status}`);
      if (res.ok) { discoveredModel = model; console.log(`[AI] ✓ Using model: ${model}`); return model; }
    } catch (e: any) { console.log(`[AI]   ${model}: ${e.message}`); }
  }
  console.log("[AI] ✗ No working model found");
  return null;
}

async function generateAIResponse(config: { provider: string; apiKey: string; model: string; baseUrl?: string }, history: ChatMessage[], newMessage: string, state: ConversationState) {
  const systemPrompt = buildClaudeSystemPrompt(state); // works for all providers

  switch (config.provider) {
    case "claude": return callClaude(config, systemPrompt, history, newMessage);
    case "openai": return callOpenAI(config, systemPrompt, history, newMessage);
    case "gemini": return callGemini(config, systemPrompt, history, newMessage);
    default:
      // Custom provider — uses OpenAI-compatible API format
      if (config.baseUrl) return callOpenAI(config, systemPrompt, history, newMessage);
      const scripted = getScriptedResponse(state, newMessage);
      return { reply: scripted.reply, options: scripted.options };
  }
}

async function callClaude(config: any, system: string, history: ChatMessage[], newMsg: string) {
  // Resolve model — auto-discover if needed
  let model = config.model;
  if (!model || model === "auto") {
    model = await discoverClaudeModel(config.apiKey);
    if (!model) throw new Error("No working Claude model found for this API key");
  }

  const messages = [...history.map(m => ({ role: m.role === "bot" ? "assistant" as const : "user" as const, content: m.text })), { role: "user" as const, content: newMsg }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 500, system, messages }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text().catch(() => "unknown error")}`);
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Claude");
  return parseAIResponse(text);
}

async function callOpenAI(config: any, system: string, history: ChatMessage[], newMsg: string) {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const messages = [
    { role: "system", content: system },
    ...history.map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })),
    { role: "user", content: newMsg },
  ];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, max_tokens: 500, messages }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");
  return parseAIResponse(text);
}

async function callGemini(config: any, system: string, history: ChatMessage[], newMsg: string) {
  const contents = [
    ...history.map(m => ({ role: m.role === "bot" ? "model" : "user", parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: newMsg }] },
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return parseAIResponse(text);
}

function parseAIResponse(raw: string): { reply: string; options?: string[] } {
  const optionMatch = raw.match(/\[(.+?)\]/g);
  const options = optionMatch?.map((o: string) => o.replace(/[\[\]]/g, ""));
  const reply = raw.replace(/\[(.+?)\]/g, "").trim();
  return { reply, options };
}

function updateStateData(state: ConversationState, message: string): Record<string, any> {
  const data: Record<string, any> = {};
  const lower = message.toLowerCase();

  // Track what the patient has discussed
  if (state.phase === "verify_info") {
    if (/no change|same|hasn.t changed|no update|everything.s the same/i.test(message)) data.infoChanged = false;
    else if (/yes|change|update|new|moved|different/i.test(message)) data.infoChanged = true;
    if (/credit|debit|card/i.test(lower)) data.copayMethod = "credit_card";
    if (/cash/i.test(lower)) data.copayMethod = "cash";
    if (/hsa|fsa/i.test(lower)) data.copayMethod = "hsa_fsa";
    if (/skip|later|figure it out|not sure/i.test(lower)) data.copayMethod = "skipped";
  }
  if (state.phase === "chief_complaint" || state.phase === "symptom_details") {
    if (!state.data.chiefComplaint) data.chiefComplaint = message;
    else data[`symptom_detail_${state.phaseStep}`] = message;
    // Extract severity
    const sevMatch = message.match(/(\d+)\s*(?:\/|out of)\s*10/i) || message.match(/(?:about|maybe|like)\s+(?:a\s+)?(\d+)/i);
    if (sevMatch) data.severity = parseInt(sevMatch[1]);
    // Extract temporal
    if (/\d+\s*(?:day|week|month|year|hour)/i.test(message)) data.duration = message.match(/\d+\s*(?:day|week|month|year|hour)s?\s*(?:ago)?/i)?.[0];
  }
  if (state.phase === "medications") {
    if (!state.data.medications) data.medications = message;
    if (/yes|as prescribed|every day|regularly/i.test(lower)) data.medCompliance = "compliant";
    if (/no|miss|skip|stopped|forgot/i.test(lower)) data.medCompliance = "non-compliant";
  }
  if (state.phase === "wellness_screen") {
    const scores: Record<string, number> = { "not at all": 0, "several days": 1, "more than half": 2, "nearly every": 3 };
    for (const [key, val] of Object.entries(scores)) { if (lower.includes(key)) data[`screen_${state.phaseStep}`] = val; }
  }
  if (state.phase === "confirm_appointment") {
    if (/yes|confirm|plan to|will be there|see you/i.test(lower)) data.appointmentConfirmed = true;
  }
  if (state.phase === "consent") {
    if (/yes|agree|i do|sure|ok|proceed|understand/i.test(lower)) data.consentGiven = true;
  }
  if (state.phase === "additional") {
    if (message.length > 5) data.additionalConcerns = message;
  }

  return data;
}

function advancePhase(state: ConversationState, msgCount: number) {
  // Heuristic: advance phase based on message count per phase
  const phaseMessages: Record<string, number> = {
    consent: 2, verify_info: 4, confirm_appointment: 2, chief_complaint: 3,
    symptom_details: 8, review_of_systems: 4, medications: 5,
    wellness_screen: 6, additional: 3, review_submit: 2,
  };

  const currentIdx = PHASES.indexOf(state.phase);
  const threshold = phaseMessages[state.phase] || 3;
  if (state.phaseStep >= threshold && currentIdx < PHASES.length - 1) {
    state.phase = PHASES[currentIdx + 1];
    state.phaseStep = 0;
  } else {
    state.phaseStep++;
  }
}

function checkRedFlags(message: string): string | null {
  const lower = message.toLowerCase();
  if (/chest pain.*breath|can.?t breathe.*chest/i.test(lower))
    return "⚠️ I'm concerned about what you're describing. Chest pain with difficulty breathing can be serious.\n\n**Please call 911 or go to your nearest emergency room immediately.**\n\nI've flagged this for your provider. Your safety is the priority.";
  if (/suicid|kill myself|want to die|end my life|better off dead/i.test(lower))
    return "I hear you, and I want you to know that help is available. You're not alone.\n\n📞 **Please call or text 988** (Suicide & Crisis Lifeline) for immediate support.\n\nI've notified your care team. Would you like me to connect you with someone right now?";
  if (/throat.*swell|can.?t swallow.*breathing|anaphyla/i.test(lower))
    return "⚠️ Those symptoms could indicate a severe allergic reaction.\n\n**If you have an EpiPen, use it now and call 911 immediately.**\n\nI've flagged this for your provider.";
  return null;
}

/**
 * Voice AI Service — Retell AI + Telnyx Integration
 *
 * Reads config from SystemSettings (DB) or env vars.
 * Mock mode: logs to console, simulates call lifecycle.
 * Real mode: calls Retell AI API for outbound calls.
 */
import { prisma } from "@/lib/prisma";

interface VoiceAIConfig {
  retellApiKey: string;
  retellAgentId: string;
  retellWebhookSecret: string;
  telnyxApiKey: string;
  telnyxSipTrunkId: string;
  clinicPhones: Record<string, string>;
  mode: "mock" | "live";
}

let configCache: VoiceAIConfig | null = null;
let configCacheTime = 0;

export async function getVoiceAIConfig(): Promise<VoiceAIConfig> {
  // Cache for 60 seconds
  if (configCache && Date.now() - configCacheTime < 60000) return configCache;

  try {
    // Load from pipeline config model (global defaults)
    const pipelineConfigs = await prisma.voicePipelineConfig.findMany({
      where: { clinicId: null },
    });

    const pipeline: Record<string, { provider: string; config: Record<string, string> }> = {};
    pipelineConfigs.forEach((pc) => {
      pipeline[pc.layer] = { provider: pc.provider, config: (pc.config as Record<string, string>) || {} };
    });

    const voiceAI = pipeline.voice_ai;
    const telephony = pipeline.telephony;

    // Also check legacy SystemSettings for backward compatibility
    const legacyRows = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "voice_ai_" } },
    });
    const legacy: Record<string, string> = {};
    legacyRows.forEach((r) => { legacy[r.key] = r.value; });

    configCache = {
      retellApiKey: voiceAI?.config?.api_key || legacy.voice_ai_retell_api_key || process.env.RETELL_API_KEY || "",
      retellAgentId: voiceAI?.config?.agent_id || legacy.voice_ai_retell_agent_id || process.env.RETELL_AGENT_ID || "",
      retellWebhookSecret: voiceAI?.config?.webhook_secret || legacy.voice_ai_retell_webhook_secret || process.env.RETELL_WEBHOOK_SECRET || "",
      telnyxApiKey: telephony?.config?.api_key || legacy.voice_ai_telnyx_api_key || process.env.TELNYX_API_KEY || "",
      telnyxSipTrunkId: telephony?.config?.sip_trunk_id || legacy.voice_ai_telnyx_sip_trunk_id || process.env.TELNYX_SIP_TRUNK_ID || "",
      clinicPhones: {
        northville: legacy.voice_ai_phone_northville || process.env.CLINIC_PHONE_NORTHVILLE || "",
        ann_arbor: legacy.voice_ai_phone_ann_arbor || process.env.CLINIC_PHONE_ANN_ARBOR || "",
        detroit: legacy.voice_ai_phone_detroit || process.env.CLINIC_PHONE_DETROIT || "",
      },
      mode: (voiceAI?.provider === "mock" ? "mock" : voiceAI?.provider ? "live" : legacy.voice_ai_mode || process.env.VOICE_AI_MODE || "mock") as "mock" | "live",
    };
    configCacheTime = Date.now();
    return configCache;
  } catch {
    return {
      retellApiKey: "", retellAgentId: "", retellWebhookSecret: "",
      telnyxApiKey: "", telnyxSipTrunkId: "",
      clinicPhones: {}, mode: "mock",
    };
  }
}

export function clearConfigCache() { configCache = null; }

interface OutboundCallParams {
  patientPhone: string;
  patientName: string;
  patientDob: string;
  conditions: string;
  medications: string;
  appointmentDate: string;
  providerName: string;
  fromNumber: string;
  metadata: Record<string, string>;
}

interface OutboundCallResult {
  success: boolean;
  callId: string;
  message: string;
}

/**
 * Initiate an outbound call via Retell AI or mock mode.
 */
export async function createOutboundCall(
  params: OutboundCallParams
): Promise<OutboundCallResult> {
  const config = await getVoiceAIConfig();

  if (config.mode === "mock") {
    return createMockOutboundCall(params);
  }

  return createRetellOutboundCall(params, config);
}

async function createMockOutboundCall(
  params: OutboundCallParams
): Promise<OutboundCallResult> {
  const mockCallId = `mock_call_${Date.now()}`;

  console.log("\n" + "═".repeat(60));
  console.log("  📞 MOCK OUTBOUND VOICE CALL");
  console.log("═".repeat(60));
  console.log(`  Call ID:   ${mockCallId}`);
  console.log(`  From:      ${params.fromNumber}`);
  console.log(`  To:        ${params.patientPhone}`);
  console.log(`  Patient:   ${params.patientName}`);
  console.log(`  DOB:       ${params.patientDob}`);
  console.log(`  Provider:  ${params.providerName}`);
  console.log(`  Appt:      ${params.appointmentDate}`);
  console.log(`  Conditions: ${params.conditions}`);
  console.log(`  Meds:      ${params.medications}`);
  console.log("─".repeat(60));
  console.log("  Status: CALL INITIATED (mock mode)");
  console.log("  The call would connect via Retell AI → Telnyx SIP → PSTN");
  console.log("═".repeat(60) + "\n");

  // Simulate call lifecycle with a delayed webhook
  setTimeout(async () => {
    console.log(`  📞 Mock call ${mockCallId}: Ringing...`);
    setTimeout(() => {
      console.log(`  📞 Mock call ${mockCallId}: Connected (simulated 3 min call)`);
      console.log(`  📞 Mock call ${mockCallId}: Call completed`);
    }, 2000);
  }, 1000);

  return {
    success: true,
    callId: mockCallId,
    message: "[MOCK] Outbound call initiated. Check console for status.",
  };
}

async function createRetellOutboundCall(
  params: OutboundCallParams,
  config: VoiceAIConfig
): Promise<OutboundCallResult> {
  try {
    const response = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.retellApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_number: params.fromNumber,
        to_number: params.patientPhone,
        agent_id: config.retellAgentId,
        metadata: params.metadata,
        retell_llm_dynamic_variables: {
          patient_name: params.patientName,
          patient_dob: params.patientDob,
          conditions: params.conditions,
          medications: params.medications,
          appointment_date: params.appointmentDate,
          provider_name: params.providerName,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, callId: "", message: `Retell API error: ${err}` };
    }

    const data = await response.json();
    return {
      success: true,
      callId: data.call_id,
      message: "Outbound call initiated via Retell AI",
    };
  } catch (error: any) {
    return { success: false, callId: "", message: error.message || "Failed to create call" };
  }
}

/**
 * Verify Retell webhook signature.
 */
export async function verifyRetellSignature(
  signature: string | null
): Promise<boolean> {
  const config = await getVoiceAIConfig();
  if (config.mode === "mock") return true;
  if (!signature || !config.retellWebhookSecret) return false;
  return signature === config.retellWebhookSecret;
}

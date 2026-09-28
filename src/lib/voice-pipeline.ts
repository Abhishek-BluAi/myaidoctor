/**
 * Voice AI Pipeline Provider Registry
 *
 * Defines all supported providers across 5 layers:
 * Voice AI Platform, Telephony, STT, TTS, and LLM.
 *
 * Each provider has: id, name, config fields, cost estimate, and notes.
 * Supports global default + per-clinic overrides.
 */

export interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "number";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface ProviderDef {
  id: string;
  name: string;
  description: string;
  cost: string;
  hipaa: boolean;
  fields: ProviderField[];
  note?: string;
}

export interface PipelineLayer {
  key: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  providers: ProviderDef[];
}

export const PIPELINE_LAYERS: PipelineLayer[] = [
  // ── Voice AI Platforms ────────────────────────────────────
  {
    key: "voice_ai",
    label: "Voice AI Platform",
    description: "Managed platform that bundles STT + LLM + TTS + orchestration",
    icon: "Bot",
    providers: [
      {
        id: "retell", name: "Retell AI",
        description: "HIPAA-compliant, Next.js integration, medical ASR, drag-and-drop agent builder",
        cost: "$0.07/min bundled", hipaa: true,
        note: "Recommended — best balance of features, compliance, and cost",
        fields: [
          { key: "api_key", label: "API Key", type: "password", placeholder: "key_...", required: true },
          { key: "agent_id", label: "Agent ID", type: "text", placeholder: "agent_...", required: true },
          { key: "webhook_secret", label: "Webhook Secret", type: "password", placeholder: "whsec_..." },
        ],
      },
      {
        id: "vapi", name: "Vapi",
        description: "Most flexible, provider-agnostic, full API control, 14+ integrations",
        cost: "$0.05/min + provider costs", hipaa: true,
        note: "Choose if you need specific STT/TTS providers that Retell doesn't support",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "assistant_id", label: "Assistant ID", type: "text", required: true },
          { key: "phone_number_id", label: "Phone Number ID", type: "text" },
        ],
      },
      {
        id: "bland", name: "Bland AI",
        description: "High-volume outbound specialist, 1M+ concurrent calls, API-focused",
        cost: "$0.11-0.14/min", hipaa: true,
        note: "Best for massive outbound campaigns (100K+ calls/month)",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "agent_id", label: "Agent ID", type: "text" },
          { key: "pathway_id", label: "Pathway ID", type: "text" },
        ],
      },
      {
        id: "synthflow", name: "Synthflow",
        description: "Fully no-code, Zapier/Make integrations, fastest setup",
        cost: "$0.09/min", hipaa: false,
        note: "Good for proof-of-concept, may outgrow for production",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "flow_id", label: "Flow ID", type: "text", required: true },
        ],
      },
      {
        id: "custom", name: "Custom Pipeline (DIY)",
        description: "Build your own with Pipecat + LiveKit — cheapest at scale, most engineering",
        cost: "$0.01/min orchestration + provider costs", hipaa: false,
        note: "Requires dedicated voice AI engineering team. HIPAA compliance is on you.",
        fields: [
          { key: "orchestrator_url", label: "Orchestrator WebSocket URL", type: "text" },
          { key: "auth_token", label: "Auth Token", type: "password" },
        ],
      },
      {
        id: "mock", name: "Mock / Development",
        description: "Console logging, no real calls — for development and testing",
        cost: "Free", hipaa: false,
        fields: [],
      },
    ],
  },

  // ── Telephony ────────────────────────────────────────────
  {
    key: "telephony",
    label: "Telephony Provider",
    description: "Phone line — handles PSTN connections, phone numbers, and audio routing",
    icon: "Phone",
    providers: [
      {
        id: "telnyx", name: "Telnyx",
        description: "Cheapest, owns its network, native SIP trunking to Retell",
        cost: "$0.002/min in, $0.01/min out, $1/mo/number", hipaa: true,
        note: "Recommended — 50-85% cheaper than Twilio",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "sip_trunk_id", label: "SIP Trunk ID", type: "text" },
          { key: "connection_id", label: "Connection ID", type: "text" },
        ],
      },
      {
        id: "twilio", name: "Twilio",
        description: "Most popular, extensive documentation, default for many Voice AI platforms",
        cost: "$0.014/min, $1/mo/number", hipaa: true,
        fields: [
          { key: "account_sid", label: "Account SID", type: "text", required: true },
          { key: "auth_token", label: "Auth Token", type: "password", required: true },
        ],
      },
      {
        id: "plivo", name: "Plivo",
        description: "Cost-effective alternative to Twilio, good API",
        cost: "$0.009/min", hipaa: true,
        fields: [
          { key: "auth_id", label: "Auth ID", type: "text", required: true },
          { key: "auth_token", label: "Auth Token", type: "password", required: true },
        ],
      },
      {
        id: "bandwidth", name: "Bandwidth",
        description: "Enterprise-grade, owns its own network infrastructure",
        cost: "$0.01/min", hipaa: true,
        fields: [
          { key: "account_id", label: "Account ID", type: "text", required: true },
          { key: "api_token", label: "API Token", type: "password", required: true },
          { key: "api_secret", label: "API Secret", type: "password", required: true },
        ],
      },
      {
        id: "vonage", name: "Vonage (Nexmo)",
        description: "Global coverage, good for international clinics",
        cost: "$0.012/min", hipaa: true,
        fields: [
          { key: "api_key", label: "API Key", type: "text", required: true },
          { key: "api_secret", label: "API Secret", type: "password", required: true },
          { key: "app_id", label: "Application ID", type: "text" },
        ],
      },
      {
        id: "builtin", name: "Built-in (via Voice AI platform)",
        description: "Use the telephony included with your Voice AI platform",
        cost: "Included in platform cost", hipaa: true,
        fields: [],
      },
    ],
  },

  // ── Speech-to-Text ──────────────────────────────────────
  {
    key: "stt",
    label: "Speech-to-Text (STT)",
    description: "Converts patient speech to text in real-time",
    icon: "Mic",
    providers: [
      {
        id: "deepgram", name: "Deepgram",
        description: "Best medical terminology recognition, fastest real-time transcription",
        cost: "$0.0043/min", hipaa: true,
        note: "Recommended for healthcare — medical ASR model available",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "model", label: "Model", type: "select", options: [
            { value: "nova-2-medical", label: "Nova 2 Medical (recommended)" },
            { value: "nova-2", label: "Nova 2 (general)" },
            { value: "enhanced", label: "Enhanced" },
          ]},
        ],
      },
      {
        id: "google_stt", name: "Google Cloud Speech",
        description: "Wide language support, medical dictation model available",
        cost: "$0.006/min", hipaa: true,
        fields: [
          { key: "api_key", label: "Service Account JSON", type: "password", required: true },
          { key: "model", label: "Model", type: "select", options: [
            { value: "medical_dictation", label: "Medical Dictation" },
            { value: "latest_long", label: "Latest Long" },
            { value: "phone_call", label: "Phone Call" },
          ]},
        ],
      },
      {
        id: "whisper", name: "OpenAI Whisper",
        description: "High accuracy, good general-purpose, batch or real-time",
        cost: "$0.006/min", hipaa: false,
        note: "Check OpenAI BAA availability for HIPAA compliance",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "model", label: "Model", type: "select", options: [
            { value: "whisper-1", label: "Whisper-1" },
          ]},
        ],
      },
      {
        id: "azure_stt", name: "Azure Speech Services",
        description: "Enterprise-grade, custom medical vocabulary, HIPAA BAA available",
        cost: "$0.01/min", hipaa: true,
        fields: [
          { key: "api_key", label: "Subscription Key", type: "password", required: true },
          { key: "region", label: "Region", type: "text", placeholder: "eastus", required: true },
        ],
      },
      {
        id: "builtin", name: "Built-in (via Voice AI platform)",
        description: "Use the STT included with your Voice AI platform",
        cost: "Included", hipaa: true,
        fields: [],
      },
    ],
  },

  // ── Text-to-Speech ──────────────────────────────────────
  {
    key: "tts",
    label: "Text-to-Speech (TTS)",
    description: "Converts AI responses back to natural-sounding speech",
    icon: "Volume2",
    providers: [
      {
        id: "elevenlabs", name: "ElevenLabs",
        description: "Most natural-sounding voices, voice cloning, emotional range",
        cost: "$0.03/min", hipaa: false,
        note: "Best voice quality — check BAA for HIPAA",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "voice_id", label: "Voice ID", type: "text", required: true },
          { key: "model_id", label: "Model", type: "select", options: [
            { value: "eleven_turbo_v2", label: "Turbo v2 (fastest)" },
            { value: "eleven_multilingual_v2", label: "Multilingual v2" },
          ]},
        ],
      },
      {
        id: "azure_tts", name: "Azure Neural TTS",
        description: "Enterprise HIPAA-compliant, 400+ voices, custom neural voice",
        cost: "$0.016/min", hipaa: true,
        note: "Best for HIPAA compliance with good voice quality",
        fields: [
          { key: "api_key", label: "Subscription Key", type: "password", required: true },
          { key: "region", label: "Region", type: "text", placeholder: "eastus", required: true },
          { key: "voice_name", label: "Voice Name", type: "text", placeholder: "en-US-JennyNeural" },
        ],
      },
      {
        id: "playht", name: "PlayHT",
        description: "Ultra-realistic voices, low latency streaming, voice cloning",
        cost: "$0.025/min", hipaa: false,
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "user_id", label: "User ID", type: "text", required: true },
          { key: "voice_id", label: "Voice ID", type: "text" },
        ],
      },
      {
        id: "google_tts", name: "Google Cloud TTS",
        description: "Wide language support, WaveNet and Neural2 voices",
        cost: "$0.016/min", hipaa: true,
        fields: [
          { key: "api_key", label: "Service Account JSON", type: "password", required: true },
          { key: "voice_name", label: "Voice Name", type: "text", placeholder: "en-US-Neural2-F" },
        ],
      },
      {
        id: "builtin", name: "Built-in (via Voice AI platform)",
        description: "Use the TTS included with your Voice AI platform",
        cost: "Included", hipaa: true,
        fields: [],
      },
    ],
  },

  // ── LLM (Clinical Brain) ────────────────────────────────
  {
    key: "llm",
    label: "Clinical LLM",
    description: "The AI brain — processes transcripts, generates SOAP notes, clinical reasoning",
    icon: "Brain",
    providers: [
      {
        id: "claude", name: "Anthropic Claude",
        description: "Best for clinical reasoning, SOAP generation, Schmitt-Thompson protocols",
        cost: "$0.003-0.015/1K tokens", hipaa: true,
        note: "Recommended for clinical use — strongest at structured medical output",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "model", label: "Model", type: "select", options: [
            { value: "claude-3-5-sonnet-20241022", label: "Claude Sonnet 4 (recommended)" },
            { value: "claude-3-opus-20240229", label: "Claude Opus 4" },
            { value: "claude-3-5-haiku-20241022", label: "Claude Haiku 4 (fastest)" },
          ]},
        ],
      },
      {
        id: "openai", name: "OpenAI GPT-4",
        description: "Versatile, good function calling, wide ecosystem",
        cost: "$0.01-0.03/1K tokens", hipaa: true,
        note: "BAA available via Azure OpenAI",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "model", label: "Model", type: "select", options: [
            { value: "gpt-4o", label: "GPT-4o (recommended)" },
            { value: "gpt-4o-mini", label: "GPT-4o mini (cheaper)" },
            { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
          ]},
          { key: "base_url", label: "Base URL (for Azure)", type: "text", placeholder: "https://api.openai.com/v1" },
        ],
      },
      {
        id: "gemini", name: "Google Gemini",
        description: "Strong multimodal, competitive pricing, good at long contexts",
        cost: "$0.001-0.01/1K tokens", hipaa: true,
        note: "HIPAA via Google Cloud with BAA",
        fields: [
          { key: "api_key", label: "API Key", type: "password", required: true },
          { key: "model", label: "Model", type: "select", options: [
            { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
            { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (faster)" },
          ]},
        ],
      },
      {
        id: "builtin", name: "Built-in (via Voice AI platform)",
        description: "Use the LLM included with your Voice AI platform",
        cost: "Included", hipaa: true,
        fields: [],
      },
    ],
  },
];

/** Get a layer definition by key */
export function getLayer(key: string): PipelineLayer | undefined {
  return PIPELINE_LAYERS.find((l) => l.key === key);
}

/** Get a provider definition */
export function getProvider(layerKey: string, providerId: string): ProviderDef | undefined {
  return getLayer(layerKey)?.providers.find((p) => p.id === providerId);
}

/** Estimate total cost per minute for a pipeline configuration */
export function estimateCostPerMinute(configs: { layer: string; provider: string }[]): string {
  const costs: Record<string, number> = {
    // Voice AI platforms (bundled)
    "voice_ai:retell": 0.07, "voice_ai:vapi": 0.05, "voice_ai:bland": 0.12,
    "voice_ai:synthflow": 0.09, "voice_ai:custom": 0.01, "voice_ai:mock": 0,
    // Telephony
    "telephony:telnyx": 0.01, "telephony:twilio": 0.014, "telephony:plivo": 0.009,
    "telephony:bandwidth": 0.01, "telephony:vonage": 0.012, "telephony:builtin": 0,
    // STT
    "stt:deepgram": 0.0043, "stt:google_stt": 0.006, "stt:whisper": 0.006,
    "stt:azure_stt": 0.01, "stt:builtin": 0,
    // TTS
    "tts:elevenlabs": 0.03, "tts:azure_tts": 0.016, "tts:playht": 0.025,
    "tts:google_tts": 0.016, "tts:builtin": 0,
    // LLM (approximate per minute of call)
    "llm:claude": 0.005, "llm:openai": 0.01, "llm:gemini": 0.003, "llm:builtin": 0,
  };

  let total = 0;
  for (const c of configs) {
    total += costs[`${c.layer}:${c.provider}`] || 0;
  }

  return `$${total.toFixed(3)}/min (~$${(total * 4).toFixed(2)}/call)`;
}

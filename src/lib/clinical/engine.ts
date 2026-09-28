/**
 * Clinical Engine
 *
 * Generates physician-grade SOAP notes, differential diagnoses,
 * red flag alerts, and structured pre-visit briefs.
 *
 * Uses template-based generation when no LLM API key is configured,
 * switches to real Claude API when ANTHROPIC_API_KEY is set.
 */

import type { PatientContext } from "@/lib/ehr/adapters";

// ── Clinical Intake Data (from voice/SMS conversation) ─────

export interface ClinicalIntake {
  chiefComplaint: string;
  hpiNarrative: string;
  symptomDetails: {
    onset: string;
    duration: string;
    severity: number; // 1-10
    location: string;
    quality: string;
    aggravating: string;
    alleviating: string;
    associatedSymptoms: string[];
  };
  reviewOfSystems: Record<string, string[]>; // { constitutional: ["fatigue", "weight loss"], cardiovascular: [...] }
  medicationCompliance: string;
  medicationChanges: string[];
  allergyUpdates: string[];
  surgicalHistoryUpdates: string[];
  socialHistoryUpdates: Record<string, string>;
  reasonForVisit: string;
  additionalConcerns: string[];
  patientQuestions: string[];
}

// ── SOAP Note Structure ────────────────────────────────────

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  differentials: Differential[];
  redFlags: RedFlag[];
  icdCodes: string[];
  protocolsApplied: string[];
  generatedAt: string;
  generatedBy: string; // "template" or "claude"
}

export interface Differential {
  diagnosis: string;
  icdCode: string;
  probability: string; // high, moderate, low
  supportingEvidence: string[];
  rulingOutSteps: string[];
}

export interface RedFlag {
  flag: string;
  severity: "critical" | "high" | "moderate";
  action: string;
  relatedSymptoms: string[];
}

// ── Pre-Visit Brief Structure ──────────────────────────────

export interface PreVisitBriefData {
  patientSummary: string;
  clinicalNarrative: string;
  keyFindings: string[];
  activeProblems: string[];
  medicationReview: string;
  abnormalLabs: string[];
  differentials: Differential[];
  redFlags: RedFlag[];
  suggestedTests: string[];
  suggestedActions: string[];
  focusAreas: string[];
  soapNote: SOAPNote;
  transcript?: string;
  riskScore: number; // 1-10
  completionRate: number; // 0-100
}

// ── Red Flag Detection ─────────────────────────────────────

const RED_FLAG_RULES: { pattern: RegExp; flag: string; severity: RedFlag["severity"]; action: string }[] = [
  { pattern: /chest\s*pain.*shortness\s*of\s*breath|dyspnea.*chest/i, flag: "Chest pain with dyspnea — possible ACS/PE", severity: "critical", action: "Immediate evaluation. Consider ECG, troponin, D-dimer. Activate chest pain protocol." },
  { pattern: /worst\s*headache|thunderclap|sudden\s*severe\s*headache/i, flag: "Thunderclap headache — rule out SAH", severity: "critical", action: "Urgent CT head without contrast. If negative, consider LP. Neurosurgery consult." },
  { pattern: /facial\s*droop|arm\s*weakness|speech\s*difficulty|slurred/i, flag: "Stroke symptoms — activate stroke protocol", severity: "critical", action: "Call 911 immediately. Note time of onset. NIH Stroke Scale." },
  { pattern: /suicid|self.?harm|want\s*to\s*die|end\s*(my|it)/i, flag: "Active suicidal ideation", severity: "critical", action: "Safety assessment. Do not leave patient alone. Crisis intervention. Consider 988 Lifeline." },
  { pattern: /uncontrolled\s*bleed|can.?t\s*stop.*bleed/i, flag: "Uncontrolled bleeding", severity: "critical", action: "Direct pressure. Assess hemodynamic stability. Type and cross-match." },
  { pattern: /throat\s*swell|tongue\s*swell|anaphyla/i, flag: "Possible anaphylaxis", severity: "critical", action: "Epinephrine auto-injector. Airway management. Call 911." },
  { pattern: /fever.*(\d{3}|10[2-9]|1[1-9])|temperature.*(10[2-9]|1[1-9])/i, flag: "High fever (≥102°F)", severity: "high", action: "Assess for source of infection. Blood cultures if sepsis concern." },
  { pattern: /blood\s*in\s*(stool|urine)|hematuria|melena|hematemesis/i, flag: "GI/GU bleeding", severity: "high", action: "CBC, coagulation panel. GI consult if persistent." },
  { pattern: /weight\s*loss.*unintention|unexplained\s*weight/i, flag: "Unintentional weight loss", severity: "moderate", action: "Screen for malignancy, thyroid, diabetes. CBC, CMP, TSH, age-appropriate cancer screening." },
  { pattern: /vision\s*(loss|change)|sudden\s*blind/i, flag: "Acute vision changes", severity: "high", action: "Ophthalmology referral. Check glucose, blood pressure. Consider temporal arteritis if elderly." },
  { pattern: /HbA1c.*(8|9|1[0-9])/i, flag: "Uncontrolled diabetes (HbA1c ≥8%)", severity: "moderate", action: "Medication adjustment. Consider endocrinology referral. Diabetes education." },
];

export function detectRedFlags(intake: ClinicalIntake, context: PatientContext): RedFlag[] {
  const flags: RedFlag[] = [];
  const fullText = [intake.chiefComplaint, intake.hpiNarrative, ...intake.additionalConcerns].join(" ");

  for (const rule of RED_FLAG_RULES) {
    if (rule.pattern.test(fullText)) {
      flags.push({ flag: rule.flag, severity: rule.severity, action: rule.action, relatedSymptoms: [] });
    }
  }

  // Lab-based red flags
  for (const lab of context.labs) {
    if (lab.flag === "HIGH" && lab.name === "HbA1c" && parseFloat(lab.value) >= 8) {
      flags.push({ flag: `Elevated HbA1c: ${lab.value}%`, severity: "moderate", action: "Review diabetes management plan", relatedSymptoms: [] });
    }
  }

  return flags;
}

// ── Schmitt-Thompson Protocol Matching ─────────────────────

const PROTOCOL_MAP: Record<string, { protocol: string; questions: string[] }> = {
  "headache": { protocol: "ST-Headache-001", questions: ["Location?", "Duration?", "Visual changes?", "Nausea/vomiting?", "Worst headache ever?", "Neck stiffness?"] },
  "chest pain": { protocol: "ST-ChestPain-001", questions: ["Onset?", "Radiation?", "SOB?", "Diaphoresis?", "Previous cardiac history?", "Exertional?"] },
  "abdominal": { protocol: "ST-Abdominal-001", questions: ["Location?", "Duration?", "Nausea/vomiting?", "Bowel changes?", "Blood in stool?", "Fever?"] },
  "fever": { protocol: "ST-Fever-001", questions: ["Temperature?", "Duration?", "Rash?", "Travel history?", "Immune status?", "Localizing symptoms?"] },
  "cough": { protocol: "ST-Respiratory-001", questions: ["Duration?", "Productive?", "Hemoptysis?", "Fever?", "SOB?", "Smoking history?"] },
  "back pain": { protocol: "ST-BackPain-001", questions: ["Location?", "Radiation to legs?", "Numbness?", "Bladder issues?", "Duration?", "Mechanism?"] },
  "dizziness": { protocol: "ST-Dizziness-001", questions: ["Spinning vs lightheaded?", "Hearing changes?", "Falls?", "Medications?", "Duration?"] },
  "diabetes": { protocol: "ST-Diabetes-001", questions: ["Blood sugar levels?", "Medication compliance?", "Diet changes?", "Foot exams?", "Eye exams?", "A1c trend?"] },
  "hypertension": { protocol: "ST-HTN-001", questions: ["Home BP readings?", "Medication compliance?", "Headaches?", "Vision changes?", "Dietary sodium?"] },
  "anxiety": { protocol: "ST-MentalHealth-001", questions: ["Duration?", "Triggers?", "Sleep quality?", "Substance use?", "Self-harm thoughts?", "Current medications?"] },
  "depression": { protocol: "ST-MentalHealth-002", questions: ["PHQ-9 score?", "Duration?", "Functional impact?", "Sleep?", "Appetite?", "Suicidal ideation?"] },
};

export function matchProtocols(intake: ClinicalIntake): string[] {
  const text = `${intake.chiefComplaint} ${intake.hpiNarrative} ${intake.reasonForVisit}`.toLowerCase();
  const matched: string[] = [];
  for (const [keyword, proto] of Object.entries(PROTOCOL_MAP)) {
    if (text.includes(keyword)) matched.push(proto.protocol);
  }
  return matched.length > 0 ? matched : ["ST-General-Intake-001"];
}

// ── SOAP Note Generation ───────────────────────────────────

export async function generateSOAPNote(
  intake: ClinicalIntake,
  context: PatientContext,
): Promise<SOAPNote> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try { return await generateSOAPWithClaude(intake, context, apiKey); }
    catch (e) { console.error("Claude SOAP generation failed, falling back to template:", e); }
  }

  return generateSOAPTemplate(intake, context);
}

async function generateSOAPWithClaude(
  intake: ClinicalIntake, context: PatientContext, apiKey: string
): Promise<SOAPNote> {
  // Discover working model
  const candidates = ["claude-sonnet-4-20250514", "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-5-sonnet-v2", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
  let model = "claude-3-5-sonnet-20241022";
  for (const m of candidates) {
    try {
      const test = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: "user", content: "Hi" }] }),
      });
      if (test.ok) { model = m; break; }
    } catch {}
  }
  const prompt = `You are a board-certified physician generating a structured SOAP note from pre-visit clinical data.

PATIENT: ${context.demographics.firstName} ${context.demographics.lastName}, ${context.demographics.gender}, DOB: ${context.demographics.dob}

ACTIVE CONDITIONS: ${context.conditions.map(c => `${c.name} (${c.status})`).join(", ")}

CURRENT MEDICATIONS: ${context.medications.map(m => `${m.name} ${m.dose} ${m.frequency}`).join(", ")}

ALLERGIES: ${context.allergies.map(a => `${a.substance} → ${a.reaction}`).join(", ")}

RECENT LABS: ${context.labs.map(l => `${l.name}: ${l.value} ${l.unit} ${l.flag ? `[${l.flag}]` : ""}`).join(", ")}

CHIEF COMPLAINT: ${intake.chiefComplaint}

HPI (patient-reported): ${intake.hpiNarrative}

SYMPTOM DETAILS: Onset: ${intake.symptomDetails.onset}, Duration: ${intake.symptomDetails.duration}, Severity: ${intake.symptomDetails.severity}/10, Location: ${intake.symptomDetails.location}, Quality: ${intake.symptomDetails.quality}
Aggravating: ${intake.symptomDetails.aggravating}, Alleviating: ${intake.symptomDetails.alleviating}
Associated: ${intake.symptomDetails.associatedSymptoms.join(", ")}

ROS: ${Object.entries(intake.reviewOfSystems).map(([sys, sx]) => `${sys}: ${sx.join(", ")}`).join("; ")}

MEDICATION COMPLIANCE: ${intake.medicationCompliance}

FAMILY HISTORY: ${context.familyHistory.map(f => `${f.relation}: ${f.condition}`).join(", ")}

SOCIAL HISTORY: ${Object.entries(context.socialHistory).map(([k, v]) => `${k}: ${v}`).join(", ")}

Generate a structured SOAP note as JSON with these exact fields:
{ "subjective": "...", "objective": "...", "assessment": "...", "plan": "...", "differentials": [{"diagnosis":"...","icdCode":"...","probability":"high|moderate|low","supportingEvidence":["..."],"rulingOutSteps":["..."]}], "redFlags": [{"flag":"...","severity":"critical|high|moderate","action":"...","relatedSymptoms":[]}], "icdCodes": ["..."], "suggestedTests": ["..."] }

Return ONLY valid JSON, no markdown.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    subjective: parsed.subjective || "",
    objective: parsed.objective || "",
    assessment: parsed.assessment || "",
    plan: parsed.plan || "",
    differentials: parsed.differentials || [],
    redFlags: [...(parsed.redFlags || []), ...detectRedFlags(intake, context)],
    icdCodes: parsed.icdCodes || [],
    protocolsApplied: matchProtocols(intake),
    generatedAt: new Date().toISOString(),
    generatedBy: "claude",
  };
}

function generateSOAPTemplate(intake: ClinicalIntake, context: PatientContext): SOAPNote {
  const conditions = context.conditions.map(c => c.name).join(", ");
  const meds = context.medications.map(m => `${m.name} ${m.dose} ${m.frequency}`).join("; ");
  const allergies = context.allergies.map(a => `${a.substance} (${a.reaction})`).join("; ");
  const abnormalLabs = context.labs.filter(l => l.flag).map(l => `${l.name}: ${l.value} ${l.unit} [${l.flag}]`).join("; ");
  const ros = Object.entries(intake.reviewOfSystems).map(([sys, sx]) => `${sys}: ${sx.length > 0 ? sx.join(", ") : "negative"}`).join(". ");

  return {
    subjective: `CC: ${intake.chiefComplaint}\n\nHPI: ${context.demographics.firstName} ${context.demographics.lastName} is a ${context.demographics.gender} (DOB: ${context.demographics.dob}) presenting with ${intake.chiefComplaint}. ${intake.hpiNarrative}\n\nOnset: ${intake.symptomDetails.onset}. Duration: ${intake.symptomDetails.duration}. Severity: ${intake.symptomDetails.severity}/10. Location: ${intake.symptomDetails.location}. Quality: ${intake.symptomDetails.quality}. Aggravating factors: ${intake.symptomDetails.aggravating}. Alleviating factors: ${intake.symptomDetails.alleviating}. Associated symptoms: ${intake.symptomDetails.associatedSymptoms.join(", ") || "none reported"}.\n\nROS: ${ros}\n\nMedications: ${meds}. Compliance: ${intake.medicationCompliance}.\nAllergies: ${allergies}.\n\nPMH: ${conditions}.\nFHx: ${context.familyHistory.map(f => `${f.relation} — ${f.condition}`).join("; ")}.\nSHx: ${Object.entries(context.socialHistory).map(([k, v]) => `${k}: ${v}`).join("; ")}.`,

    objective: `Vitals: ${context.vitals.map(v => `${v.type}: ${v.value} ${v.unit}`).join(", ") || "pending at visit"}.\n\nRecent Labs: ${abnormalLabs || "within normal limits"}.\n\nPhysical examination: To be completed at visit.`,

    assessment: `${context.demographics.firstName} ${context.demographics.lastName} presents with ${intake.chiefComplaint} in the setting of ${conditions || "no significant past medical history"}.\n\nActive Problems:\n${context.problemList.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,

    plan: `1. Address chief complaint: ${intake.chiefComplaint}\n2. Review and reconcile medications\n3. Follow up on abnormal labs: ${abnormalLabs || "none"}\n4. Address patient questions: ${intake.patientQuestions.join("; ") || "none raised"}\n5. Continue current treatment plan with modifications as indicated`,

    differentials: generateTemplateDifferentials(intake),
    redFlags: detectRedFlags(intake, context),
    icdCodes: context.conditions.map(c => c.code).filter(Boolean),
    protocolsApplied: matchProtocols(intake),
    generatedAt: new Date().toISOString(),
    generatedBy: "template",
  };
}

function generateTemplateDifferentials(intake: ClinicalIntake): Differential[] {
  const cc = intake.chiefComplaint.toLowerCase();
  if (cc.includes("headache")) return [
    { diagnosis: "Tension-type headache", icdCode: "G44.209", probability: "high", supportingEvidence: ["Location", "Quality"], rulingOutSteps: ["Neurological exam"] },
    { diagnosis: "Migraine", icdCode: "G43.909", probability: "moderate", supportingEvidence: ["Severity"], rulingOutSteps: ["Aura history", "Photophobia"] },
  ];
  if (cc.includes("chest")) return [
    { diagnosis: "Musculoskeletal chest pain", icdCode: "R07.1", probability: "moderate", supportingEvidence: ["Reproducible on palpation"], rulingOutSteps: ["ECG", "Troponin"] },
    { diagnosis: "GERD", icdCode: "K21.0", probability: "moderate", supportingEvidence: ["Postprandial worsening"], rulingOutSteps: ["PPI trial"] },
  ];
  return [{ diagnosis: "Further evaluation needed", icdCode: "", probability: "moderate", supportingEvidence: [intake.chiefComplaint], rulingOutSteps: ["Complete H&P at visit"] }];
}

// ── Pre-Visit Brief Generation ─────────────────────────────

export function generateBrief(
  intake: ClinicalIntake, context: PatientContext, soap: SOAPNote
): PreVisitBriefData {
  const abnormalLabs = context.labs.filter(l => l.flag).map(l => `${l.name}: ${l.value} ${l.unit} [${l.flag}]`);

  return {
    patientSummary: `${context.demographics.firstName} ${context.demographics.lastName}, ${context.demographics.gender}, DOB ${context.demographics.dob}. Active: ${context.conditions.map(c => c.name).join(", ") || "none"}.`,
    clinicalNarrative: soap.subjective,
    keyFindings: [
      `CC: ${intake.chiefComplaint}`,
      `Severity: ${intake.symptomDetails.severity}/10`,
      `Duration: ${intake.symptomDetails.duration}`,
      ...abnormalLabs.map(l => `Abnormal lab: ${l}`),
      ...soap.redFlags.map(f => `⚠ ${f.flag}`),
    ],
    activeProblems: context.problemList,
    medicationReview: `${context.medications.length} active medications. Compliance: ${intake.medicationCompliance}. Changes: ${intake.medicationChanges.join(", ") || "none"}`,
    abnormalLabs,
    differentials: soap.differentials,
    redFlags: soap.redFlags,
    suggestedTests: soap.differentials.flatMap(d => d.rulingOutSteps),
    suggestedActions: [
      ...soap.redFlags.map(f => f.action),
      ...(intake.patientQuestions.length > 0 ? [`Address patient questions: ${intake.patientQuestions.join("; ")}`] : []),
    ],
    focusAreas: [
      intake.chiefComplaint,
      ...context.problemList.filter(p => p.toLowerCase().includes("uncontrolled")),
    ],
    soapNote: soap,
    riskScore: Math.min(10, soap.redFlags.filter(f => f.severity === "critical").length * 4 + soap.redFlags.filter(f => f.severity === "high").length * 2 + soap.redFlags.filter(f => f.severity === "moderate").length + (abnormalLabs.length > 2 ? 2 : 0)),
    completionRate: calculateCompletionRate(intake),
  };
}

function calculateCompletionRate(intake: ClinicalIntake): number {
  let filled = 0, total = 8;
  if (intake.chiefComplaint) filled++;
  if (intake.hpiNarrative) filled++;
  if (intake.symptomDetails.onset) filled++;
  if (Object.keys(intake.reviewOfSystems).length > 0) filled++;
  if (intake.medicationCompliance) filled++;
  if (intake.reasonForVisit) filled++;
  if (intake.symptomDetails.severity > 0) filled++;
  if (intake.additionalConcerns.length > 0 || intake.patientQuestions.length > 0) filled++;
  return Math.round((filled / total) * 100);
}

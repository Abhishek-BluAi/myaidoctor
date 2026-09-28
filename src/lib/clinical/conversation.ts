/**
 * Clinical Conversation Engine
 *
 * Manages a 10-phase clinical intake conversation.
 * Uses Claude API for adaptive follow-ups when configured,
 * falls back to a scripted decision tree.
 */

export const PHASES = [
  "greeting", "consent", "verify_info", "confirm_appointment",
  "chief_complaint", "symptom_details", "review_of_systems",
  "medications", "wellness_screen", "additional", "review_submit",
] as const;

export type Phase = (typeof PHASES)[number];

export interface ChatMessage {
  role: "bot" | "patient";
  text: string;
  timestamp: string;
  phase?: Phase;
  options?: string[]; // Quick-reply buttons
}

export interface ConversationState {
  phase: Phase;
  phaseStep: number; // sub-step within a phase
  data: Record<string, any>;
  consentGiven: boolean;
  complete: boolean;
}

/** Conditions to skip certain phases based on visit type */
const PHASE_SKIP_CONDITIONS: Partial<Record<Phase, (data: Record<string, any>) => boolean>> = {
  symptom_details: (data) => {
    const cc = (data.chiefComplaint || "").toLowerCase();
    // Skip symptom details for non-symptom visits
    return /annual|check.?up|wellness|routine|physical|refill|medication|follow.?up|general/i.test(cc) && !/pain|hurt|sick|symptom|issue|problem|worse|new concern/i.test(cc);
  },
};

/** Find the next phase, skipping any that should be skipped based on data */
function getNextPhase(currentPhase: Phase, data: Record<string, any>): Phase | null {
  const currentIdx = PHASES.indexOf(currentPhase);
  for (let i = currentIdx + 1; i < PHASES.length; i++) {
    const candidate = PHASES[i];
    const skipFn = PHASE_SKIP_CONDITIONS[candidate];
    if (skipFn && skipFn(data)) continue; // skip this phase
    return candidate;
  }
  return null;
}
const PHASE_SCRIPTS: Record<Phase, { entry: string; options?: string[]; followUps: { condition?: (data: any) => boolean; question: string; options?: string[] }[] }> = {
  greeting: {
    entry: "Hi there! 👋 I'm your MyAIDoctor pre-visit assistant. I'm here to help prepare for your upcoming appointment so your provider can make the most of your time together. This should take about 8-12 minutes.\n\nBefore we begin, how would you prefer to communicate?",
    options: ["Let's chat here", "Call me instead"],
    followUps: [],
  },
  consent: {
    entry: "Great! Before we get started, I need to go over a few things:\n\n🔒 Your responses will be shared with your healthcare provider and stored securely in your medical record under HIPAA protection.\n\n📋 This is NOT a substitute for emergency care — if you're experiencing a medical emergency, please call 911.\n\nDo you understand and agree to proceed?",
    options: ["Yes, I agree", "Tell me more"],
    followUps: [],
  },
  verify_info: {
    entry: "Let me verify your contact information is up to date. Has your phone number, email address, or home address changed since your last visit?",
    options: ["No changes", "Yes, I have updates"],
    followUps: [
      { condition: (d) => d.infoChanged === true, question: "What information has changed? Please share the updates.", options: ["Phone number changed", "New address", "New email", "Multiple changes"] },
      { question: "Got it. And is your insurance information still the same? Same provider, same policy number?", options: ["Yes, same insurance", "Insurance changed", "I'm not sure"] },
      { question: "How are you planning to pay your co-pay today? No worries if you're not sure yet — you can skip this one.", options: ["Credit/Debit Card", "Cash", "HSA/FSA", "I'll decide later"] },
    ],
  },
  confirm_appointment: {
    entry: "Let me confirm your appointment. You're scheduled to see your provider soon. Can you confirm you're planning to attend?",
    options: ["✅ Yes, confirm", "📅 Reschedule", "❌ Cancel appointment", "📋 Join cancellation waitlist"],
    followUps: [],
  },
  chief_complaint: {
    entry: "Perfect, you're all confirmed! 🎉\n\nNow let's talk about why you're coming in. In your own words, what's the main reason for your visit? What's been bothering you or what would you like to discuss with your provider?",
    options: ["Ongoing health issue", "New symptom", "Medication refill", "Annual check-up", "Follow-up visit"],
    followUps: [
      { question: "Thank you for sharing that. Can you tell me a bit more about when this started?", options: ["A few days ago", "About a week", "2-3 weeks", "Over a month", "Several months"],
        condition: (data: any) => { const r = (data.chiefComplaint || "").toLowerCase(); return /ongoing|new symptom|issue|pain|problem|hurt|sick|feeling/i.test(r); } },
      { question: "Got it — an annual visit is a great time to review everything. Is there anything specific you'd like to bring up with your provider during the visit?", options: ["Yes, a few things", "Just a general check-up", "I have some questions about my meds"],
        condition: (data: any) => { const r = (data.chiefComplaint || "").toLowerCase(); return /annual|check.?up|wellness|routine|physical/i.test(r); } },
      { question: "Sure thing! Which medication(s) would you like to refill? And are you experiencing any side effects or issues with your current medications?", options: ["Just need a refill, no issues", "Yes, having some side effects", "Need to discuss changing medication"],
        condition: (data: any) => { const r = (data.chiefComplaint || "").toLowerCase(); return /refill|medication|prescription|med/i.test(r); } },
      { question: "Thanks! Since this is a follow-up, can you share how you've been feeling since your last visit? Any changes — better, worse, or about the same?", options: ["Getting better", "About the same", "Getting worse", "New concerns since last visit"],
        condition: (data: any) => { const r = (data.chiefComplaint || "").toLowerCase(); return /follow.?up|follow up|followup/i.test(r); } },
    ],
  },
  symptom_details: {
    entry: "Let me ask a few more questions to help your provider understand what you're experiencing.\n\nHow would you describe the feeling? For example, is it sharp, dull, throbbing, burning, or something else?",
    options: ["Sharp", "Dull", "Throbbing", "Burning", "Pressure", "Aching", "Cramping"],
    followUps: [
      { question: "Where exactly do you feel this? Can you describe the location?", options: ["Head", "Chest", "Abdomen", "Back", "Joint/Limb", "All over"] },
      { question: "On a scale of 1 to 10, with 10 being the worst, how severe would you rate this?", options: ["1-3 Mild", "4-6 Moderate", "7-8 Severe", "9-10 Worst ever"] },
      { question: "Is there anything that makes it worse? Certain activities, foods, time of day?", options: ["Physical activity", "Stress", "Eating", "Morning/Night", "Nothing specific"] },
      { question: "And is there anything that makes it better? Rest, medication, heat, ice?", options: ["Rest", "OTC medication", "Heat/Ice", "Position change", "Nothing helps"] },
      { question: "Are you experiencing any other symptoms along with this? Things like nausea, fatigue, dizziness, fever, or anything else?", options: ["Fatigue", "Nausea", "Dizziness", "Fever", "Headache", "None of these"] },
    ],
  },
  review_of_systems: {
    entry: "Now I'd like to do a quick check on your overall health. In the past two weeks, have you experienced any of these?\n\n• Fever, chills, or night sweats?\n• Any headaches or vision changes?\n• Chest pain, palpitations, or leg swelling?",
    options: ["None of these", "Yes, some of these"],
    followUps: [
      { question: "How about:\n• Cough, shortness of breath, or wheezing?\n• Nausea, vomiting, abdominal pain, or changes in bowel habits?\n• Any urinary symptoms — frequency, pain, or blood?", options: ["None of these", "Yes, some of these"] },
      { question: "A few more:\n• Any joint pain, back pain, or muscle weakness?\n• Skin changes — rashes, itching, or new moles?\n• Numbness, tingling, dizziness, or balance issues?", options: ["None of these", "Yes, some of these"] },
    ],
  },
  medications: {
    entry: "Let's go over your medications. Can you tell me what medications you're currently taking? Include the name and dose if you can.",
    options: ["Same medications as before", "I'll list them", "I'm not on any medications"],
    followUps: [
      { question: "Are you taking all of them as prescribed, or have you missed any doses or stopped any?", options: ["Yes, all as prescribed", "I miss some doses", "I stopped some", "I have questions about my meds"] },
      { question: "Have there been any changes to your medications since your last visit? Any new ones added or old ones stopped?", options: ["No changes", "New medication added", "Stopped a medication", "Dose changed"] },
      { question: "And do you have any allergies to medications, foods, or other substances? Any changes since last time?", options: ["No allergies", "Same allergies as on file", "New allergy to report"] },
    ],
  },
  wellness_screen: {
    entry: "These next questions are ones we ask everyone as part of routine care — they help us look out for your overall well-being.\n\nOver the past 2 weeks, how often have you had little interest or pleasure in doing things?",
    options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    followUps: [
      { question: "Over the past 2 weeks, how often have you been feeling down, depressed, or hopeless?", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"] },
      { question: "Over the past 2 weeks, how often have you been feeling nervous, anxious, or on edge?", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"] },
      { question: "And how often have you not been able to stop or control worrying?", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"] },
    ],
  },
  additional: {
    entry: "We're almost done! Is there anything else you'd like your provider to know about? Any other concerns, symptoms, or questions you want to discuss during your visit?",
    options: ["No, that covers everything", "Yes, one more thing"],
    followUps: [
      { question: "Noted. Anything else, or are we good to wrap up?", options: ["That's everything", "One more thing"] },
    ],
  },
  review_submit: {
    entry: "Thank you for taking the time to share all of this! Here's a summary of what I'll send to your provider:\n\n📋 Your chief complaint and symptom details\n💊 Your current medications and allergies\n🫀 Your review of systems responses\n🧠 Your wellness screening results\n\nA clinical summary (SOAP note) will be generated from our conversation and placed in your medical record.\n\nDo you confirm that the information you provided is accurate, and do you consent to it being shared with your healthcare provider?",
    options: ["Yes, submit my intake", "Wait, I want to add something"],
    followUps: [
      { question: "Your pre-visit intake has been submitted! ✅\n\nYour provider will review everything before your appointment. You can view your responses anytime in My Records on your Patient Portal.\n\nTake care and see you soon! 😊", options: ["Bye 👋", "← Back"] },
    ],
  },
};

/** Generate the next bot message using scripted logic */
export function getScriptedResponse(state: ConversationState, patientMessage: string): { reply: string; options?: string[]; nextPhase?: Phase; nextStep: number } {
  const script = PHASE_SCRIPTS[state.phase];

  // Step 0: show the entry message for this phase
  if (state.phaseStep === 0) {
    let entry = script.entry;
    // Inject real appointment details into confirm_appointment phase
    if (state.phase === "confirm_appointment" && (state as any).apptInfo) {
      const info = (state as any).apptInfo;
      entry = `Let me confirm your appointment. You're scheduled to see **${info.providerName}** on **${info.date}** at **${info.time}**${info.visitType ? ` for a ${info.visitType}` : ""}. Can you confirm you're planning to attend?`;
    }
    return { reply: entry, options: script.options || script.followUps[0]?.options, nextStep: 1 };
  }

  // Steps 1+: work through follow-ups
  const followUpIdx = state.phaseStep - 1;

  // Find the next applicable follow-up (skip those with failing conditions)
  for (let i = followUpIdx; i < script.followUps.length; i++) {
    const fu = script.followUps[i];
    if (fu.condition && !fu.condition(state.data)) continue; // skip this one
    return { reply: fu.question, options: fu.options, nextStep: i + 2 }; // +2 because step 0 is entry
  }

  // All follow-ups done or skipped — move to next applicable phase
  const nextPhase = getNextPhase(state.phase, state.data);
  if (nextPhase) {
    const nextScript = PHASE_SCRIPTS[nextPhase];
    let entry = nextScript.entry;
    // Inject real appointment details
    if (nextPhase === "confirm_appointment" && (state as any).apptInfo) {
      const info = (state as any).apptInfo;
      entry = `Let me confirm your appointment. You're scheduled to see **${info.providerName}** on **${info.date}** at **${info.time}**${info.visitType ? ` for a ${info.visitType}` : ""}. Can you confirm you're planning to attend?`;
    }
    return { reply: entry, options: nextScript.options, nextPhase, nextStep: 1 };
  }

  // Final phase complete
  return { reply: "Thank you! Your intake is complete. ✅", nextStep: state.phaseStep + 1 };
}

/** Build Claude system prompt for adaptive conversation */
export function buildClaudeSystemPrompt(state: ConversationState, language?: string): string {
  const collectedSummary = Object.entries(state.data)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("\n") || "Nothing collected yet";

  const langInstruction = language && language !== "en"
    ? `\n\nLANGUAGE SUPPORT:
- The patient's preferred language is: ${language}
- Speak to the patient in their preferred language (${language}). Ask questions in ${language}.
- If the patient responds in a DIFFERENT language (code-switching), understand their response regardless of language and continue the conversation fluidly.
- The patient may mix languages freely (e.g., English + Hindi, English + Spanish). This is normal — understand ALL input regardless of language.
- CRITICAL: Your internal clinical reasoning and ALL generated SOAP notes, clinical summaries, FHIR data, and medical documentation MUST ALWAYS be in ENGLISH regardless of what language the conversation is in.
- When summarizing what the patient said for clinical purposes, translate to English.
- Greet the patient in their preferred language.`
    : `\n\nLANGUAGE SUPPORT:
- Default language is English, but the patient may respond in ANY language or mix languages.
- If the patient starts speaking in another language, understand their input and respond in that language.
- CRITICAL: ALL generated SOAP notes, clinical summaries, and medical documentation MUST ALWAYS be in ENGLISH regardless of conversation language.`;

  return `You are a warm, empathetic, and highly skilled clinical intake assistant for MyAIDoctor.io. You're having a real conversation with a patient before their doctor's appointment. You should feel like a caring nurse who genuinely listens — not a form or a script.

YOUR PERSONALITY:
- Warm, patient, and conversational — like a trusted healthcare professional
- Acknowledge what the patient says BEFORE asking your next question
- If they share something concerning, show genuine empathy: "I'm sorry to hear that" / "That sounds really uncomfortable"
- If they give a short answer, gently probe: "Can you tell me a bit more about that?"
- If they're detailed, summarize what you heard: "So it sounds like..." then move forward
- Never list multiple questions at once — ask ONE thing, wait for the answer
- Use natural transitions, not "Now let's move to Section 5"
- Mirror their language level — if they're casual, be casual; if clinical, match it
${langInstruction}

CURRENT STATE:
- Phase: ${state.phase} (step ${state.phaseStep})
- Consent given: ${state.consentGiven}

DATA COLLECTED SO FAR:
${collectedSummary}

YOUR CONVERSATION FLOW (follow this order, but transition naturally):

1. CONSENT (if not given): Get HIPAA consent — explain data sharing simply, don't read legal text
2. VERIFY INFO: "Has your phone, email, or address changed?" → if yes, collect updates. Insurance still same? Co-pay preference (OPTIONAL — ok to skip)
3. CONFIRM APPOINTMENT: Quick confirmation they plan to attend
4. CHIEF COMPLAINT: "What brings you in today?" — This is the KEY question. Listen carefully. Their answer shapes EVERYTHING that follows.
5. SYMPTOM DEEP-DIVE: Based on what they said, use the OLDCARTS framework naturally:
   - Onset: "When did this start?"
   - Location: "Where exactly do you feel it?"
   - Duration: "How long does it last?"
   - Character: "What does it feel like?" (sharp, dull, burning, etc.)
   - Aggravating: "What makes it worse?"
   - Relieving: "What helps?"
   - Timing: "Is it constant or does it come and go?"
   - Severity: "On a scale of 1-10?"
   Don't ask ALL of these robotically — ask the ones that matter based on their complaint. A headache needs different follow-ups than knee pain.
6. TARGETED REVIEW OF SYSTEMS: Based on the chief complaint, ask about RELATED systems only:
   - Headache → ask neuro (vision, numbness), constitutional (fever)
   - Chest pain → ask cardiac (palpitations, swelling), respiratory (SOB, cough)
   - Back pain → ask neuro (numbness, weakness, bowel/bladder), MSK
   - GI complaint → ask GI details, constitutional
   Don't run through every body system — that's what scripted bots do
7. MEDICATIONS: "What meds are you on?" → "Taking them as prescribed?" → "Any new meds or changes?"
8. ALLERGIES: "Any allergies to medications, foods, or anything else?"
9. WELLNESS SCREEN (PHQ-2 + GAD-2): Preface with "These next questions are ones we ask everyone for overall health."
   - Ask EXACT validated questions (don't paraphrase):
     PHQ-2: "Over the past 2 weeks, how often have you had little interest or pleasure in doing things?" and "...feeling down, depressed, or hopeless?"
     GAD-2: "...feeling nervous, anxious, or on edge?" and "...not being able to stop or control worrying?"
   - Offer frequency options naturally: "Would you say not at all, several days, more than half the days, or nearly every day?"
10. ADDITIONAL: "Anything else you want your provider to know? Any questions for them?"
11. WRAP-UP: Summarize what you'll send, get final consent to transmit to provider, say goodbye warmly

CLINICAL PROTOCOLS (Schmitt-Thompson):
- If chief complaint matches a known protocol (headache, chest pain, abdominal pain, etc.), ask the protocol-specific screening questions
- RED FLAGS that require immediate response:
  * Chest pain + shortness of breath → possible ACS/PE → "Please call 911"
  * Worst headache of life → possible SAH → "Seek emergency care"
  * Suicidal ideation → "Please call 988" + warm handoff
  * Anaphylaxis signs → "Use EpiPen, call 911"
  * Stroke symptoms (facial droop, arm weakness, speech changes) → "Call 911 immediately"

QUICK-REPLY SUGGESTIONS (CRITICAL — include on EVERY response):
After your message, include 2-4 short tappable options in [brackets] that the patient can click instead of typing. These should be the most likely answers. Examples:
- After asking about onset: [A few days ago] [About a week] [2-3 weeks] [Over a month]
- After asking about severity: [1-3 Mild] [4-6 Moderate] [7-8 Severe] [9-10 Worst]
- After asking about quality: [Sharp] [Dull] [Throbbing] [Burning] [Aching]
- After asking about location: [Head] [Chest] [Abdomen] [Back] [Joint]
- After asking yes/no: [Yes] [No] [I'm not sure]
- After asking about meds: [Same as before] [I'll list them] [Not on any]
- PHQ/GAD questions: [Not at all] [Several days] [More than half the days] [Nearly every day]
- After asking about allergies: [No allergies] [Same as on file] [New allergy]
- General confirmations: [Yes] [No] [Tell me more]
NEVER skip the suggestions. Even for open-ended questions, suggest common answers.

PHASE MARKERS (include these in your response when transitioning — they're hidden from patient):
- When you naturally move to a new topic, include [PHASE:phase_name] at the END of your message
- Phase names: consent, verify_info, confirm_appointment, chief_complaint, symptom_details, review_of_systems, medications, wellness_screen, additional, review_submit
- When the intake is fully complete and patient has given final consent: include [INTAKE_COMPLETE]
- Example: "Great, let's talk about why you're coming in. What's been going on? [PHASE:chief_complaint]"

CRITICAL RULES:
- Ask ONE question at a time
- NEVER say "let's move to the next section" or reference sections/phases
- ALWAYS acknowledge what the patient said before your next question
- If they mention something alarming, address it immediately — don't stick to the script
- If they seem confused or frustrated, slow down and simplify
- The conversation should feel like it flows naturally, not like a checklist
- Keep responses to 1-3 sentences — you're chatting, not lecturing
- Use occasional emojis sparingly (1-2 per conversation, not every message)`;
}

/** Extract structured data from conversation for SOAP generation */
export function extractIntakeFromConversation(messages: ChatMessage[]): any {
  const patientMessages = messages.filter(m => m.role === "patient").map(m => m.text);
  const fullText = patientMessages.join(" ");
  
  return {
    chiefComplaint: patientMessages[0] || "", // First substantive patient response after consent
    hpiNarrative: fullText.slice(0, 1000),
    symptomDetails: {
      onset: extractField(fullText, /(?:started|began|onset)\s*(?:about\s*)?(.+?)(?:\.|,|$)/i),
      duration: extractField(fullText, /(?:for|lasting|duration)\s*(.+?)(?:\.|,|$)/i),
      severity: extractSeverity(fullText),
      location: extractField(fullText, /(?:location|where|feel it)\s*(?:is|in)?\s*(.+?)(?:\.|,|$)/i),
      quality: extractField(fullText, /(?:feels like|quality|type of)\s*(.+?)(?:\.|,|$)/i),
      aggravating: extractField(fullText, /(?:worse|aggravat|worsen)\s*(?:with|when|by)?\s*(.+?)(?:\.|,|$)/i),
      alleviating: extractField(fullText, /(?:better|relief|help)\s*(?:with|when|by)?\s*(.+?)(?:\.|,|$)/i),
      associatedSymptoms: [],
    },
    reviewOfSystems: {},
    medicationCompliance: extractField(fullText, /(?:taking|compliance|prescribed)\s*(.+?)(?:\.|,|$)/i) || "discussed in conversation",
    medicationChanges: [],
    allergyUpdates: [],
    surgicalHistoryUpdates: [],
    socialHistoryUpdates: {},
    reasonForVisit: patientMessages[0] || "",
    additionalConcerns: [],
    patientQuestions: [],
    conversationTranscript: messages.map(m => `${m.role === "bot" ? "Assistant" : "Patient"}: ${m.text}`).join("\n"),
  };
}

function extractField(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

function extractSeverity(text: string): number {
  const match = text.match(/(\d+)\s*(?:out of|\/)\s*10/i) || text.match(/severity.*?(\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

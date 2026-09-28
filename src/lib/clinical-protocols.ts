/**
 * MyAIDoctor Clinical Protocols Library
 * Based on: STCC, PHQ-9, GAD-7, AUDIT-C, USPSTF, FHIR R4
 * Drives all service conversations, screenings, and intake flows
 */

// ── Validated Screening Instruments ──────────────────────

export const SCREENING_INSTRUMENTS = {
  PHQ2: {
    name: "PHQ-2", category: "mental_health", description: "Depression quick screen",
    threshold: 3, escalateTo: "PHQ9",
    questions: [
      { id: "phq2_1", text: "Over the past 2 weeks, how often have you had little interest or pleasure in doing things?", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], scores: [0, 1, 2, 3] },
      { id: "phq2_2", text: "Over the past 2 weeks, how often have you been feeling down, depressed, or hopeless?", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], scores: [0, 1, 2, 3] },
    ],
  },
  PHQ9: {
    name: "PHQ-9", category: "mental_health", description: "Depression severity scale",
    thresholds: { 0: "minimal", 5: "mild", 10: "moderate", 15: "moderately_severe", 20: "severe" },
    questions: [
      { id: "phq9_1", text: "Little interest or pleasure in doing things" },
      { id: "phq9_2", text: "Feeling down, depressed, or hopeless" },
      { id: "phq9_3", text: "Trouble falling or staying asleep, or sleeping too much" },
      { id: "phq9_4", text: "Feeling tired or having little energy" },
      { id: "phq9_5", text: "Poor appetite or overeating" },
      { id: "phq9_6", text: "Feeling bad about yourself" },
      { id: "phq9_7", text: "Trouble concentrating on things" },
      { id: "phq9_8", text: "Moving or speaking slowly, or being fidgety and restless" },
      { id: "phq9_9", text: "Thoughts that you would be better off dead or of hurting yourself", redFlag: true },
    ],
    options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    scores: [0, 1, 2, 3],
  },
  GAD2: {
    name: "GAD-2", category: "mental_health", description: "Anxiety quick screen",
    threshold: 3, escalateTo: "GAD7",
    questions: [
      { id: "gad2_1", text: "Over the past 2 weeks, how often have you been feeling nervous, anxious, or on edge?", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], scores: [0, 1, 2, 3] },
      { id: "gad2_2", text: "Over the past 2 weeks, how often have you not been able to stop or control worrying?", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], scores: [0, 1, 2, 3] },
    ],
  },
  GAD7: {
    name: "GAD-7", category: "mental_health", description: "Anxiety severity scale",
    thresholds: { 0: "minimal", 5: "mild", 10: "moderate", 15: "severe" },
    questions: [
      { id: "gad7_1", text: "Feeling nervous, anxious, or on edge" },
      { id: "gad7_2", text: "Not being able to stop or control worrying" },
      { id: "gad7_3", text: "Worrying too much about different things" },
      { id: "gad7_4", text: "Trouble relaxing" },
      { id: "gad7_5", text: "Being so restless that it's hard to sit still" },
      { id: "gad7_6", text: "Becoming easily annoyed or irritable" },
      { id: "gad7_7", text: "Feeling afraid as if something awful might happen" },
    ],
    options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    scores: [0, 1, 2, 3],
  },
  AUDIT_C: {
    name: "AUDIT-C", category: "substance_use", description: "Alcohol use screening",
    thresholds: { male: 4, female: 3 },
    questions: [
      { id: "audit_1", text: "How often do you have a drink containing alcohol?", options: ["Never", "Monthly or less", "2-4 times a month", "2-3 times a week", "4 or more times a week"], scores: [0, 1, 2, 3, 4] },
      { id: "audit_2", text: "How many drinks containing alcohol do you have on a typical day when you are drinking?", options: ["1-2", "3-4", "5-6", "7-9", "10 or more"], scores: [0, 1, 2, 3, 4] },
      { id: "audit_3", text: "How often do you have 6 or more drinks on one occasion?", options: ["Never", "Less than monthly", "Monthly", "Weekly", "Daily or almost daily"], scores: [0, 1, 2, 3, 4] },
    ],
  },
  STOP_BANG: {
    name: "STOP-BANG", category: "sleep", description: "Sleep apnea screening",
    threshold: 3,
    questions: [
      { id: "sb_1", text: "Do you snore loudly?" },
      { id: "sb_2", text: "Do you often feel tired or sleepy during the day?" },
      { id: "sb_3", text: "Has anyone observed you stop breathing during sleep?" },
      { id: "sb_4", text: "Do you have or are you being treated for high blood pressure?" },
    ],
  },
  FALL_RISK: {
    name: "CDC STEADI", category: "fall_risk", description: "Fall risk screening (65+)",
    threshold: 1,
    questions: [
      { id: "fall_1", text: "Have you fallen in the past year?" },
      { id: "fall_2", text: "Do you feel unsteady when standing or walking?" },
      { id: "fall_3", text: "Do you worry about falling?" },
    ],
  },
};

// ── Service-Specific Protocol Flows ─────────────────────

export const SERVICE_PROTOCOLS: Record<string, {
  name: string; description: string; category: string;
  phases: { id: string; name: string; questions: { id: string; text: string; type: string; options?: string[]; required?: boolean; redFlag?: string }[] }[];
  screenings?: string[]; // keys into SCREENING_INSTRUMENTS
  redFlags?: string[];
}> = {
  pre_visit_intake: {
    name: "Pre-Visit Clinical Intake", description: "Comprehensive pre-visit data collection",
    category: "intake",
    screenings: ["PHQ2", "GAD2", "AUDIT_C"],
    redFlags: [
      "Chest pain with shortness of breath", "Worst headache of life", "Sudden vision loss",
      "Active suicidal ideation", "Severe bleeding", "Stroke symptoms (face drooping, arm weakness, speech difficulty)",
    ],
    phases: [
      { id: "consent", name: "Consent & Verification", questions: [
        { id: "consent_hipaa", text: "This intake is HIPAA-protected. Your responses will be shared with your provider. Do you consent to proceed?", type: "confirm", required: true },
      ]},
      { id: "verify", name: "Identity Verification", questions: [
        { id: "verify_name", text: "Can you confirm your full name?", type: "text", required: true },
        { id: "verify_dob", text: "And your date of birth?", type: "date", required: true },
      ]},
      { id: "appointment", name: "Appointment Confirmation", questions: [
        { id: "appt_confirm", text: "I see you have an appointment coming up. Can you confirm you plan to attend?", type: "confirm" },
        { id: "appt_insurance", text: "Do you have the same insurance as your last visit?", type: "yesno" },
        { id: "appt_insurance_change", text: "What is your new insurance carrier and member ID?", type: "text", required: false },
      ]},
      { id: "chief_complaint", name: "Chief Complaint", questions: [
        { id: "cc_main", text: "What is the main reason for your visit today?", type: "text", required: true },
        { id: "cc_onset", text: "When did this start?", type: "text" },
        { id: "cc_severity", text: "On a scale of 0 to 10, how severe is this?", type: "scale" },
        { id: "cc_progress", text: "Is it getting better, worse, or staying the same?", type: "select", options: ["Getting better", "Getting worse", "Staying the same"] },
        { id: "cc_tried", text: "What have you tried so far to manage this?", type: "text" },
      ]},
      { id: "ros", name: "Review of Systems", questions: [
        { id: "ros_constitutional", text: "Have you had any fever, chills, unintentional weight changes, or unusual fatigue?", type: "text" },
        { id: "ros_cardio", text: "Any chest pain, palpitations, leg swelling, or shortness of breath?", type: "text", redFlag: "chest_pain" },
        { id: "ros_respiratory", text: "Any cough, wheezing, or difficulty breathing?", type: "text" },
        { id: "ros_gi", text: "Any abdominal pain, nausea, vomiting, diarrhea, or constipation?", type: "text" },
        { id: "ros_neuro", text: "Any headaches, dizziness, numbness, tingling, or weakness?", type: "text", redFlag: "neuro_emergency" },
        { id: "ros_msk", text: "Any joint pain, stiffness, muscle aches, or back pain?", type: "text" },
        { id: "ros_psych", text: "Any changes in mood, sleep, appetite, or energy level?", type: "text" },
      ]},
      { id: "medications", name: "Medication Reconciliation", questions: [
        { id: "med_changes", text: "Have there been any changes to your medications since your last visit?", type: "yesno" },
        { id: "med_new", text: "Have you started any new medications, supplements, or over-the-counter products?", type: "text" },
        { id: "med_compliance", text: "Are you taking all medications as prescribed?", type: "yesno" },
        { id: "med_side_effects", text: "Are you experiencing any side effects from your medications?", type: "text" },
        { id: "med_refills", text: "Do you need any prescription refills?", type: "yesno" },
      ]},
      { id: "wellness", name: "PHQ-2 / GAD-2 Wellness Screen", questions: [
        { id: "wellness_intro", text: "These next questions are ones we ask everyone for their overall health and wellbeing.", type: "info" },
      ]},
      { id: "additional", name: "Additional Concerns", questions: [
        { id: "add_questions", text: "Is there anything else you want your provider to know or any questions for your visit?", type: "text" },
        { id: "add_sdoh_food", text: "In the past 12 months, have you worried about running out of food before getting money to buy more?", type: "yesno" },
        { id: "add_sdoh_transport", text: "Do you have reliable transportation to medical appointments?", type: "yesno" },
      ]},
    ],
  },
  appointment_reminder: {
    name: "Appointment Reminder", description: "Confirm upcoming appointment",
    category: "scheduling",
    phases: [
      { id: "confirm", name: "Appointment Confirmation", questions: [
        { id: "ar_confirm", text: "You have an appointment coming up. Can you confirm you plan to attend?", type: "confirm", required: true },
        { id: "ar_time", text: "Can you arrive 15 minutes early for check-in?", type: "confirm" },
        { id: "ar_insurance", text: "Please bring your insurance card and photo ID.", type: "info" },
        { id: "ar_fasting", text: "If your doctor ordered lab work, you may need to fast. Were you given fasting instructions?", type: "yesno" },
        { id: "ar_questions", text: "Do you have any questions about your upcoming visit?", type: "text" },
      ]},
    ],
    redFlags: [],
    screenings: [],
  },
  refill_manager: {
    name: "Medication Refill", description: "Process prescription refill request",
    category: "medications",
    phases: [
      { id: "verify", name: "Verification", questions: [
        { id: "rf_name", text: "Can you confirm your full name and date of birth?", type: "text", required: true },
      ]},
      { id: "medication", name: "Medication Details", questions: [
        { id: "rf_which", text: "Which medication(s) do you need refilled?", type: "text", required: true },
        { id: "rf_dose", text: "What dose and how often do you take it?", type: "text" },
        { id: "rf_pharmacy", text: "Which pharmacy should we send it to?", type: "text" },
        { id: "rf_last_refill", text: "When was your last refill?", type: "text" },
        { id: "rf_supply", text: "How many days of medication do you have left?", type: "text" },
      ]},
      { id: "compliance", name: "Medication Compliance", questions: [
        { id: "rf_taking", text: "Are you taking this medication as prescribed?", type: "yesno" },
        { id: "rf_side_effects", text: "Have you noticed any side effects?", type: "text" },
        { id: "rf_changes", text: "Has another doctor changed your dose or added new medications?", type: "yesno" },
      ]},
    ],
    redFlags: ["Opioid refill request", "Benzodiazepine early refill", "Controlled substance"],
    screenings: [],
  },
  schedule_assistant: {
    name: "Schedule / Reschedule", description: "Manage appointments",
    category: "scheduling",
    phases: [
      { id: "intent", name: "Scheduling Intent", questions: [
        { id: "sa_action", text: "Would you like to schedule a new appointment, reschedule, or cancel?", type: "select", options: ["Schedule new", "Reschedule", "Cancel"], required: true },
        { id: "sa_reason", text: "What is the reason for the appointment?", type: "text" },
        { id: "sa_urgency", text: "Is this urgent or can it wait for a routine opening?", type: "select", options: ["Urgent - within 24-48 hours", "Soon - within 1-2 weeks", "Routine - anytime"] },
        { id: "sa_provider", text: "Do you have a preferred provider?", type: "text" },
        { id: "sa_time_pref", text: "Do you have a preferred day or time?", type: "text" },
      ]},
    ],
    redFlags: [],
    screenings: [],
  },
  referral_coordinator: {
    name: "Referral Coordinator", description: "Specialist referral processing",
    category: "referral",
    phases: [
      { id: "referral", name: "Referral Details", questions: [
        { id: "ref_specialty", text: "What type of specialist do you need to see?", type: "text", required: true },
        { id: "ref_reason", text: "What is the reason for the referral?", type: "text", required: true },
        { id: "ref_pcp_ordered", text: "Did your primary care doctor order this referral?", type: "yesno" },
        { id: "ref_insurance_auth", text: "Does your insurance require a referral authorization?", type: "yesno" },
        { id: "ref_location_pref", text: "Do you have a preferred location or specialist?", type: "text" },
        { id: "ref_urgency", text: "How urgently do you need to be seen?", type: "select", options: ["As soon as possible", "Within 2 weeks", "Within a month", "Routine"] },
        { id: "ref_records", text: "Do you have any imaging, lab results, or records to send to the specialist?", type: "yesno" },
      ]},
    ],
    redFlags: [],
    screenings: [],
  },
  post_visit_followup: {
    name: "Post-Visit Follow-Up", description: "Recovery check-in after visit",
    category: "followup",
    phases: [
      { id: "recovery", name: "Recovery Assessment", questions: [
        { id: "pvf_overall", text: "How are you feeling since your last visit?", type: "select", options: ["Much better", "Somewhat better", "About the same", "Somewhat worse", "Much worse"], required: true },
        { id: "pvf_pain", text: "On a scale of 0-10, what is your current pain level?", type: "scale" },
        { id: "pvf_meds_started", text: "Were you prescribed any new medications? If so, have you started them?", type: "yesno" },
        { id: "pvf_side_effects", text: "Are you having any side effects or reactions?", type: "text" },
        { id: "pvf_instructions", text: "Were you able to follow the care instructions given at your visit?", type: "yesno" },
        { id: "pvf_wound", text: "If you had a procedure, how is the wound or incision looking? Any redness, swelling, drainage, or fever?", type: "text", redFlag: "wound_infection" },
        { id: "pvf_concerns", text: "Do you have any new concerns or symptoms since your visit?", type: "text" },
        { id: "pvf_followup", text: "Have you scheduled your follow-up appointment?", type: "yesno" },
      ]},
    ],
    redFlags: ["Fever after procedure", "Wound infection signs", "Worsening symptoms", "Uncontrolled pain"],
    screenings: [],
  },
  lab_results_review: {
    name: "Lab Results Review", description: "Walk through lab results with patient",
    category: "labs",
    phases: [
      { id: "results", name: "Results Discussion", questions: [
        { id: "lr_which", text: "Which lab tests would you like to discuss?", type: "text", required: true },
        { id: "lr_received", text: "Have you received your results through the patient portal?", type: "yesno" },
        { id: "lr_understanding", text: "Do you have any questions about what your results mean?", type: "text" },
        { id: "lr_symptoms", text: "Have you noticed any new symptoms since your lab work was done?", type: "text" },
        { id: "lr_fasting", text: "If blood sugar or cholesterol was tested, were you fasting as instructed?", type: "yesno" },
        { id: "lr_followup", text: "Did your provider recommend any follow-up tests or actions?", type: "text" },
      ]},
    ],
    redFlags: [],
    screenings: [],
  },
  new_patient_onboarding: {
    name: "New Patient Onboarding", description: "Complete registration and history",
    category: "intake",
    screenings: ["PHQ2", "GAD2", "AUDIT_C"],
    phases: [
      { id: "demographics", name: "Personal Information", questions: [
        { id: "np_name", text: "What is your full legal name?", type: "text", required: true },
        { id: "np_dob", text: "What is your date of birth?", type: "date", required: true },
        { id: "np_gender", text: "What is your gender?", type: "select", options: ["Male", "Female", "Non-binary", "Prefer not to say"] },
        { id: "np_phone", text: "What is your primary phone number?", type: "text", required: true },
        { id: "np_email", text: "What is your email address?", type: "text" },
        { id: "np_address", text: "What is your home address?", type: "text" },
        { id: "np_emergency", text: "Who should we contact in an emergency? Please provide their name, relationship, and phone number.", type: "text" },
      ]},
      { id: "insurance", name: "Insurance Information", questions: [
        { id: "np_insurance", text: "What is your insurance provider?", type: "text" },
        { id: "np_member_id", text: "What is your member or policy ID number?", type: "text" },
        { id: "np_group", text: "What is your group number?", type: "text" },
        { id: "np_pcp", text: "Who is your primary care physician?", type: "text" },
      ]},
      { id: "medical_history", name: "Medical History", questions: [
        { id: "np_conditions", text: "Do you have any medical conditions? For example: diabetes, high blood pressure, asthma, heart disease?", type: "text" },
        { id: "np_surgeries", text: "Have you had any surgeries? If so, what and when?", type: "text" },
        { id: "np_hospitalizations", text: "Have you been hospitalized in the last 5 years? If so, for what?", type: "text" },
        { id: "np_family_hx", text: "Do any close family members have serious health conditions like heart disease, diabetes, cancer, or mental illness?", type: "text" },
      ]},
      { id: "medications_allergies", name: "Medications & Allergies", questions: [
        { id: "np_meds", text: "What medications are you currently taking? Please include the name, dose, and how often.", type: "text" },
        { id: "np_otc", text: "Do you take any over-the-counter medications, vitamins, or supplements?", type: "text" },
        { id: "np_allergies", text: "Do you have any allergies to medications, foods, or environmental allergens? What happens when you're exposed?", type: "text", required: true },
      ]},
      { id: "social_history", name: "Social & Lifestyle", questions: [
        { id: "np_tobacco", text: "Do you currently use any tobacco products, including vaping or e-cigarettes?", type: "yesno" },
        { id: "np_exercise", text: "How often do you exercise, and what type of activity?", type: "text" },
        { id: "np_occupation", text: "What is your current occupation?", type: "text" },
      ]},
      { id: "reason", name: "Reason for Visit", questions: [
        { id: "np_reason", text: "What is the main reason you're establishing care with us?", type: "text", required: true },
        { id: "np_goals", text: "Are there any specific health goals or concerns you'd like to address?", type: "text" },
      ]},
    ],
    redFlags: ["Active suicidal ideation", "Chest pain", "Stroke symptoms"],
  },
  chronic_disease_checkin: {
    name: "Chronic Disease Check-In", description: "Monthly monitoring for chronic conditions",
    category: "chronic_care",
    screenings: ["PHQ2"],
    phases: [
      { id: "condition_review", name: "Condition Status", questions: [
        { id: "cd_overall", text: "How have you been feeling overall this month?", type: "select", options: ["Great", "Good", "Fair", "Not well", "Poorly"], required: true },
        { id: "cd_symptoms", text: "Have you noticed any new or worsening symptoms?", type: "text" },
        { id: "cd_vitals", text: "Have you been checking your vitals at home (blood pressure, blood sugar, weight)? What are your recent readings?", type: "text" },
        { id: "cd_pain", text: "On a scale of 0-10, what is your average pain level this month?", type: "scale" },
      ]},
      { id: "med_compliance", name: "Medication Compliance", questions: [
        { id: "cd_meds_taking", text: "Are you taking all your medications as prescribed?", type: "yesno" },
        { id: "cd_meds_missed", text: "Have you missed any doses in the past week?", type: "text" },
        { id: "cd_meds_effects", text: "Any new side effects from your medications?", type: "text" },
        { id: "cd_refills", text: "Do you need any medication refills?", type: "yesno" },
      ]},
      { id: "lifestyle", name: "Lifestyle & Self-Care", questions: [
        { id: "cd_diet", text: "How has your diet been this month? Any changes?", type: "text" },
        { id: "cd_exercise", text: "How often have you been exercising?", type: "select", options: ["Daily", "Several times a week", "Once a week", "Rarely", "Not at all"] },
        { id: "cd_sleep", text: "How is your sleep quality?", type: "select", options: ["Excellent", "Good", "Fair", "Poor"] },
        { id: "cd_stress", text: "How would you rate your stress level?", type: "select", options: ["Low", "Moderate", "High", "Very high"] },
      ]},
      { id: "provider_concerns", name: "Concerns for Provider", questions: [
        { id: "cd_questions", text: "Do you have any questions or concerns for your healthcare team?", type: "text" },
        { id: "cd_appointment", text: "Do you need to schedule an appointment?", type: "yesno" },
      ]},
    ],
    redFlags: [
      "Blood sugar below 70 or above 400",
      "Blood pressure above 180/120",
      "Weight gain of 5+ lbs in a week (heart failure)",
      "Severe chest pain or shortness of breath",
      "Signs of infection in diabetic foot",
    ],
  },
  appointment_scheduler: {
    name: "Appointment Scheduler", description: "Book a new appointment",
    category: "scheduling",
    phases: [
      { id: "booking", name: "Appointment Booking", questions: [
        { id: "as_reason", text: "What is the reason you need to see a doctor?", type: "text", required: true },
        { id: "as_urgency", text: "How urgent is this?", type: "select", options: ["Emergency - need to be seen today", "Urgent - within 24-48 hours", "Soon - within 1-2 weeks", "Routine - anytime is fine"], required: true },
        { id: "as_provider", text: "Would you like to see a specific provider, or is any available doctor okay?", type: "text" },
        { id: "as_type", text: "Would you prefer an in-person visit or a telehealth/video visit?", type: "select", options: ["In-person", "Telehealth/Video", "Either is fine"] },
        { id: "as_time_pref", text: "Do you have a preferred day of the week or time of day?", type: "text" },
        { id: "as_new_patient", text: "Are you a new patient or an established patient?", type: "select", options: ["New patient", "Established patient"] },
      ]},
    ],
    redFlags: ["Emergency symptoms described"],
    screenings: [],
  },
};

// ── Chronic Disease Protocol Definitions ────────────────

export const CHRONIC_DISEASE_PROTOCOLS: Record<string, {
  name: string; condition: string;
  questions: { id: string; text: string; type: string; redFlag?: string }[];
}> = {
  diabetes: {
    name: "Diabetes Pre-Visit Protocol", condition: "diabetes",
    questions: [
      { id: "dm_a1c", text: "Do you know your last A1C result? If so, what was it and when was it checked?" },
      { id: "dm_glucose", text: "What have your home blood sugar readings been? Fasting and after meals?" },
      { id: "dm_hypo", text: "Have you had any episodes of low blood sugar (shakiness, sweating, confusion)?", redFlag: "severe_hypoglycemia" },
      { id: "dm_hyper", text: "Have you had any episodes of very high blood sugar?" },
      { id: "dm_meds", text: "Are you taking your diabetes medications as prescribed? Any missed doses?" },
      { id: "dm_insulin", text: "If you take insulin, what type, how many units, and are you rotating injection sites?" },
      { id: "dm_diet", text: "How has your diet been? Are you counting carbs or following a meal plan?" },
      { id: "dm_feet", text: "Have you noticed any numbness, tingling, wounds, or sores on your feet?", redFlag: "diabetic_foot_ulcer" },
      { id: "dm_vision", text: "Any changes in your vision? When was your last eye exam?" },
      { id: "dm_bp", text: "What have your home blood pressure readings been?" },
    ].map(q => ({ ...q, type: "text" })),
  },
  hypertension: {
    name: "Hypertension Pre-Visit Protocol", condition: "hypertension",
    questions: [
      { id: "htn_readings", text: "What have your home blood pressure readings been over the last 1-2 weeks?" },
      { id: "htn_arm", text: "Which arm do you use to check, and what type of monitor?" },
      { id: "htn_meds", text: "Are you taking your blood pressure medications as prescribed?" },
      { id: "htn_side_effects", text: "Any side effects from your blood pressure medications (dizziness, fatigue, cough)?" },
      { id: "htn_headache", text: "Have you had any severe headaches, dizziness, or vision changes?", redFlag: "hypertensive_crisis" },
      { id: "htn_diet", text: "How has your sodium intake been? Are you following a low-salt diet?" },
      { id: "htn_exercise", text: "How often have you been exercising?" },
      { id: "htn_stress", text: "How would you rate your stress levels?" },
      { id: "htn_weight", text: "Have you had any weight changes?" },
    ].map(q => ({ ...q, type: "text" })),
  },
  heart_failure: {
    name: "Heart Failure Pre-Visit Protocol", condition: "heart failure",
    questions: [
      { id: "chf_weight", text: "What has your daily weight been for the past week? Any sudden increases?", redFlag: "chf_weight_gain" },
      { id: "chf_sob", text: "Have you had shortness of breath at rest or with activity?" },
      { id: "chf_pillows", text: "How many pillows do you need to sleep comfortably?" },
      { id: "chf_pnd", text: "Do you ever wake up at night gasping for air?" },
      { id: "chf_swelling", text: "Have you noticed any ankle or leg swelling?" },
      { id: "chf_fatigue", text: "How is your energy level? How far can you walk?" },
      { id: "chf_meds", text: "Are you taking your heart failure medications, including your diuretic (water pill)?" },
      { id: "chf_sodium", text: "Have you been following your sodium restriction?" },
      { id: "chf_fluid", text: "Have you been following your fluid intake restriction?" },
    ].map(q => ({ ...q, type: "text" })),
  },
  asthma_copd: {
    name: "Asthma/COPD Pre-Visit Protocol", condition: "asthma",
    questions: [
      { id: "ac_control", text: "How would you rate your breathing control in the past 4 weeks?", type: "select" },
      { id: "ac_rescue", text: "How often have you used your rescue inhaler in the past week?" },
      { id: "ac_nighttime", text: "How often do breathing symptoms wake you at night?" },
      { id: "ac_activity", text: "Has breathing limited your activities or exercise?" },
      { id: "ac_triggers", text: "Have you been exposed to any triggers (smoke, allergens, weather changes)?" },
      { id: "ac_meds", text: "Are you using your controller/maintenance inhaler daily as prescribed?" },
      { id: "ac_technique", text: "Are you comfortable with your inhaler technique?" },
      { id: "ac_peak_flow", text: "If you use a peak flow meter, what are your recent readings?" },
      { id: "ac_er", text: "Have you had any emergency room visits or hospitalizations for breathing problems?" },
    ].map(q => ({ ...q, type: q.type || "text" })),
  },
};

// ── Red Flag Detection ──────────────────────────────────

export const RED_FLAG_PATTERNS = [
  { pattern: /chest pain.*breath|breath.*chest pain|heart attack/i, flag: "Possible cardiac emergency", severity: "critical" },
  { pattern: /worst headache|sudden.*headache|thunderclap/i, flag: "Possible subarachnoid hemorrhage", severity: "critical" },
  { pattern: /stroke|face droop|arm weak|slurred speech|BE-?FAST/i, flag: "Possible stroke", severity: "critical" },
  { pattern: /suicid|kill myself|want to die|better off dead|end my life/i, flag: "Suicidal ideation detected", severity: "critical" },
  { pattern: /can't breathe|unable to breathe|severe.*breathing/i, flag: "Respiratory emergency", severity: "critical" },
  { pattern: /sudden.*vision loss|blind|can't see/i, flag: "Vision emergency", severity: "critical" },
  { pattern: /blood.*cough|coughing.*blood|hemoptysis/i, flag: "Hemoptysis", severity: "high" },
  { pattern: /blood sugar.*under.*70|glucose.*40|glucose.*50|severe.*hypoglycemia/i, flag: "Severe hypoglycemia", severity: "high" },
  { pattern: /blood pressure.*180|bp.*200|180\/1[12]0/i, flag: "Hypertensive crisis", severity: "high" },
  { pattern: /weight gain.*5.*pound.*week|gained.*5.*lbs.*week/i, flag: "Possible heart failure decompensation", severity: "high" },
  { pattern: /wound.*infected|red.*swollen.*warm|pus|abscess.*diabetic/i, flag: "Possible wound infection", severity: "moderate" },
  { pattern: /fever.*procedure|infection.*surgery|post-op.*fever/i, flag: "Post-procedural infection concern", severity: "moderate" },
];

export function detectRedFlags(text: string): { flag: string; severity: string }[] {
  return RED_FLAG_PATTERNS
    .filter(rf => rf.pattern.test(text))
    .map(rf => ({ flag: rf.flag, severity: rf.severity }));
}

// ── Protocol Selection Engine ───────────────────────────

export function selectProtocols(patient: {
  conditions?: string[]; medications?: string[]; age?: number; gender?: string;
}, visitType: string): string[] {
  const protocols: string[] = [];
  const conditions = (patient.conditions || []).map(c => c.toLowerCase());

  // Always include for pre-visit
  if (visitType === "pre_visit_intake" || visitType === "new_patient_onboarding") {
    protocols.push("PHQ2", "GAD2");
    if (patient.age && patient.age >= 18) protocols.push("AUDIT_C");
    if (patient.age && patient.age >= 65) protocols.push("FALL_RISK");
  }

  // Chronic disease protocols
  if (conditions.some(c => /diabetes|diabetic|a1c|glucose/i.test(c))) protocols.push("DIABETES");
  if (conditions.some(c => /hypertension|high blood pressure|htn/i.test(c))) protocols.push("HYPERTENSION");
  if (conditions.some(c => /heart failure|chf|cardiomyopathy/i.test(c))) protocols.push("HEART_FAILURE");
  if (conditions.some(c => /asthma|copd|bronchitis/i.test(c))) protocols.push("ASTHMA_COPD");

  // Sleep screening if sleep complaints
  if (conditions.some(c => /sleep|insomnia|snoring|apnea/i.test(c))) protocols.push("STOP_BANG");

  return [...new Set(protocols)];
}

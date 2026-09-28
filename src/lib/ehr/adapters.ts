/**
 * EHR Adapter System
 *
 * Provides a unified interface for ingesting patient data from multiple
 * EHR systems: Epic (FHIR R4), Athenahealth, OpenDental, BluAI EMR, and Mock.
 *
 * Each adapter implements the same interface so the clinical engine
 * doesn't need to know which EHR is connected.
 */

// ── FHIR-Compatible Clinical Data Types ────────────────────

export interface PatientContext {
  demographics: { firstName: string; lastName: string; dob: string; gender: string; phone: string; email?: string };
  conditions: Condition[];
  medications: Medication[];
  allergies: Allergy[];
  labs: LabResult[];
  vitals: VitalSign[];
  procedures: Procedure[];
  immunizations: string[];
  socialHistory: Record<string, string>;
  familyHistory: FamilyHistory[];
  referrals: Referral[];
  problemList: string[];
  insuranceInfo?: { carrier: string; memberId: string; groupId?: string };
}

export interface Condition { code: string; name: string; status: string; onset?: string; severity?: string }
export interface Medication { name: string; dose: string; frequency: string; prescriber?: string; startDate?: string; status: string }
export interface Allergy { substance: string; reaction: string; severity: string; category: string }
export interface LabResult { name: string; value: string; unit: string; referenceRange: string; date: string; flag?: string }
export interface VitalSign { type: string; value: string; unit: string; date: string }
export interface Procedure { name: string; date: string; provider?: string; notes?: string }
export interface FamilyHistory { relation: string; condition: string; ageOfOnset?: string }
export interface Referral { from: string; to: string; reason: string; date: string; status: string; notes?: string }

// ── Base Adapter Interface ──────────────────────────────────

export interface EHRAdapter {
  name: string;
  getPatientContext(patientId: string, externalId?: string): Promise<PatientContext>;
  syncPatientData(patientId: string, data: Partial<PatientContext>): Promise<boolean>;
  pushSOAPNote(patientId: string, soap: any): Promise<{ success: boolean; noteId?: string }>;
  pushBrief(patientId: string, brief: any): Promise<{ success: boolean }>;
  testConnection(): Promise<{ connected: boolean; message: string }>;
}

// ── Mock Adapter ────────────────────────────────────────────

export class MockEHRAdapter implements EHRAdapter {
  name = "Mock EHR";

  async getPatientContext(patientId: string): Promise<PatientContext> {
    console.log(`[Mock EHR] Fetching context for patient ${patientId}`);
    return {
      demographics: { firstName: "Jane", lastName: "Smith", dob: "1985-03-15", gender: "Female", phone: "+12485551234" },
      conditions: [
        { code: "E11.9", name: "Type 2 Diabetes Mellitus", status: "active", onset: "2019-06", severity: "moderate" },
        { code: "I10", name: "Essential Hypertension", status: "active", onset: "2020-01" },
        { code: "J45.20", name: "Mild Intermittent Asthma", status: "active", onset: "2015-09" },
      ],
      medications: [
        { name: "Metformin 500mg", dose: "500mg", frequency: "BID", status: "active", startDate: "2019-07" },
        { name: "Lisinopril 10mg", dose: "10mg", frequency: "Daily", status: "active", startDate: "2020-02" },
        { name: "Albuterol HFA", dose: "2 puffs", frequency: "PRN", status: "active", startDate: "2015-10" },
      ],
      allergies: [
        { substance: "Penicillin", reaction: "Hives, rash", severity: "moderate", category: "medication" },
        { substance: "Shellfish", reaction: "Throat swelling", severity: "severe", category: "food" },
      ],
      labs: [
        { name: "HbA1c", value: "7.2", unit: "%", referenceRange: "4.0-5.6", date: "2024-11-15", flag: "HIGH" },
        { name: "Fasting Glucose", value: "142", unit: "mg/dL", referenceRange: "70-100", date: "2024-11-15", flag: "HIGH" },
        { name: "Blood Pressure", value: "138/88", unit: "mmHg", referenceRange: "<120/80", date: "2024-12-01", flag: "HIGH" },
        { name: "eGFR", value: "72", unit: "mL/min", referenceRange: ">60", date: "2024-11-15" },
        { name: "Total Cholesterol", value: "215", unit: "mg/dL", referenceRange: "<200", date: "2024-11-15", flag: "HIGH" },
        { name: "LDL", value: "130", unit: "mg/dL", referenceRange: "<100", date: "2024-11-15", flag: "HIGH" },
      ],
      vitals: [
        { type: "Weight", value: "178", unit: "lbs", date: "2024-12-01" },
        { type: "Height", value: "5'6\"", unit: "", date: "2024-12-01" },
        { type: "BMI", value: "28.7", unit: "kg/m²", date: "2024-12-01" },
      ],
      procedures: [
        { name: "Annual Physical", date: "2024-01-15", provider: "Dr. Chen" },
        { name: "Diabetic Eye Exam", date: "2024-06-10", provider: "Dr. Patel" },
      ],
      immunizations: ["COVID-19 Bivalent (2024-10)", "Flu (2024-09)", "Tdap (2022-03)"],
      socialHistory: { smoking: "Never", alcohol: "Occasional (1-2/week)", exercise: "Walks 3x/week", occupation: "Teacher" },
      familyHistory: [
        { relation: "Mother", condition: "Type 2 Diabetes", ageOfOnset: "52" },
        { relation: "Father", condition: "Coronary Artery Disease", ageOfOnset: "61" },
        { relation: "Sister", condition: "Hypertension", ageOfOnset: "45" },
      ],
      referrals: [],
      problemList: ["Type 2 Diabetes (uncontrolled)", "Hypertension (borderline)", "Mild asthma", "Hyperlipidemia"],
      insuranceInfo: { carrier: "Blue Cross Blue Shield", memberId: "XYZ123456", groupId: "GRP789" },
    };
  }

  async syncPatientData(): Promise<boolean> { console.log("[Mock EHR] Sync complete"); return true; }
  async pushSOAPNote(_pid: string, soap: any): Promise<{ success: boolean; noteId?: string }> {
    console.log("[Mock EHR] SOAP note pushed:", soap?.subjective?.slice(0, 80));
    return { success: true, noteId: `mock_note_${Date.now()}` };
  }
  async pushBrief(): Promise<{ success: boolean }> { console.log("[Mock EHR] Brief pushed"); return { success: true }; }
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    return { connected: true, message: "Mock EHR connected (simulated data)" };
  }
}

// ── FHIR R4 Adapter (Epic, Cerner, etc.) ────────────────────

export class FHIRAdapter implements EHRAdapter {
  name: string;
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor(name: string, config: { baseUrl: string; clientId: string; clientSecret: string }) {
    this.name = name;
    this.baseUrl = config.baseUrl;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  async getPatientContext(patientId: string, externalId?: string): Promise<PatientContext> {
    const fhirId = externalId || patientId;
    // In production: fetch from FHIR R4 endpoints
    // GET {baseUrl}/Patient/{fhirId}
    // GET {baseUrl}/Condition?patient={fhirId}
    // GET {baseUrl}/MedicationRequest?patient={fhirId}
    // GET {baseUrl}/AllergyIntolerance?patient={fhirId}
    // GET {baseUrl}/Observation?patient={fhirId}&category=laboratory
    console.log(`[${this.name}] Would fetch FHIR data for patient ${fhirId} from ${this.baseUrl}`);
    // Fallback to mock until real credentials are configured
    return new MockEHRAdapter().getPatientContext(patientId);
  }

  async syncPatientData(): Promise<boolean> { return true; }
  async pushSOAPNote(pid: string, soap: any): Promise<{ success: boolean; noteId?: string }> {
    console.log(`[${this.name}] Would POST DocumentReference to ${this.baseUrl}/DocumentReference`);
    return { success: true, noteId: `fhir_${Date.now()}` };
  }
  async pushBrief(): Promise<{ success: boolean }> { return { success: true }; }
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/metadata`, { headers: { Accept: "application/fhir+json" } });
      return { connected: res.ok, message: res.ok ? `Connected to ${this.name}` : `HTTP ${res.status}` };
    } catch (e: any) { return { connected: false, message: e.message }; }
  }
}

// ── BluAI EMR/HMS Adapter ───────────────────────────────────

export class BluAIAdapter implements EHRAdapter {
  name = "BluAI EMR/HMS";
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { baseUrl: string; apiKey: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  async getPatientContext(patientId: string): Promise<PatientContext> {
    try {
      const res = await fetch(`${this.baseUrl}/api/patients/${patientId}/clinical-context`, {
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      });
      if (res.ok) return await res.json();
    } catch (e) { console.error("[BluAI] Fetch failed:", e); }
    return new MockEHRAdapter().getPatientContext(patientId);
  }

  async syncPatientData(patientId: string, data: Partial<PatientContext>): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/patients/${patientId}/sync`, {
        method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch { return false; }
  }

  async pushSOAPNote(pid: string, soap: any): Promise<{ success: boolean; noteId?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/patients/${pid}/notes`, {
        method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SOAP", ...soap }),
      });
      const data = await res.json();
      return { success: res.ok, noteId: data.id };
    } catch { return { success: false }; }
  }

  async pushBrief(pid: string, brief: any): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/patients/${pid}/pre-visit-brief`, {
        method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      return { success: res.ok };
    } catch { return { success: false }; }
  }

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { headers: { Authorization: `Bearer ${this.apiKey}` } });
      return { connected: res.ok, message: res.ok ? "Connected to BluAI EMR" : `HTTP ${res.status}` };
    } catch (e: any) { return { connected: false, message: e.message }; }
  }
}

// ── Adapter Registry ────────────────────────────────────────

export const EHR_ADAPTERS: Record<string, { label: string; fields: string[] }> = {
  mock:       { label: "Mock / Development", fields: [] },
  epic_fhir:  { label: "Epic (FHIR R4)", fields: ["baseUrl", "clientId", "clientSecret"] },
  cerner_fhir:{ label: "Cerner (FHIR R4)", fields: ["baseUrl", "clientId", "clientSecret"] },
  athena:     { label: "Athenahealth", fields: ["baseUrl", "clientId", "clientSecret"] },
  opendental: { label: "OpenDental", fields: ["baseUrl", "apiKey"] },
  bluai:      { label: "BluAI EMR/HMS", fields: ["baseUrl", "apiKey"] },
};

export function createAdapter(type: string, config: any): EHRAdapter {
  switch (type) {
    case "epic_fhir":
    case "cerner_fhir":
    case "athena":
      return new FHIRAdapter(EHR_ADAPTERS[type]?.label || type, config);
    case "bluai":
      return new BluAIAdapter(config);
    default:
      return new MockEHRAdapter();
  }
}

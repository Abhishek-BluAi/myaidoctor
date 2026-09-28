/**
 * FHIR R4 Resource Builder
 *
 * Converts MyAIDoctor clinical data into standard FHIR R4 resources
 * compatible with any EMR/HMS that supports FHIR (Epic, Cerner, BluHealth, etc.)
 */

import type { SOAPNote, Differential, RedFlag } from "@/lib/clinical/engine";

/** Build a FHIR R4 Bundle containing all resources from a pre-visit intake */
export function buildFHIRBundle(data: {
  patient: { id: string; firstName: string; lastName: string; dob: string; gender: string; phone: string; email?: string };
  encounter: { id: string; date: string; type: string; provider: string; clinic: string };
  intake: any;
  soap: SOAPNote;
}): any {
  const { patient, encounter, intake, soap } = data;
  const now = new Date().toISOString();

  return {
    resourceType: "Bundle",
    type: "transaction",
    timestamp: now,
    meta: {
      profile: ["http://hl7.org/fhir/R4/bundle.html"],
      source: "MyAIDoctor.io",
      versionId: "1",
    },
    entry: [
      // 1. Patient Resource
      {
        resource: buildPatientResource(patient),
        request: { method: "PUT", url: `Patient/${patient.id}` },
      },
      // 2. Encounter Resource
      {
        resource: buildEncounterResource(encounter, patient.id),
        request: { method: "POST", url: "Encounter" },
      },
      // 3. Condition Resources (from differentials)
      ...soap.differentials.map((d, i) => ({
        resource: buildConditionResource(d, patient.id, encounter.id, i),
        request: { method: "POST", url: "Condition" },
      })),
      // 4. DocumentReference (SOAP Note)
      {
        resource: buildDocumentReference(soap, patient.id, encounter.id, now),
        request: { method: "POST", url: "DocumentReference" },
      },
      // 5. QuestionnaireResponse (Patient intake)
      {
        resource: buildQuestionnaireResponse(intake, patient.id, encounter.id, now),
        request: { method: "POST", url: "QuestionnaireResponse" },
      },
      // 6. Flag Resources (Red Flags)
      ...soap.redFlags.map((f, i) => ({
        resource: buildFlagResource(f, patient.id, i),
        request: { method: "POST", url: "Flag" },
      })),
    ],
  };
}

function buildPatientResource(p: any) {
  return {
    resourceType: "Patient",
    id: p.id,
    meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
    name: [{ use: "official", family: p.lastName, given: [p.firstName] }],
    birthDate: p.dob,
    gender: p.gender?.toLowerCase() === "male" ? "male" : p.gender?.toLowerCase() === "female" ? "female" : "unknown",
    telecom: [
      { system: "phone", value: p.phone, use: "mobile" },
      ...(p.email ? [{ system: "email", value: p.email }] : []),
    ],
  };
}

function buildEncounterResource(enc: any, patientId: string) {
  return {
    resourceType: "Encounter",
    id: enc.id,
    status: "planned",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    type: [{ coding: [{ system: "http://snomed.info/sct", code: "185349003", display: "Pre-visit assessment" }] }],
    subject: { reference: `Patient/${patientId}` },
    period: { start: enc.date },
    serviceProvider: { display: enc.clinic },
    participant: [{ individual: { display: enc.provider } }],
  };
}

function buildConditionResource(d: Differential, patientId: string, encounterId: string, idx: number) {
  return {
    resourceType: "Condition",
    id: `condition-${encounterId}-${idx}`,
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
    verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "provisional" }] },
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis" }] }],
    code: {
      coding: d.icdCode ? [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code: d.icdCode, display: d.diagnosis }] : [],
      text: d.diagnosis,
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    note: [
      { text: `Probability: ${d.probability}. Evidence: ${d.supportingEvidence?.join(", ")}. Rule out: ${d.rulingOutSteps?.join(", ")}` },
    ],
  };
}

function buildDocumentReference(soap: SOAPNote, patientId: string, encounterId: string, date: string) {
  const soapText = `SUBJECTIVE:\n${soap.subjective}\n\nOBJECTIVE:\n${soap.objective}\n\nASSESSMENT:\n${soap.assessment}\n\nPLAN:\n${soap.plan}`;

  return {
    resourceType: "DocumentReference",
    status: "current",
    type: { coding: [{ system: "http://loinc.org", code: "11506-3", display: "Progress note" }] },
    category: [{ coding: [{ system: "http://loinc.org", code: "34117-2", display: "History and physical note" }] }],
    subject: { reference: `Patient/${patientId}` },
    date: date,
    description: "Pre-Visit SOAP Note — AI Generated",
    content: [{
      attachment: {
        contentType: "text/plain",
        data: Buffer.from(soapText).toString("base64"),
        title: "Pre-Visit SOAP Note",
      },
    }],
    context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
  };
}

function buildQuestionnaireResponse(intake: any, patientId: string, encounterId: string, date: string) {
  const items = [];
  if (intake.chiefComplaint) items.push({ linkId: "cc", text: "Chief Complaint", answer: [{ valueString: intake.chiefComplaint }] });
  if (intake.hpiNarrative) items.push({ linkId: "hpi", text: "History of Present Illness", answer: [{ valueString: intake.hpiNarrative }] });
  if (intake.symptomDetails) {
    items.push({ linkId: "severity", text: "Pain Severity (1-10)", answer: [{ valueInteger: intake.symptomDetails.severity }] });
    items.push({ linkId: "onset", text: "Onset", answer: [{ valueString: intake.symptomDetails.onset }] });
    items.push({ linkId: "duration", text: "Duration", answer: [{ valueString: intake.symptomDetails.duration }] });
    items.push({ linkId: "location", text: "Location", answer: [{ valueString: intake.symptomDetails.location }] });
  }
  if (intake.medicationCompliance) items.push({ linkId: "med_compliance", text: "Medication Compliance", answer: [{ valueString: intake.medicationCompliance }] });
  if (intake.reasonForVisit) items.push({ linkId: "reason", text: "Reason for Visit", answer: [{ valueString: intake.reasonForVisit }] });

  return {
    resourceType: "QuestionnaireResponse",
    status: "completed",
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    authored: date,
    source: { display: "MyAIDoctor.io Patient Portal" },
    item: items,
  };
}

function buildFlagResource(flag: RedFlag, patientId: string, idx: number) {
  const priorityMap = { critical: "http://hl7.org/fhir/flag-priority-code|alert", high: "http://hl7.org/fhir/flag-priority-code|warning", moderate: "http://hl7.org/fhir/flag-priority-code|info" };
  return {
    resourceType: "Flag",
    id: `flag-${patientId}-${idx}`,
    status: "active",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/flag-category", code: "clinical", display: "Clinical" }] }],
    code: { text: flag.flag },
    subject: { reference: `Patient/${patientId}` },
    period: { start: new Date().toISOString() },
    extension: [
      { url: "http://myaidoctor.io/fhir/flag-severity", valueString: flag.severity },
      { url: "http://myaidoctor.io/fhir/flag-action", valueString: flag.action },
    ],
  };
}

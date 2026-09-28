import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { generateSOAPNote, generateBrief } from "@/lib/clinical/engine";
import { MockEHRAdapter, createAdapter } from "@/lib/ehr/adapters";
import { buildFHIRBundle } from "@/lib/fhir/resources";
import { audit } from "@/lib/audit";
import type { ClinicalIntake } from "@/lib/clinical/engine";

/** GET — get patient's upcoming appointments and pending intakes */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find the patient record linked to this user
  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  // Find patient by email match
  const patient = await prisma.patient.findFirst({
    where: { email: user?.email },
    include: {
      appointments: {
        orderBy: { scheduledAt: "desc" },
        include: {
          provider: { select: { firstName: true, lastName: true } },
          clinic: { select: { name: true } },
          preVisitBrief: { select: { id: true, status: true, chiefComplaint: true, riskScore: true, generatedAt: true, clinicalSummary: true, protocolsApplied: true, soapNote: true, transcript: true, reviewOfSystems: true, hpiNarrative: true } },
          workflow: { select: { id: true, stage: true, completionRate: true } },
        },
      },
    },
  });

  const upcoming = patient?.appointments.filter((a: any) => new Date(a.scheduledAt) >= new Date()) || [];
  const completed = patient?.appointments.filter((a: any) => a.preVisitBrief?.status === "READY") || [];

  return NextResponse.json({
    patient: patient ? {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      appointments: upcoming,
      completedIntakes: completed,
    } : null,
    user: { firstName: user?.firstName, lastName: user?.lastName },
  });
}

/** POST — submit intake responses and generate SOAP + FHIR */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId, intake, action } = await req.json();

  if (action === "save_progress") {
    // Save partial intake without generating SOAP
    if (appointmentId) {
      await prisma.preVisitWorkflow.upsert({
        where: { appointmentId },
        update: { intakeData: intake, stage: "COLLECTING" },
        create: {
          appointmentId,
          patientId: intake.patientId || "",
          stage: "COLLECTING",
          intakeData: intake,
          triggerMode: "patient_portal",
          engagementMethod: "patient_portal",
        },
      });
    }
    return NextResponse.json({ success: true, message: "Progress saved" });
  }

  if (action === "submit") {
    if (!appointmentId || !intake)
      return NextResponse.json({ error: "appointmentId and intake required" }, { status: 400 });

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { clinic: { include: { ehrConnections: { where: { isActive: true }, take: 1 } } } } },
        provider: { select: { firstName: true, lastName: true } },
        clinic: { select: { name: true } },
      },
    });

    if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    // Get EHR context
    const ehrConn = appointment.patient?.clinic?.ehrConnections?.[0];
    const adapter = ehrConn ? createAdapter(ehrConn.adapter, ehrConn.credentials) : new MockEHRAdapter();
    const context = await adapter.getPatientContext(appointment.patientId);

    // Generate SOAP note
    const soap = await generateSOAPNote(intake as ClinicalIntake, context);
    const brief = generateBrief(intake as ClinicalIntake, context, soap);

    // Build FHIR R4 Bundle
    const fhirBundle = buildFHIRBundle({
      patient: {
        id: appointment.patientId,
        firstName: appointment.patient.firstName,
        lastName: appointment.patient.lastName,
        dob: appointment.patient.dateOfBirth?.toISOString().slice(0, 10) || "",
        gender: appointment.patient.gender || "unknown",
        phone: appointment.patient.phone,
        email: appointment.patient.email || undefined,
      },
      encounter: {
        id: appointmentId,
        date: appointment.scheduledAt.toISOString(),
        type: appointment.visitType,
        provider: `Dr. ${appointment.provider?.lastName}`,
        clinic: appointment.clinic?.name || "",
      },
      intake,
      soap,
    });

    // Save PreVisitBrief with SOAP + FHIR + transcript
    await prisma.preVisitBrief.upsert({
      where: { appointmentId },
      update: {
        status: "READY",
        chiefComplaint: intake.chiefComplaint,
        hpiNarrative: soap.subjective,
        reviewOfSystems: intake.reviewOfSystems,
        differentials: soap.differentials,
        redFlags: soap.redFlags,
        soapNote: soap as any,
        fhirBundle: fhirBundle as any,
        transcript: intake.transcript || JSON.stringify(intake.conversationHistory || []),
        clinicalSummary: brief.clinicalNarrative,
        riskScore: brief.riskScore,
        protocolsApplied: soap.protocolsApplied,
        generatedAt: new Date(),
      },
      create: {
        appointmentId,
        patientId: appointment.patientId,
        providerId: appointment.providerId || "",
        status: "READY",
        chiefComplaint: intake.chiefComplaint,
        hpiNarrative: soap.subjective,
        reviewOfSystems: intake.reviewOfSystems,
        differentials: soap.differentials,
        redFlags: soap.redFlags,
        soapNote: soap as any,
        fhirBundle: fhirBundle as any,
        transcript: intake.transcript || JSON.stringify(intake.conversationHistory || []),
        clinicalSummary: brief.clinicalNarrative,
        riskScore: brief.riskScore,
        protocolsApplied: soap.protocolsApplied,
        generatedAt: new Date(),
      },
    });

    // Update workflow
    await prisma.preVisitWorkflow.upsert({
      where: { appointmentId },
      update: {
        stage: "READY",
        intakeData: intake,
        soapGenerated: true,
        soapGeneratedAt: new Date(),
        completionRate: brief.completionRate,
        engagementMethod: "patient_portal",
      },
      create: {
        appointmentId,
        patientId: appointment.patientId,
        stage: "READY",
        intakeData: intake,
        soapGenerated: true,
        soapGeneratedAt: new Date(),
        completionRate: brief.completionRate,
        triggerMode: "patient_portal",
        engagementMethod: "patient_portal",
      },
    });

    // Push to EHR (if configured)
    await adapter.pushSOAPNote(appointment.patientId, soap);
    await adapter.pushBrief(appointment.patientId, brief);

    // Auto-sync FHIR R4 bundle to configured EMR
    let emrSyncResult = { synced: false, mode: "none" };
    try {
      const emrSettings = await prisma.systemSetting.findMany({ where: { key: { in: ["emr_mode", "emr_fhir_url", "emr_api_key"] } } });
      const emrConfig: Record<string, string> = {};
      emrSettings.forEach((s: any) => { emrConfig[s.key] = s.value; });

      if (emrConfig.emr_mode === "live" && emrConfig.emr_fhir_url) {
        // Push FHIR bundle to live EMR
        const fhirRes = await fetch(emrConfig.emr_fhir_url, {
          method: "POST",
          headers: { "Content-Type": "application/fhir+json", Authorization: `Bearer ${emrConfig.emr_api_key || ""}` },
          body: JSON.stringify(fhirBundle),
        });
        emrSyncResult = { synced: fhirRes.ok, mode: "live" };
      } else {
        console.log("[EMR Auto-Sync] Mock mode — FHIR bundle logged, not pushed");
        emrSyncResult = { synced: true, mode: "mock" };
      }
    } catch (e: any) {
      console.error("[EMR Auto-Sync] Failed:", e.message);
      emrSyncResult = { synced: false, mode: "error" };
    }

    await audit(req, {
      action: "PATIENT_INTAKE_SUBMITTED",
      entityType: "pre_visit_brief",
      entityId: appointmentId,
      userId: token.id as string,
      userEmail: token.email as string,
      details: {
        completionRate: brief.completionRate,
        redFlagCount: soap.redFlags.length,
        generatedBy: soap.generatedBy,
        method: "patient_portal",
      },
    });

    return NextResponse.json({
      success: true,
      soapPreview: {
        subjective: soap.subjective?.substring(0, 200) + "...",
        assessment: soap.assessment,
        differentials: soap.differentials,
        redFlags: soap.redFlags,
        generatedBy: soap.generatedBy,
      },
      brief: { riskScore: brief.riskScore, completionRate: brief.completionRate, redFlagCount: soap.redFlags.length },
      emrSync: emrSyncResult,
      fhirBundle,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { generateSOAPNote, generateBrief, type ClinicalIntake } from "@/lib/clinical/engine";
import { MockEHRAdapter, createAdapter } from "@/lib/ehr/adapters";
import { audit } from "@/lib/audit";

/** POST — generate SOAP note and brief for a patient */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { patientId, appointmentId, intake } = await req.json();
  if (!patientId || !intake)
    return NextResponse.json({ error: "patientId and intake data required" }, { status: 400 });

  try {
    // Get patient context from EHR
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { clinic: { include: { ehrConnections: { where: { isActive: true }, take: 1 } } } },
    });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const ehrConn = patient.clinic?.ehrConnections?.[0];
    const adapter = ehrConn ? createAdapter(ehrConn.adapter, ehrConn.credentials) : new MockEHRAdapter();
    const context = await adapter.getPatientContext(patientId);

    // Generate SOAP note
    const soap = await generateSOAPNote(intake as ClinicalIntake, context);
    const brief = generateBrief(intake as ClinicalIntake, context, soap);

    // Save to PreVisitBrief if appointmentId provided
    if (appointmentId) {
      await prisma.preVisitBrief.upsert({
        where: { appointmentId },
        update: {
          status: "READY",
          chiefComplaint: intake.chiefComplaint,
          hpiNarrative: soap.subjective,
          reviewOfSystems: intake.reviewOfSystems as any,
          differentials: soap.differentials as any,
          redFlags: soap.redFlags as any,
          soapNote: soap as any,
          clinicalSummary: brief.clinicalNarrative,
          riskScore: brief.riskScore,
          protocolsApplied: soap.protocolsApplied,
          generatedAt: new Date(),
        },
        create: {
          appointmentId,
          patientId,
          providerId: token.id as string,
          status: "READY",
          chiefComplaint: intake.chiefComplaint,
          hpiNarrative: soap.subjective,
          reviewOfSystems: intake.reviewOfSystems as any,
          differentials: soap.differentials as any,
          redFlags: soap.redFlags as any,
          soapNote: soap as any,
          clinicalSummary: brief.clinicalNarrative,
          riskScore: brief.riskScore,
          protocolsApplied: soap.protocolsApplied,
          generatedAt: new Date(),
        },
      });
    }

    await audit(req, {
      action: "SOAP_GENERATED",
      entityType: "pre_visit_brief",
      entityId: appointmentId || patientId,
      userId: token.id as string,
      userEmail: token.email as string,
      details: {
        generatedBy: soap.generatedBy,
        redFlagCount: soap.redFlags.length,
        protocolsApplied: soap.protocolsApplied,
        completionRate: brief.completionRate,
      },
    });

    return NextResponse.json({ success: true, soap, brief });
  } catch (error: any) {
    console.error("SOAP generation error:", error);
    return NextResponse.json({ error: error.message || "Generation failed" }, { status: 500 });
  }
}

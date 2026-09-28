/**
 * Pre-Visit Workflow Engine
 *
 * State machine that manages the entire pre-visit journey:
 * SCHEDULED → EHR_SYNC → ENGAGING → COLLECTING → SYNTHESIZING → READY → DELIVERED → REVIEWED
 *
 * Supports auto-scheduling (24-48hr before appointment) and manual triggers.
 * Configurable retry intervals with voicemail/SMS fallback.
 */

import { prisma } from "@/lib/prisma";
import { createAdapter, MockEHRAdapter } from "@/lib/ehr/adapters";
import { generateSOAPNote, generateBrief, matchProtocols, detectRedFlags } from "@/lib/clinical/engine";
import type { ClinicalIntake } from "@/lib/clinical/engine";

export const WORKFLOW_STAGES = [
  "SCHEDULED", "EHR_SYNC", "ENGAGING", "COLLECTING",
  "SYNTHESIZING", "READY", "DELIVERED", "REVIEWED", "FAILED",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

/**
 * Create a workflow for an upcoming appointment.
 */
export async function createWorkflow(
  appointmentId: string,
  patientId: string,
  opts: { triggerMode?: string; scheduledCallAt?: Date } = {}
): Promise<any> {
  const existing = await prisma.preVisitWorkflow.findUnique({ where: { appointmentId } });
  if (existing) return existing;

  return prisma.preVisitWorkflow.create({
    data: {
      appointmentId,
      patientId,
      stage: "SCHEDULED",
      triggerMode: opts.triggerMode || "auto",
      scheduledCallAt: opts.scheduledCallAt || null,
    },
  });
}

/**
 * Advance a workflow to the next stage.
 */
export async function advanceWorkflow(
  workflowId: string,
  targetStage: WorkflowStage,
  data?: Record<string, any>
): Promise<any> {
  const update: any = { stage: targetStage, ...data };

  if (targetStage === "EHR_SYNC") {
    update.ehrSyncCompleted = false;
  } else if (targetStage === "READY") {
    update.soapGenerated = true;
    update.soapGeneratedAt = new Date();
  } else if (targetStage === "DELIVERED") {
    update.briefDeliveredAt = new Date();
  } else if (targetStage === "FAILED") {
    update.failureReason = data?.failureReason || "Unknown error";
  }

  return prisma.preVisitWorkflow.update({ where: { id: workflowId }, data: update });
}

/**
 * Execute EHR sync step — fetch patient context from connected EHR.
 */
export async function executeEHRSync(workflowId: string): Promise<any> {
  const workflow = await prisma.preVisitWorkflow.findUnique({
    where: { id: workflowId },
    include: {
      patient: { include: { clinic: { include: { ehrConnections: { where: { isActive: true }, take: 1 } } } } },
    },
  });
  if (!workflow) throw new Error("Workflow not found");

  // Find the EHR adapter for this patient's clinic
  const ehrConn = workflow.patient?.clinic?.ehrConnections?.[0];
  const adapter = ehrConn
    ? createAdapter(ehrConn.adapter, ehrConn.credentials)
    : new MockEHRAdapter();

  const context = await adapter.getPatientContext(workflow.patientId);

  return advanceWorkflow(workflowId, "ENGAGING", {
    ehrSyncCompleted: true,
    ehrSyncedAt: new Date(),
    clinicalContext: context,
  });
}

/**
 * Record call attempt and handle retry/fallback logic.
 */
export async function recordCallAttempt(
  workflowId: string,
  result: { connected: boolean; voicemailLeft?: boolean; callId?: string }
): Promise<any> {
  const workflow = await prisma.preVisitWorkflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error("Workflow not found");

  const attempts = workflow.callAttempts + 1;

  if (result.connected) {
    return advanceWorkflow(workflowId, "COLLECTING", {
      callAttempts: attempts,
      engagementMethod: "voice_outbound",
      voiceCallId: result.callId,
    });
  }

  // Not connected — schedule retry or fallback
  const update: any = { callAttempts: attempts, voicemailLeft: result.voicemailLeft || false };

  if (attempts >= workflow.maxCallAttempts) {
    // Max attempts reached — send SMS fallback
    update.smsLinkSent = true;
    update.smsFallbackUrl = `/intake/${workflowId}`; // patient-facing intake form URL
    update.engagementMethod = "sms_link";
    console.log(`[Workflow] Max call attempts reached for ${workflowId}. SMS fallback sent.`);
  } else {
    // Schedule retry
    update.nextRetryAt = new Date(Date.now() + workflow.retryIntervalMin * 60 * 1000);
    console.log(`[Workflow] Retry ${attempts}/${workflow.maxCallAttempts} for ${workflowId} at ${update.nextRetryAt}`);
  }

  return prisma.preVisitWorkflow.update({ where: { id: workflowId }, data: update });
}

/**
 * Process collected intake data — generate SOAP note and brief.
 */
export async function synthesize(
  workflowId: string,
  intake: ClinicalIntake
): Promise<any> {
  const workflow = await prisma.preVisitWorkflow.findUnique({
    where: { id: workflowId },
    include: { patient: true },
  });
  if (!workflow) throw new Error("Workflow not found");

  await advanceWorkflow(workflowId, "SYNTHESIZING", { intakeData: intake as any });

  const context = (workflow.clinicalContext as any) || await new MockEHRAdapter().getPatientContext(workflow.patientId);
  const soap = await generateSOAPNote(intake, context);
  const brief = generateBrief(intake, context, soap);

  // Update or create PreVisitBrief
  await prisma.preVisitBrief.upsert({
    where: { appointmentId: workflow.appointmentId },
    update: {
      status: "READY",
      chiefComplaint: intake.chiefComplaint,
      hpiNarrative: soap.subjective,
      reviewOfSystems: intake.reviewOfSystems,
      medicationChanges: intake.medicationChanges,
      allergyUpdates: intake.allergyUpdates,
      differentials: soap.differentials,
      redFlags: soap.redFlags,
      recommendations: brief.suggestedActions,
      soapNote: soap as any,
      clinicalSummary: brief.clinicalNarrative,
      riskScore: brief.riskScore,
      protocolsApplied: soap.protocolsApplied,
      generatedAt: new Date(),
    },
    create: {
      appointmentId: workflow.appointmentId,
      patientId: workflow.patientId,
      providerId: workflow.patient?.clinicId || "", // will be set properly
      status: "READY",
      chiefComplaint: intake.chiefComplaint,
      hpiNarrative: soap.subjective,
      reviewOfSystems: intake.reviewOfSystems,
      medicationChanges: intake.medicationChanges,
      allergyUpdates: intake.allergyUpdates,
      differentials: soap.differentials,
      redFlags: soap.redFlags,
      recommendations: brief.suggestedActions,
      soapNote: soap as any,
      clinicalSummary: brief.clinicalNarrative,
      riskScore: brief.riskScore,
      protocolsApplied: soap.protocolsApplied,
      generatedAt: new Date(),
    },
  });

  return advanceWorkflow(workflowId, "READY", {
    soapGenerated: true,
    soapGeneratedAt: new Date(),
    completionRate: brief.completionRate,
  });
}

/**
 * Find appointments that need workflows auto-created (24-48hr window).
 */
export async function findAppointmentsForAutoSchedule(): Promise<any[]> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: in24h, lte: in48h },
      status: "CONFIRMED",
      workflow: null, // no workflow yet
    },
    include: { patient: true, provider: true },
  });

  return appointments;
}

/**
 * Auto-create workflows for upcoming appointments.
 */
export async function autoScheduleWorkflows(): Promise<number> {
  const appointments = await findAppointmentsForAutoSchedule();
  let created = 0;

  for (const appt of appointments) {
    try {
      const callTime = new Date(appt.scheduledAt.getTime() - 36 * 60 * 60 * 1000); // 36hr before
      await createWorkflow(appt.id, appt.patientId, {
        triggerMode: "auto",
        scheduledCallAt: callTime > new Date() ? callTime : new Date(),
      });
      created++;
      console.log(`[AutoSchedule] Workflow created for appointment ${appt.id}, call at ${callTime}`);
    } catch (e) { console.error(`[AutoSchedule] Failed for ${appt.id}:`, e); }
  }

  return created;
}

/**
 * Find workflows with pending retries that are due.
 */
export async function findDueRetries(): Promise<any[]> {
  return prisma.preVisitWorkflow.findMany({
    where: {
      stage: "ENGAGING",
      nextRetryAt: { lte: new Date() },
      callAttempts: { lt: prisma.raw`max_call_attempts` },
    },
  });
}

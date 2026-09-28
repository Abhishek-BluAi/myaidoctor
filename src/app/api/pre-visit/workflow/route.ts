import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { createWorkflow, advanceWorkflow, executeEHRSync, recordCallAttempt, synthesize } from "@/lib/workflow/engine";

/** GET — list workflows with filters */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const stage = params.get("stage");
  const patientId = params.get("patientId");

  const where: any = {};
  if (stage) where.stage = stage;
  if (patientId) where.patientId = patientId;

  const workflows = await prisma.preVisitWorkflow.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true } },
      appointment: { select: { scheduledAt: true, visitType: true, provider: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const stats = await prisma.preVisitWorkflow.groupBy({
    by: ["stage"],
    _count: true,
  });

  return NextResponse.json({ workflows, stats });
}

/** POST — create or advance workflow */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case "create": {
        const { appointmentId, patientId, triggerMode, scheduledCallAt } = body;
        if (!appointmentId || !patientId)
          return NextResponse.json({ error: "appointmentId and patientId required" }, { status: 400 });

        const workflow = await createWorkflow(appointmentId, patientId, {
          triggerMode, scheduledCallAt: scheduledCallAt ? new Date(scheduledCallAt) : undefined,
        });

        await audit(req, {
          action: "WORKFLOW_CREATED",
          entityType: "workflow",
          entityId: workflow.id,
          userId: token.id as string,
          userEmail: token.email as string,
          details: { appointmentId, triggerMode },
        });

        return NextResponse.json({ success: true, workflow });
      }

      case "ehr_sync": {
        const workflow = await executeEHRSync(body.workflowId);
        await audit(req, {
          action: "WORKFLOW_EHR_SYNC",
          entityType: "workflow",
          entityId: body.workflowId,
          userId: token.id as string,
          details: { stage: "EHR_SYNC" },
        });
        return NextResponse.json({ success: true, workflow });
      }

      case "record_call": {
        const workflow = await recordCallAttempt(body.workflowId, {
          connected: body.connected,
          voicemailLeft: body.voicemailLeft,
          callId: body.callId,
        });
        return NextResponse.json({ success: true, workflow });
      }

      case "synthesize": {
        const workflow = await synthesize(body.workflowId, body.intake);
        await audit(req, {
          action: "WORKFLOW_SYNTHESIZED",
          entityType: "workflow",
          entityId: body.workflowId,
          userId: token.id as string,
          details: { stage: "SYNTHESIZING" },
        });
        return NextResponse.json({ success: true, workflow });
      }

      case "advance": {
        const workflow = await advanceWorkflow(body.workflowId, body.stage, body.data);
        return NextResponse.json({ success: true, workflow });
      }

      case "manual_trigger": {
        // Start the full workflow: create → EHR sync → engage
        const { appointmentId, patientId } = body;
        let wf = await createWorkflow(appointmentId, patientId, { triggerMode: "manual" });
        wf = await executeEHRSync(wf.id);

        await audit(req, {
          action: "WORKFLOW_MANUAL_TRIGGER",
          entityType: "workflow",
          entityId: wf.id,
          userId: token.id as string,
          userEmail: token.email as string,
          details: { appointmentId, patientId },
        });

        return NextResponse.json({ success: true, workflow: wf });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Workflow error:", error);
    return NextResponse.json({ error: error.message || "Workflow operation failed" }, { status: 500 });
  }
}

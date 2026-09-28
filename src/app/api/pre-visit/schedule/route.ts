import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { autoScheduleWorkflows } from "@/lib/workflow/engine";
import { audit } from "@/lib/audit";

/** POST — run auto-scheduler (creates workflows for appointments 24-48hr out) */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const created = await autoScheduleWorkflows();

    await audit(req, {
      action: "WORKFLOW_AUTO_SCHEDULE",
      entityType: "system",
      entityId: "scheduler",
      userId: token.id as string,
      details: { workflowsCreated: created },
    });

    return NextResponse.json({ success: true, workflowsCreated: created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

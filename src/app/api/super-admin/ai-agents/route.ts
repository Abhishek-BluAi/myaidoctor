import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySuperAdmin } from "@/lib/super-admin";
import { audit } from "@/lib/audit";

/** GET — list all agents with assignments */
export async function GET(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agents = await prisma.aIAgent.findMany({
    include: {
      assignments: {
        include: {
          hospital: { select: { id: true, name: true } },
          clinic: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true },
    where: { isActive: true },
  });
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true, hospitalId: true },
    where: { isActive: true },
  });

  return NextResponse.json({ agents, hospitals, clinics });
}

/** POST — create, update, duplicate, delete, assign, change status */
export async function POST(req: NextRequest) {
  const token = await verifySuperAdmin(req);
  if (!token) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  try {
    if (action === "create") {
      const agent = await prisma.aIAgent.create({
        data: {
          name: body.name || "New AI Agent",
          description: body.description || "",
          type: body.type || "custom",
          status: "draft",
          trigger: body.trigger || { type: "manual", config: {} },
          steps: body.steps || [],
          settings: body.settings || { retryAttempts: 3, retryIntervalMin: 60, smsFallback: true },
          createdBy: token.id as string,
        },
      });

      await audit(req, {
        action: "AGENT_CREATED", entityType: "ai_agent", entityId: agent.id,
        userId: token.id as string, userEmail: token.email as string,
        details: { name: agent.name, type: agent.type },
      });

      return NextResponse.json({ success: true, agent });
    }

    if (action === "update") {
      const { id, ...data } = body;
      delete data.action;
      const agent = await prisma.aIAgent.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
      return NextResponse.json({ success: true, agent });
    }

    if (action === "set_status") {
      const agent = await prisma.aIAgent.update({
        where: { id: body.id },
        data: { status: body.status },
      });

      await audit(req, {
        action: "AGENT_STATUS_CHANGED", entityType: "ai_agent", entityId: agent.id,
        userId: token.id as string,
        details: { name: agent.name, status: body.status },
      });

      return NextResponse.json({ success: true, agent });
    }

    if (action === "duplicate") {
      const source = await prisma.aIAgent.findUnique({ where: { id: body.id } });
      if (!source) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      const agent = await prisma.aIAgent.create({
        data: {
          name: `${source.name} (Copy)`, description: source.description,
          type: source.type, trigger: source.trigger as any, steps: source.steps as any,
          settings: source.settings as any, createdBy: token.id as string,
        },
      });
      return NextResponse.json({ success: true, agent });
    }

    if (action === "delete") {
      await prisma.aIAgent.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    if (action === "assign") {
      const { agentId, scope, hospitalId, clinicId } = body;
      const assignment = await prisma.aIAgentAssignment.create({
        data: { agentId, scope, hospitalId: hospitalId || null, clinicId: clinicId || null },
      });
      return NextResponse.json({ success: true, assignment });
    }

    if (action === "unassign") {
      await prisma.aIAgentAssignment.delete({ where: { id: body.assignmentId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("AI Agent error:", error);
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 500 });
  }
}

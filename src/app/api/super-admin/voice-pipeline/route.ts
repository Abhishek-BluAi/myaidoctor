import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySuperAdmin } from "@/lib/super-admin";
import { audit } from "@/lib/audit";

/** GET — load all pipeline configs (global + per-clinic) */
export async function GET(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clinicId = req.nextUrl.searchParams.get("clinicId");

  const configs = await prisma.voicePipelineConfig.findMany({
    where: clinicId ? { clinicId } : { clinicId: null },
    include: { clinic: { select: { id: true, name: true } } },
    orderBy: { layer: "asc" },
  });

  // Also load all clinics for the override UI
  const clinics = await prisma.clinic.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: true, state: true },
    orderBy: { name: "asc" },
  });

  // Load clinic-specific configs
  const clinicOverrides = await prisma.voicePipelineConfig.findMany({
    where: { clinicId: { not: null } },
    include: { clinic: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ configs, clinics, clinicOverrides });
}

/** POST — save pipeline config */
export async function POST(req: NextRequest) {
  const token = await verifySuperAdmin(req);
  if (!token) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, clinicId, layer, provider, config } = await req.json();

  try {
    if (action === "save") {
      if (!layer || !provider)
        return NextResponse.json({ error: "layer and provider required" }, { status: 400 });

      await prisma.voicePipelineConfig.upsert({
        where: { clinicId_layer: { clinicId: clinicId || null, layer } },
        update: { provider, config: config || {}, isActive: true },
        create: { clinicId: clinicId || null, layer, provider, config: config || {} },
      });

      await audit(req, {
        action: "VOICE_AI_SETTINGS_UPDATED",
        entityType: "voice_pipeline",
        entityId: clinicId || "global",
        userId: token.id as string,
        userEmail: token.email as string,
        details: { layer, provider, clinicId: clinicId || "global" },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      if (!clinicId || !layer)
        return NextResponse.json({ error: "clinicId and layer required for delete" }, { status: 400 });

      await prisma.voicePipelineConfig.deleteMany({
        where: { clinicId, layer },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Pipeline config error:", error);
    return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
  }
}

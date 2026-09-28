import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySuperAdmin } from "@/lib/super-admin";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.systemSetting.findMany();
  const settings: Record<string, string> = {};
  rows.forEach((r) => { settings[r.key] = r.value; });
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { settings } = await req.json();
  if (!settings || typeof settings !== "object")
    return NextResponse.json({ error: "settings object required" }, { status: 400 });

  try {
    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    const token = await verifySuperAdmin(req);
    await audit(req, {
      action: "SETTINGS_UPDATED",
      entityType: "system_settings",
      entityId: "global",
      userId: token?.id as string,
      userEmail: token?.email as string,
      details: { keysUpdated: Object.keys(settings) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

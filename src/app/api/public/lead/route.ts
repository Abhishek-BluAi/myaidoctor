import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Store in SystemSetting as a JSON array of leads
    let existing: any[] = [];
    try {
      const row = await prisma.systemSetting.findFirst({ where: { key: "leads" } });
      existing = row?.value ? JSON.parse(row.value) : [];
    } catch {}

    existing.push({
      id: `lead_${Date.now()}`,
      ...data,
      status: "new",
      receivedAt: new Date().toISOString(),
    });

    await prisma.systemSetting.upsert({
      where: { key: "leads" },
      update: { value: JSON.stringify(existing) },
      create: { key: "leads", value: JSON.stringify(existing) },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[Lead API]", e.message);
    return NextResponse.json({ success: true }); // always succeed for UX
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await prisma.systemSetting.findFirst({ where: { key: "custom_services" } });
    const services = settings?.value ? JSON.parse(settings.value) : [];
    return NextResponse.json({ services });
  } catch {
    return NextResponse.json({ services: [] });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, service, serviceId } = await req.json();

  // Load current services
  let existing: any[] = [];
  try {
    const row = await prisma.systemSetting.findFirst({ where: { key: "custom_services" } });
    existing = row?.value ? JSON.parse(row.value) : [];
  } catch {}

  if (action === "create" && service) {
    const newService = {
      id: `custom_${Date.now()}`,
      serviceId: service.id || service.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      name: service.name,
      description: service.description,
      type: service.type || "standalone",
      includes: service.includes || [],
      createdAt: new Date().toISOString(),
      active: true,
    };
    existing.push(newService);
  }

  if (action === "delete" && serviceId) {
    existing = existing.filter((s: any) => s.serviceId !== serviceId && s.id !== serviceId);
  }

  if (action === "update" && service) {
    existing = existing.map((s: any) => (s.id === service.id || s.serviceId === service.serviceId) ? { ...s, ...service } : s);
  }

  await prisma.systemSetting.upsert({
    where: { key: "custom_services" },
    update: { value: JSON.stringify(existing) },
    create: { key: "custom_services", value: JSON.stringify(existing) },
  });

  return NextResponse.json({ success: true, services: existing });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySuperAdmin } from "@/lib/super-admin";

export async function GET(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const hospitals = await prisma.hospital.findMany({
    include: { _count: { select: { clinics: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ hospitals });
}

export async function POST(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { action = "create", ...data } = await req.json();
  try {
    if (action === "create") {
      const h = await prisma.hospital.create({ data: { name: data.name, address: data.address, city: data.city, state: data.state, zip: data.zip, phone: data.phone, website: data.website } });
      return NextResponse.json({ success: true, hospitalId: h.id });
    }
    if (action === "update") {
      await prisma.hospital.update({ where: { id: data.hospitalId }, data: { name: data.name, address: data.address, city: data.city, state: data.state, zip: data.zip, phone: data.phone, website: data.website, isActive: data.isActive } });
      return NextResponse.json({ success: true });
    }
    if (action === "delete") {
      await prisma.hospital.update({ where: { id: data.hospitalId }, data: { isActive: false } });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Hospitals error:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}

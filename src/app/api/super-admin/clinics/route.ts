import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySuperAdmin } from "@/lib/super-admin";

export async function GET(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const clinics = await prisma.clinic.findMany({
    include: {
      hospital: { select: { id: true, name: true } },
      _count: { select: { users: true, patients: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ clinics });
}

export async function POST(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { action = "create", ...data } = await req.json();
  try {
    if (action === "create") {
      const c = await prisma.clinic.create({
        data: { name: data.name, address: data.address || "", city: data.city || "", state: data.state || "", zip: data.zip || "", phone: data.phone || "", fax: data.fax, ehrSystem: data.ehrSystem || "Epic", hospitalId: data.hospitalId || null },
      });
      return NextResponse.json({ success: true, clinicId: c.id });
    }
    if (action === "update") {
      await prisma.clinic.update({
        where: { id: data.clinicId },
        data: { name: data.name, address: data.address, city: data.city, state: data.state, zip: data.zip, phone: data.phone, fax: data.fax, ehrSystem: data.ehrSystem, hospitalId: data.hospitalId !== undefined ? (data.hospitalId || null) : undefined, isActive: data.isActive },
      });
      return NextResponse.json({ success: true });
    }
    if (action === "delete") {
      await prisma.clinic.update({ where: { id: data.clinicId }, data: { isActive: false } });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Clinics error:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}

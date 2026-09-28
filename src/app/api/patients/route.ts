import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const where: any = search ? { OR: [
    { firstName: { contains: search, mode: "insensitive" } },
    { lastName: { contains: search, mode: "insensitive" } },
    { mrn: { contains: search, mode: "insensitive" } },
    { phone: { contains: search } },
    { email: { contains: search, mode: "insensitive" } },
  ] } : {};
  const patients = await prisma.patient.findMany({ where, orderBy: { lastName: "asc" }, take: 50, include: { clinic: { select: { name: true } } } });
  return NextResponse.json({ patients });
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  
  // Generate MRN
  const count = await prisma.patient.count();
  const mrn = `MRN-${String(count + 1001).padStart(6, "0")}`;
  
  const patient = await prisma.patient.create({
    data: { mrn, ...data, consentGiven: false },
  });
  return NextResponse.json({ patient }, { status: 201 });
}

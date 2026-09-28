import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const where: any = {};
  const dateParam = url.searchParams.get("date");
  if (dateParam) {
    const d = new Date(dateParam);
    where.scheduledAt = { gte: d, lt: new Date(d.getTime() + 86400000) };
  }
  if (url.searchParams.get("providerId")) where.providerId = url.searchParams.get("providerId");
  if (url.searchParams.get("status")) where.status = url.searchParams.get("status");
  const appointments = await prisma.appointment.findMany({
    where, orderBy: { scheduledAt: "asc" }, take: 50,
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true } },
      provider: { select: { firstName: true, lastName: true } },
      clinic: { select: { name: true } },
      preVisitBrief: { select: { id: true, status: true } },
    },
  });
  return NextResponse.json({ appointments });
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const appointment = await prisma.appointment.create({ data: { ...data, scheduledAt: new Date(data.scheduledAt) } });
  return NextResponse.json({ appointment }, { status: 201 });
}

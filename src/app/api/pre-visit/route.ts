import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Providers only see briefs for their patients; admins see all
  const where: any = {};
  if (token.role === "PROVIDER") {
    where.providerId = token.id;
  }

  const briefs = await prisma.preVisitBrief.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true, email: true, conditions: true, medications: true, allergies: true } },
      appointment: {
        select: {
          scheduledAt: true, visitType: true, reasonForVisit: true,
          provider: { select: { firstName: true, lastName: true } },
          clinic: { select: { name: true } },
        },
      },
    },
    orderBy: { generatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ briefs });
}

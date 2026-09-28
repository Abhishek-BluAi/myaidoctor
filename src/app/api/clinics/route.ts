import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clinics = await prisma.clinic.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
    },
    orderBy: { name: "asc" },
  });

  const registrationMode = process.env.REGISTRATION_MODE || "open";

  return NextResponse.json({ clinics, registrationMode });
}

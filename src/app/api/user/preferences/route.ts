import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

/** GET — load user preferences from PostgreSQL */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ preferences: null });

  const prefs = await prisma.userPreference.findUnique({
    where: { userId: token.id as string },
  });

  console.log(`[DB READ] UserPreference for ${token.email}: ${prefs ? JSON.stringify({ mode: prefs.themeMode, accent: prefs.themeAccent, font: prefs.fontSize, sidebar: prefs.sidebarCollapsed }) : "NOT FOUND — using defaults"}`);

  return NextResponse.json({
    preferences: prefs || { themeMode: "dark", themeAccent: "emerald", fontSize: 100, sidebarCollapsed: false },
    source: "postgresql",
  });
}

/** POST — save user preferences to PostgreSQL */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { themeMode, themeAccent, fontSize, sidebarCollapsed } = body;

  const prefs = await prisma.userPreference.upsert({
    where: { userId: token.id as string },
    update: {
      ...(themeMode !== undefined && { themeMode }),
      ...(themeAccent !== undefined && { themeAccent }),
      ...(fontSize !== undefined && { fontSize }),
      ...(sidebarCollapsed !== undefined && { sidebarCollapsed }),
    },
    create: {
      userId: token.id as string,
      themeMode: themeMode || "dark",
      themeAccent: themeAccent || "emerald",
      fontSize: fontSize || 100,
      sidebarCollapsed: sidebarCollapsed || false,
    },
  });

  console.log(`[DB WRITE] UserPreference for ${token.email}: ${JSON.stringify(body)} → saved to PostgreSQL`);

  return NextResponse.json({ success: true, preferences: prefs, source: "postgresql" });
}

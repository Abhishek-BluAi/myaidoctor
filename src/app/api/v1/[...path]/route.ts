import { NextRequest } from "next/server";
import { handlePatients, handleAppointments, handleIntake } from "@/lib/api-handlers";
import { openApiSpec } from "@/lib/openapi";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest, ctx: any) { return routeRequest(req, ctx); }
export async function POST(req: NextRequest, ctx: any) { return routeRequest(req, ctx); }
export async function PUT(req: NextRequest, ctx: any) { return routeRequest(req, ctx); }
export async function DELETE(req: NextRequest, ctx: any) { return routeRequest(req, ctx); }

async function routeRequest(req: NextRequest, ctx: any) {
  const params = await ctx.params;
  const path = params.path as string[];
  const resource = path[0];
  const segments = path.slice(1);

  switch (resource) {
    case "patients": return handlePatients(req, segments);
    case "appointments": return handleAppointments(req, segments);
    case "intake": return handleIntake(req, segments);
    case "openapi.json": return NextResponse.json(openApiSpec);
    case "docs": return NextResponse.json(openApiSpec);
    default: return NextResponse.json({ error: `Unknown resource: ${resource}`, availableEndpoints: ["/api/v1/patients", "/api/v1/appointments", "/api/v1/intake/{appointmentId}", "/api/v1/intake/{appointmentId}/fhir", "/api/v1/openapi.json"] }, { status: 404 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/super-admin";

export async function GET(req: NextRequest) {
  // Check view permission for audit logs
  const token = await checkPermission(req, "sa_audit_logs", "view");
  if (!token)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const format = params.get("format");

  // Check export permission for CSV/JSON/PDF exports
  if (format === "csv" || format === "json") {
    const canExport = await checkPermission(req, "sa_audit_logs", "export");
    if (!canExport)
      return NextResponse.json({ error: "Export permission required" }, { status: 403 });
  }

  const page = parseInt(params.get("page") || "1");
  const limit = Math.min(parseInt(params.get("limit") || "50"), 200);
  const action = params.get("action");
  const category = params.get("category");
  const severity = params.get("severity");
  const userId = params.get("userId");
  const search = params.get("search");
  const from = params.get("from");
  const to = params.get("to");

  const where: any = {};

  if (action) where.action = action;
  if (category) where.category = category;
  if (severity) where.severity = severity;
  if (userId) where.userId = userId;
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
      { userEmail: { contains: search, mode: "insensitive" } },
      { path: { contains: search, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to + "T23:59:59Z");
  }

  // Export mode — return all matching records
  if (format === "csv" || format === "json") {
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000, // cap at 10k for exports
    });

    if (format === "csv") {
      const headers = "ID,Timestamp,Action,Category,Severity,Entity Type,Entity ID,User ID,User Email,IP Address,Method,Path,Details\n";
      const rows = logs.map((l) =>
        [
          l.id,
          l.createdAt.toISOString(),
          l.action,
          l.category,
          l.severity,
          l.entityType,
          l.entityId,
          l.userId || "",
          l.userEmail || "",
          l.ipAddress || "",
          l.method || "",
          l.path || "",
          l.details ? JSON.stringify(l.details).replace(/"/g, '""') : "",
        ]
          .map((v) => `"${v}"`)
          .join(",")
      ).join("\n");

      return new NextResponse(headers + rows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ logs, exportedAt: new Date().toISOString(), totalRecords: logs.length });
  }

  // Paginated listing
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Stats for the dashboard
  const stats = await prisma.auditLog.groupBy({
    by: ["severity"],
    _count: true,
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  return NextResponse.json({
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats24h: {
      info: stats.find((s) => s.severity === "info")?._count || 0,
      warning: stats.find((s) => s.severity === "warning")?._count || 0,
      critical: stats.find((s) => s.severity === "critical")?._count || 0,
    },
  });
}

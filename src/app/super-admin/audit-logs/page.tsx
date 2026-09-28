"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  FileText, Search, Download, Filter, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, Shield, Info, Calendar,
} from "lucide-react";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES } from "@/lib/audit-constants";
import { usePermissions } from "@/components/PermissionProvider";

interface LogEntry {
  id: string; action: string; category: string; severity: string;
  entityType: string; entityId: string; userId: string | null;
  userEmail: string | null; details: any; ipAddress: string | null;
  userAgent: string | null; method: string | null; path: string | null;
  createdAt: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-900/40 text-blue-300 border-blue-700/30",
  warning: "bg-amber-900/40 text-amber-300 border-amber-700/30",
  critical: "bg-red-900/40 text-red-300 border-red-700/30",
};

const SEVERITY_ICONS: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  critical: Shield,
};

export default function AuditLogsPage() {
  const { can } = usePermissions();
  const canExport = can("sa_audit_logs", "export");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ info: 0, warning: 0, critical: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", page.toString());
    p.set("limit", "50");
    if (search) p.set("search", search);
    if (category) p.set("category", category);
    if (severity) p.set("severity", severity);
    if (action) p.set("action", action);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    return p.toString();
  }, [page, search, category, severity, action, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/audit-logs?${buildQuery()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
      if (data.stats24h) setStats(data.stats24h);
    } catch { }
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  function resetFilters() {
    setSearch(""); setCategory(""); setSeverity(""); setAction(""); setDateFrom(""); setDateTo(""); setPage(1);
  }

  async function exportData(format: "csv" | "json" | "pdf") {
    setExporting(format);
    const q = buildQuery().replace(/page=\d+/, "page=1").replace(/limit=\d+/, "limit=10000");

    if (format === "pdf") {
      // Generate printable HTML and trigger print
      const res = await fetch(`/api/super-admin/audit-logs?${q}&format=json`);
      const data = await res.json();
      const entries = data.logs || [];
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(`<!DOCTYPE html><html><head><title>Audit Log Report</title>
          <style>body{font-family:sans-serif;padding:40px;color:#333}
          h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;color:#666;font-weight:normal;margin-bottom:24px}
          table{width:100%;border-collapse:collapse;font-size:11px}
          th{background:#f5f5f5;text-align:left;padding:8px;border:1px solid #ddd;font-weight:600}
          td{padding:6px 8px;border:1px solid #eee;vertical-align:top}
          tr:nth-child(even){background:#fafafa}
          .severity-critical{color:#dc2626;font-weight:600}
          .severity-warning{color:#d97706}
          .severity-info{color:#2563eb}
          .footer{margin-top:24px;font-size:11px;color:#999}
          @media print{body{padding:20px}}</style></head><body>
          <h1>MyAIDoctor.io — Audit Log Report</h1>
          <h2>Generated: ${new Date().toLocaleString()} · ${entries.length} entries${dateFrom ? ` · From: ${dateFrom}` : ""}${dateTo ? ` · To: ${dateTo}` : ""}</h2>
          <table><thead><tr><th>Timestamp</th><th>Action</th><th>Category</th><th>Severity</th><th>User</th><th>Entity</th><th>IP Address</th><th>Details</th></tr></thead><tbody>
          ${entries.map((l: any) => `<tr>
            <td>${new Date(l.createdAt).toLocaleString()}</td>
            <td>${l.action}</td>
            <td>${l.category}</td>
            <td class="severity-${l.severity}">${l.severity.toUpperCase()}</td>
            <td>${l.userEmail || l.userId || "—"}</td>
            <td>${l.entityType}:${l.entityId?.slice(0, 8)}</td>
            <td>${l.ipAddress || "—"}</td>
            <td>${l.details ? JSON.stringify(l.details).slice(0, 100) : "—"}</td>
          </tr>`).join("")}
          </tbody></table>
          <div class="footer">HIPAA Compliance Audit Trail · MyAIDoctor.io · Confidential</div>
          </body></html>`);
        printWin.document.close();
        printWin.print();
      }
      setExporting(null);
      return;
    }

    const res = await fetch(`/api/super-admin/audit-logs?${q}&format=${format}`);
    if (format === "csv") {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    } else {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    }
    setExporting(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-slate-400 mt-1">HIPAA-compliant activity trail — {total.toLocaleString()} total entries</p>
        </div>
        {canExport && (
        <div className="flex items-center gap-2">
          <button onClick={() => exportData("csv")} disabled={!!exporting} className="btn-secondary text-xs py-1.5">
            {exporting === "csv" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}CSV
          </button>
          <button onClick={() => exportData("json")} disabled={!!exporting} className="btn-secondary text-xs py-1.5">
            {exporting === "json" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}JSON
          </button>
          <button onClick={() => exportData("pdf")} disabled={!!exporting} className="btn-secondary text-xs py-1.5">
            {exporting === "pdf" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}PDF
          </button>
        </div>
        )}
      </div>

      {/* 24h Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[{ label: "Info (24h)", value: stats.info, severity: "info" },
          { label: "Warnings (24h)", value: stats.warning, severity: "warning" },
          { label: "Critical (24h)", value: stats.critical, severity: "critical" }].map((s) => {
          const Icon = SEVERITY_ICONS[s.severity];
          return (
            <div key={s.severity} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${SEVERITY_STYLES[s.severity]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div><p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p></div>
            </div>
          );
        })}
      </div>

      {/* Search + Filter toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search actions, users, paths..." className="input-field pl-10" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary ${showFilters ? "bg-brand-900/50 border-brand-700/40 text-brand-300" : ""}`}>
          <Filter className="w-4 h-4" />Filters
        </button>
        {(category || severity || action || dateFrom || dateTo) && (
          <button onClick={resetFilters} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500">Category</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input-field text-xs">
              <option value="">All categories</option>
              {AUDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500">Severity</label>
            <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className="input-field text-xs">
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500">Action</label>
            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input-field text-xs">
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />From</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="input-field text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />To</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="input-field text-xs" />
          </div>
        </div>
      )}

      {/* Log table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-midnight-800/50 text-[11px] text-slate-500 uppercase">
              <th className="p-3 text-left">Timestamp</th>
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">Severity</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Entity</th>
              <th className="p-3 text-left">IP</th>
            </tr></thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                <tr
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="border-b border-midnight-800/30 hover:bg-midnight-800/20 cursor-pointer">
                    <td className="p-3 text-slate-400 whitespace-nowrap font-mono">
                      {new Date(log.createdAt).toLocaleDateString()}{" "}
                      <span className="text-slate-600">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-slate-200">{log.action}</span>
                      <span className="text-slate-600 ml-1.5">{log.category}</span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${SEVERITY_STYLES[log.severity]}`}>
                        {log.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 truncate max-w-[180px]">{log.userEmail || log.userId?.slice(0, 8) || "—"}</td>
                    <td className="p-3 text-slate-500">{log.entityType}<span className="text-slate-700">:{log.entityId.slice(0, 8)}</span></td>
                    <td className="p-3 text-slate-500 font-mono">{log.ipAddress || "—"}</td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={6} className="p-4 bg-midnight-800/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div><p className="text-slate-600 text-[10px]">ID</p><p className="text-slate-400 font-mono">{log.id}</p></div>
                          <div><p className="text-slate-600 text-[10px]">Method / Path</p><p className="text-slate-400">{log.method || "—"} {log.path || ""}</p></div>
                          <div><p className="text-slate-600 text-[10px]">User Agent</p><p className="text-slate-400 truncate max-w-[300px]">{log.userAgent?.slice(0, 80) || "—"}</p></div>
                          <div><p className="text-slate-600 text-[10px]">Full User ID</p><p className="text-slate-400 font-mono">{log.userId || "—"}</p></div>
                        </div>
                        {log.details && (
                          <div className="mt-3">
                            <p className="text-slate-600 text-[10px] mb-1">Details</p>
                            <pre className="p-2 bg-midnight-900 rounded text-[11px] text-slate-400 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="p-8 text-center text-slate-500">No audit logs found</p>}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {totalPages} · {total.toLocaleString()} entries</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="btn-secondary py-1.5 px-2 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="btn-secondary py-1.5 px-2 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

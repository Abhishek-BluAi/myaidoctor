"use client";

import { useState, useEffect } from "react";
import { Users, Building2, Shield, Activity, Loader2 } from "lucide-react";

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/super-admin/users").then(r => r.json()),
      fetch("/api/super-admin/roles").then(r => r.json()),
      fetch("/api/super-admin/hospitals").then(r => r.json()),
      fetch("/api/super-admin/clinics").then(r => r.json()),
    ]).then(([u, r, h, c]) => {
      setStats({
        totalUsers: u.users?.length || 0,
        activeUsers: u.users?.filter((x: any) => x.isActive).length || 0,
        pendingApproval: u.users?.filter((x: any) => !x.isApproved && x.isActive).length || 0,
        mfaEnabled: u.users?.filter((x: any) => x.mfaEnabled).length || 0,
        customRoles: r.roles?.length || 0,
        hospitals: h.hospitals?.length || 0,
        clinics: c.clinics?.length || 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  const cards = [
    { label: "Total Users", value: stats.totalUsers, sub: `${stats.activeUsers} active`, icon: Users, color: "brand" },
    { label: "Pending Approval", value: stats.pendingApproval, sub: "awaiting review", icon: Activity, color: stats.pendingApproval > 0 ? "amber" : "brand" },
    { label: "MFA Enabled", value: stats.mfaEnabled, sub: `of ${stats.totalUsers} users`, icon: Shield, color: "brand" },
    { label: "Organizations", value: `${stats.hospitals} hospitals · ${stats.clinics} clinics`, sub: "", icon: Building2, color: "brand" },
    { label: "Custom Roles", value: stats.customRoles, sub: "configured", icon: Shield, color: "brand" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Super Admin Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Platform-wide management and configuration</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{c.label}</span>
                <Icon className={`w-5 h-5 ${c.color === "amber" ? "text-amber-400" : "text-brand-400"}`} />
              </div>
              <p className="text-2xl font-bold text-white">{c.value}</p>
              {c.sub && <p className="text-xs text-slate-500">{c.sub}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

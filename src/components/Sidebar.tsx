"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "./PermissionProvider";
import {
  LayoutDashboard, Users, CalendarDays, FileText, Phone, PhoneIncoming,
  Settings, Stethoscope, ShieldCheck, ChevronLeft, ChevronDown, ChevronRight,
  MessageCircle, X, Globe, Brain, Send, Mail, Database, Lock, Zap, Shield,
  Bot, Building2, Palette, Activity, Megaphone, HeartPulse,
} from "lucide-react";

// ── Section definitions ──────────────────────────────────
const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-blue-400", bg: "bg-blue-500/10" },
    ],
  },
  {
    id: "clinical",
    label: "Patient Care",
    items: [
      { href: "/patients", label: "Patients", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
      { href: "/appointments", label: "Appointments", icon: CalendarDays, color: "text-violet-400", bg: "bg-violet-500/10" },
      { href: "/pre-visit", label: "Pre-Visit Briefs", icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10" },
      { href: "/waitlist", label: "Waitlist", icon: Users, color: "text-pink-400", bg: "bg-pink-500/10" },
    ],
  },
  {
    id: "comms",
    label: "Communications",
    items: [
      { href: "/messaging", label: "Patient Messaging", icon: MessageCircle, color: "text-cyan-400", bg: "bg-cyan-500/10" },
      { href: "/voice-calls", label: "Voice AI Calls", icon: Phone, color: "text-rose-400", bg: "bg-rose-500/10" },
      { href: "/inbound-calls", label: "Inbound Calls", icon: PhoneIncoming, color: "text-red-400", bg: "bg-red-500/10" },
    ],
  },
];

const settingsChildren = [
  { href: "/settings?tab=platform", label: "Platform", icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10" },
  { href: "/settings?tab=ai", label: "AI Services", icon: Brain, color: "text-violet-400", bg: "bg-violet-500/10" },
  { href: "/settings?tab=voice", label: "Voice AI", icon: Phone, color: "text-rose-400", bg: "bg-rose-500/10" },
  { href: "/settings?tab=messaging", label: "SMS / Messaging", icon: Send, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { href: "/settings?tab=email", label: "Email / SMTP", icon: Mail, color: "text-amber-400", bg: "bg-amber-500/10" },
  { href: "/settings?tab=emr", label: "EMR / FHIR / HL7", icon: Database, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { href: "/settings?tab=hipaa", label: "HIPAA", icon: Shield, color: "text-red-400", bg: "bg-red-500/10" },
  { href: "/settings?tab=protocols", label: "Clinical Protocols", icon: Stethoscope, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { href: "/settings?tab=services", label: "Patient Services", icon: Zap, color: "text-rose-400", bg: "bg-rose-500/10" },
  { href: "/settings?tab=security", label: "Security", icon: Lock, color: "text-emerald-400", bg: "bg-emerald-500/10" },
];

const superAdminChildren = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard, color: "text-blue-400", bg: "bg-blue-500/10" },
  { href: "/super-admin/users", label: "Users", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { href: "/super-admin/role-builder", label: "Role Builder", icon: Shield, color: "text-violet-400", bg: "bg-violet-500/10" },
  { href: "/super-admin/roles", label: "Roles", icon: ShieldCheck, color: "text-purple-400", bg: "bg-purple-500/10" },
  { href: "/super-admin/ai-agents", label: "AI Agents", icon: Bot, color: "text-amber-400", bg: "bg-amber-500/10" },
  { href: "/super-admin/agentic-ai", label: "Agentic AI", icon: Brain, color: "text-purple-400", bg: "bg-purple-500/10" },
  { href: "/super-admin/voice-pipeline", label: "Voice Pipeline", icon: Phone, color: "text-rose-400", bg: "bg-rose-500/10" },
  { href: "/super-admin/organizations", label: "Organizations", icon: Building2, color: "text-blue-400", bg: "bg-blue-500/10" },
  { href: "/super-admin/branding", label: "Branding", icon: Palette, color: "text-pink-400", bg: "bg-pink-500/10" },
  { href: "/super-admin/settings", label: "System Settings", icon: Settings, color: "text-slate-400", bg: "bg-slate-500/10" },
  { href: "/super-admin/api-management", label: "API Management", icon: Globe, color: "text-amber-400", bg: "bg-amber-500/10" },
  { href: "/super-admin/audit-logs", label: "Audit Logs", icon: FileText, color: "text-cyan-400", bg: "bg-cyan-500/10" },
];

export default function Sidebar() {
  return <Suspense fallback={null}><SidebarContent /></Suspense>;
}

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { canView, loading: permLoading } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    if (pathname.startsWith("/settings")) setExpandedGroups(g => ({ ...g, settings: true }));
    if (pathname.startsWith("/super-admin")) setExpandedGroups(g => ({ ...g, superadmin: true }));
    function onMobileToggle() { setMobileOpen(prev => !prev); }
    window.addEventListener("mobile-sidebar-toggle", onMobileToggle);
    return () => window.removeEventListener("mobile-sidebar-toggle", onMobileToggle);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: next } }));
    fetch("/api/user/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sidebarCollapsed: next }) }).catch(() => {});
  }

  function toggleSection(id: string) {
    setCollapsedSections(s => ({ ...s, [id]: !s[id] }));
  }

  function toggleGroup(group: string) {
    if (collapsed) { setCollapsed(false); localStorage.setItem("sidebar-collapsed", "false"); window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: false } })); }
    setExpandedGroups(g => ({ ...g, [group]: !g[group] }));
  }

  const user = session?.user;
  const showAdmin = !permLoading && (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN");
  const showSuperAdmin = !permLoading && user?.role === "SUPER_ADMIN";
  const w = collapsed ? "w-[68px]" : "w-64";

  function renderLink(item: any, indent = false) {
    let isActive = false;
    if (item.href.includes("?tab=")) {
      const tabMatch = item.href.match(/\?tab=(\w+)/);
      if (tabMatch) {
        const currentTab = searchParams.get("tab");
        isActive = pathname === "/settings" && currentTab === tabMatch[1];
      }
    } else {
      isActive = pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/super-admin");
    }
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
        onClick={() => setMobileOpen(false)}
        className={`${isActive ? "sidebar-link-active" : "sidebar-link"} ${collapsed ? "justify-center px-2" : ""} ${indent && !collapsed ? "pl-8" : ""}`}>
        <span className={`${indent && !collapsed ? "w-5 h-5" : "w-7 h-7"} rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-white/20" : item.bg}`}>
          <Icon className={`${indent && !collapsed ? "w-3 h-3" : "w-4 h-4"} ${isActive ? "text-white" : item.color}`} />
        </span>
        {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}
      </Link>
    );
  }

  function renderSectionHeader(id: string, label: string) {
    if (collapsed) return <div className="my-2 mx-2 border-t border-midnight-800/40" />;
    const isCollapsed = collapsedSections[id];
    return (
      <button onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-3 pt-4 pb-1 group">
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider group-hover:text-slate-400 transition-colors">{label}</span>
        {isCollapsed
          ? <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400" />
          : <ChevronDown className="w-3 h-3 text-slate-700 group-hover:text-slate-400" />
        }
      </button>
    );
  }

  function renderExpandable(label: string, icon: any, groupKey: string, children: any[], color: string, bg: string) {
    const Icon = icon;
    const isExpanded = expandedGroups[groupKey];
    const isChildActive = children.some(c => c.href.includes("?") ? false : pathname.startsWith(c.href));
    const isSettingsActive = groupKey === "settings" && pathname.startsWith("/settings");
    const active = isChildActive || isSettingsActive;

    return (
      <>
        <div onClick={() => toggleGroup(groupKey)} role="button" tabIndex={0}
          className={`sidebar-link cursor-pointer ${collapsed ? "justify-center px-2" : ""} ${active ? "!text-brand-400 !bg-brand-950/50 border border-brand-800/30" : ""}`}>
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? "bg-brand-600" : bg}`}>
            <Icon className={`w-4 h-4 ${active ? "text-white" : color}`} />
          </span>
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-[13px]">{label}</span>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </>
          )}
        </div>
        {isExpanded && !collapsed && (
          <div className="space-y-0.5 mt-0.5 mb-1">
            {children.map(child => renderLink(child, true))}
          </div>
        )}
      </>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-midnight-800/60 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/30 flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          {!collapsed && <div className="whitespace-nowrap"><span className="font-display font-bold text-lg text-white tracking-tight">MyAI<span className="text-brand-400">Doctor</span></span><span className="text-[10px] text-brand-500 font-mono ml-0.5">.io</span></div>}
        </Link>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {/* Render each section */}
        {SECTIONS.map(section => {
          const visibleItems = permLoading ? section.items : section.items.filter(item => canView(item.href));
          if (visibleItems.length === 0) return null;
          const isCollapsed = collapsedSections[section.id];
          return (
            <div key={section.id}>
              {renderSectionHeader(section.id, section.label)}
              {!isCollapsed && visibleItems.map(item => renderLink(item))}
            </div>
          );
        })}

        {/* Configuration section */}
        <div>
          {renderSectionHeader("config", "Configuration")}
          {!collapsedSections["config"] && (
            renderExpandable("Settings", Settings, "settings", settingsChildren, "text-slate-400", "bg-slate-500/10")
          )}
        </div>

        {/* Administration section */}
        {(showAdmin || showSuperAdmin) && (
          <div>
            {renderSectionHeader("admin", "Administration")}
            {!collapsedSections["admin"] && (
              <>
                {showAdmin && renderLink({ href: "/admin", label: "User Management", icon: ShieldCheck, color: "text-violet-400", bg: "bg-violet-500/10" })}
                {showSuperAdmin && renderExpandable("Super Admin", ShieldCheck, "superadmin", superAdminChildren, "text-red-400", "bg-red-500/10")}
              </>
            )}
          </div>
        )}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed left-0 top-0 bottom-0 ${w} bg-midnight-950 border-r border-midnight-800/60 flex-col z-50 ${mounted ? "transition-all duration-300" : ""} group/sidebar`}>
        {/* Collapse toggle — sits on the border between logo and nav */}
        <button onClick={toggleCollapse}
          className="absolute -right-3 top-[56px] -translate-y-1/2 z-[60] w-6 h-6 rounded-full bg-midnight-900 border border-midnight-700 flex items-center justify-center text-slate-500 hover:text-brand-400 hover:border-brand-600 hover:bg-midnight-800 transition-all opacity-0 group-hover/sidebar:opacity-100 focus:opacity-100 shadow-md"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
        {sidebarContent}
      </aside>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      {/* Mobile sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-72 bg-midnight-950 border-r border-midnight-800/60 flex flex-col z-50 lg:hidden transform transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </aside>
    </>
  );
}

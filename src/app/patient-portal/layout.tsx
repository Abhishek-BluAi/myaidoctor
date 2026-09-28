"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import AuthGuard from "@/components/AuthGuard";
import { Stethoscope, Home, FileText, ClipboardList, LogOut, Loader2, User, ChevronDown } from "lucide-react";
import { useState } from "react";

const patientNav = [
  { href: "/patient-portal", label: "Home", shortLabel: "Home", icon: Home, exact: true },
  { href: "/patient-portal/intake", label: "Pre-Visit Intake", shortLabel: "Intake", icon: ClipboardList },
  { href: "/patient-portal/my-records", label: "My Records", shortLabel: "Records", icon: FileText },
];

export default function PatientPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-midnight-950 pb-16 sm:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-50 border-b border-midnight-800/60 bg-midnight-950/90 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/patient-portal" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-white">
                MyAI<span className="text-brand-400">Doctor</span>
                <span className="text-[10px] text-brand-500 font-mono ml-0.5">.io</span>
              </span>
            </Link>

            {/* Desktop nav — hidden on mobile (shown in bottom bar instead) */}
            <nav className="hidden sm:flex items-center gap-1">
              {patientNav.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-brand-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-midnight-800/60"
                    }`}>
                    <Icon className="w-4 h-4" />{item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User area */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-midnight-800/60 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  {status === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`}
                </div>
                <span className="hidden sm:inline text-sm text-slate-300">{user?.firstName}</span>
                <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-midnight-900 border border-midnight-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-midnight-800/60">
                      <p className="text-xs font-medium text-white">{user?.firstName} {user?.lastName}</p>
                      <p className="text-[10px] text-slate-500">Patient</p>
                    </div>
                    <Link href="/profile" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-midnight-800/60">
                      <User className="w-4 h-4 text-slate-500" />Profile
                    </Link>
                    <div className="border-t border-midnight-800/60" />
                    <button onClick={() => signOut({ callbackUrl: window.location.origin + "/login" })}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/30">
                      <LogOut className="w-4 h-4" />Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>

        {/* Mobile bottom nav bar — visible only on small screens */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-midnight-950/95 backdrop-blur-sm border-t border-midnight-800/60">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
            {patientNav.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors min-w-[72px] ${
                    isActive ? "text-brand-400" : "text-slate-500"
                  }`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? "bg-brand-600/20" : ""}`}>
                    <Icon className={`w-5 h-5 ${isActive ? "text-brand-400" : ""}`} />
                  </div>
                  <span className={`text-[10px] font-medium ${isActive ? "text-brand-400" : ""}`}>{item.shortLabel}</span>
                </Link>
              );
            })}
          </div>
          {/* Safe area padding for phones with gesture bars */}
          <div className="h-safe-bottom" />
        </nav>
      </div>
    </AuthGuard>
  );
}

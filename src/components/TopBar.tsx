"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useTheme, ACCENTS } from "./ThemeProvider";
import { Sun, Moon, LogOut, Loader2, ChevronDown, User, Menu, Palette, Minus, Plus, Type } from "lucide-react";

export default function TopBar() {
  const { data: session, status } = useSession();
  const { mode, accent, fontSize, toggleMode, setAccent, increaseFontSize, decreaseFontSize, resetFontSize } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showTheme, setShowTheme] = useState(false);

  const user = session?.user;
  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`;
  const displayName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User";
  const roleLabel = user?.role?.replace(/_/g, " ") || "";

  function toggleMobileSidebar() {
    window.dispatchEvent(new CustomEvent("mobile-sidebar-toggle"));
  }

  return (
    <div className="sticky top-0 z-30 h-12 border-b border-midnight-800/40 bg-midnight-950/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2">
      {/* Left: hamburger on mobile */}
      <button onClick={toggleMobileSidebar} className="lg:hidden p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-midnight-800/60">
        <Menu className="w-5 h-5" />
      </button>

      {/* Spacer — pushes everything to the right */}
      <div className="flex-1" />

      {/* Right controls — always visible, always top-right */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Light / Dark mode */}
        <button onClick={toggleMode} title={mode === "dark" ? "Light mode" : "Dark mode"}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-midnight-800/60 transition-colors">
          {mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Accent color — visible on ALL screen sizes */}
        <div className="relative">
          <button onClick={() => { setShowTheme(!showTheme); setShowMenu(false); }}
            title="Theme color"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-midnight-800/60 transition-colors">
            <div className="w-3.5 h-3.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: ACCENTS.find(a => a.id === accent)?.color }} />
          </button>
          {showTheme && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTheme(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-midnight-900 border border-midnight-700 rounded-xl p-2.5 shadow-2xl z-50">
                <p className="text-[10px] text-slate-500 font-semibold uppercase px-1 mb-1.5">Theme Color</p>
                <div className="grid grid-cols-3 gap-1">
                  {ACCENTS.map(a => (
                    <button key={a.id} onClick={() => { setAccent(a.id); setShowTheme(false); }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${accent === a.id ? "bg-brand-950/50 text-brand-300" : "text-slate-400 hover:bg-midnight-800"}`}>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Font size controls */}
        <div className="flex items-center gap-0.5 bg-midnight-800/40 rounded-lg p-0.5">
          <button onClick={decreaseFontSize} disabled={fontSize <= 75}
            title="Decrease font size"
            className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-midnight-700/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <Minus className="w-3 h-3" />
          </button>
          <button onClick={resetFontSize}
            title={`Font size: ${fontSize}% (click to reset)`}
            className="px-1 py-1 rounded text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:bg-midnight-700/60 transition-colors min-w-[32px] text-center">
            {fontSize}%
          </button>
          <button onClick={increaseFontSize} disabled={fontSize >= 125}
            title="Increase font size"
            className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-midnight-700/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="w-px h-5 bg-midnight-700/50" />

        {/* User profile menu */}
        <div className="relative">
          <button onClick={() => { setShowMenu(!showMenu); setShowTheme(false); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-midnight-800/60 transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              {status === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-slate-200 leading-tight">{displayName}</p>
              <p className="text-[10px] text-slate-500 leading-tight capitalize">{roleLabel.toLowerCase()}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-midnight-900 border border-midnight-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-midnight-800/60 sm:hidden">
                  <p className="text-xs font-medium text-white">{displayName}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{roleLabel.toLowerCase()}</p>
                </div>
                <Link href="/profile" onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-midnight-800/60">
                  <User className="w-4 h-4 text-slate-500" />Profile & Security
                </Link>
                <div className="border-t border-midnight-800/60" />
                <button onClick={() => signOut({ callbackUrl: window.location.origin + "/login" })}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/30">
                  <LogOut className="w-4 h-4" />Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

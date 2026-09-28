"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export const ACCENTS = [
  { id: "emerald", label: "Emerald", color: "#10b981" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
  { id: "violet", label: "Violet", color: "#8b5cf6" },
  { id: "rose", label: "Rose", color: "#f43f5e" },
  { id: "amber", label: "Amber", color: "#f59e0b" },
  { id: "cyan", label: "Cyan", color: "#06b6d4" },
];

interface ThemeCtx {
  mode: "dark" | "light";
  accent: string;
  fontSize: number;
  setMode: (m: "dark" | "light") => void;
  setAccent: (a: string) => void;
  toggleMode: () => void;
  setFontSize: (s: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
}

const FONT_SIZES = [75, 85, 90, 95, 100, 105, 110, 115, 125];

const ThemeContext = createContext<ThemeCtx>({
  mode: "dark", accent: "emerald", fontSize: 100,
  setMode: () => {}, setAccent: () => {}, toggleMode: () => {},
  setFontSize: () => {}, increaseFontSize: () => {}, decreaseFontSize: () => {}, resetFontSize: () => {},
});

export function useTheme() { return useContext(ThemeContext); }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<"dark" | "light">("dark");
  const [accent, setAccentState] = useState("emerald");
  const [fontSize, setFontSizeState] = useState(100);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Load instantly from localStorage (fast, no flash)
    const cachedMode = localStorage.getItem("theme-mode") as "dark" | "light" || "dark";
    const cachedAccent = localStorage.getItem("theme-accent") || "emerald";
    const cachedFontSize = parseInt(localStorage.getItem("theme-font-size") || "100", 10);
    setModeState(cachedMode);
    setAccentState(cachedAccent);
    setFontSizeState(cachedFontSize);
    document.documentElement.setAttribute("data-mode", cachedMode);
    document.documentElement.setAttribute("data-accent", cachedAccent);
    document.documentElement.style.fontSize = `${cachedFontSize}%`;
    setMounted(true);

    // 2. Load from DB (source of truth) — overrides localStorage if different
    fetch("/api/user/preferences").then(r => r.json()).then(data => {
      if (data.preferences) {
        const p = data.preferences;
        if (p.themeMode && p.themeMode !== cachedMode) {
          setModeState(p.themeMode);
          localStorage.setItem("theme-mode", p.themeMode);
          document.documentElement.setAttribute("data-mode", p.themeMode);
        }
        if (p.themeAccent && p.themeAccent !== cachedAccent) {
          setAccentState(p.themeAccent);
          localStorage.setItem("theme-accent", p.themeAccent);
          document.documentElement.setAttribute("data-accent", p.themeAccent);
        }
        if (p.fontSize && p.fontSize !== cachedFontSize) {
          setFontSizeState(p.fontSize);
          localStorage.setItem("theme-font-size", String(p.fontSize));
          document.documentElement.style.fontSize = `${p.fontSize}%`;
        }
      }
    }).catch(() => {}); // Silently fail if not logged in
  }, []);

  const setMode = useCallback((m: "dark" | "light") => {
    setModeState(m);
    localStorage.setItem("theme-mode", m);
    document.documentElement.setAttribute("data-mode", m);
    fetch("/api/user/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themeMode: m }) }).catch(() => {});
  }, []);

  const setAccent = useCallback((a: string) => {
    setAccentState(a);
    localStorage.setItem("theme-accent", a);
    document.documentElement.setAttribute("data-accent", a);
    fetch("/api/user/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themeAccent: a }) }).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const setFontSize = useCallback((s: number) => {
    const clamped = Math.max(75, Math.min(125, s));
    setFontSizeState(clamped);
    localStorage.setItem("theme-font-size", String(clamped));
    document.documentElement.style.fontSize = `${clamped}%`;
    fetch("/api/user/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fontSize: clamped }) }).catch(() => {});
  }, []);

  const increaseFontSize = useCallback(() => {
    const idx = FONT_SIZES.indexOf(fontSize);
    if (idx < FONT_SIZES.length - 1) setFontSize(FONT_SIZES[idx + 1]);
    else if (idx === -1) setFontSize(Math.min(125, fontSize + 5));
  }, [fontSize, setFontSize]);

  const decreaseFontSize = useCallback(() => {
    const idx = FONT_SIZES.indexOf(fontSize);
    if (idx > 0) setFontSize(FONT_SIZES[idx - 1]);
    else if (idx === -1) setFontSize(Math.max(75, fontSize - 5));
  }, [fontSize, setFontSize]);

  const resetFontSize = useCallback(() => {
    setFontSize(100);
  }, [setFontSize]);

  if (!mounted) return <>{children}</>;

  return (
    <ThemeContext.Provider value={{ mode, accent, fontSize, setMode, setAccent, toggleMode, setFontSize, increaseFontSize, decreaseFontSize, resetFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

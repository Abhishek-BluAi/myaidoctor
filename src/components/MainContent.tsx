"use client";

import { useState, useEffect } from "react";
import TopBar from "./TopBar";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
      setIsDesktop(window.innerWidth >= 1024);
      const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
      window.addEventListener("resize", handleResize);
      function onToggle(e: Event) { setCollapsed((e as CustomEvent).detail.collapsed); }
      window.addEventListener("sidebar-toggle", onToggle);
      return () => { window.removeEventListener("resize", handleResize); window.removeEventListener("sidebar-toggle", onToggle); };
    }
  }, []);

  const ml = isDesktop ? (collapsed ? "ml-[68px]" : "ml-64") : "ml-0";

  return (
    <main className={`min-h-screen ${ml} ${mounted ? "transition-all duration-300" : ""}`}>
      <TopBar />
      <div className="p-3 sm:p-5 lg:p-8 max-w-[1440px]">{children}</div>
    </main>
  );
}

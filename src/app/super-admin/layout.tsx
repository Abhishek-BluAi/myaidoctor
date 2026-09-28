"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import { usePermissions } from "@/components/PermissionProvider";
import { useState, useEffect } from "react";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { can, loading: permLoading } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
      setIsDesktop(window.innerWidth >= 1024);
      const hr = () => setIsDesktop(window.innerWidth >= 1024);
      window.addEventListener("resize", hr);
      function onToggle(e: Event) { setCollapsed((e as CustomEvent).detail.collapsed); }
      window.addEventListener("sidebar-toggle", onToggle);
      return () => { window.removeEventListener("resize", hr); window.removeEventListener("sidebar-toggle", onToggle); };
    }
  }, []);

  const ml = isDesktop ? (collapsed ? "ml-[68px]" : "ml-64") : "ml-0";

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <Sidebar />
        <div className={`${ml} min-h-screen ${mounted ? "transition-all duration-300" : ""}`}>
          <TopBar />
          <main className="p-3 sm:p-5 lg:p-8 max-w-[1440px]">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

"use client";

import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import MainContent from "@/components/MainContent";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      window.location.href = "/dashboard";
    }
  }, [session]);

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </AuthGuard>
  );
}

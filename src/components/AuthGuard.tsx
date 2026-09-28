"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { usePermissions } from "./PermissionProvider";
import { Loader2, ShieldAlert } from "lucide-react";

const PATIENT_ALLOWED = ["/patient-portal", "/profile", "/api"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { canView, permissions, loading: permLoading } = usePermissions();
  const pathname = usePathname();

  if (status === "loading" || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-midnight-950">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    window.location.href = "/login";
    return null;
  }

  if (session?.user?.mfaRequired !== false && session?.user?.mfaEnabled && !session?.user?.mfaVerified) {
    window.location.href = "/login";
    return null;
  }

  // PATIENT role — block access to all clinical/admin pages
  if (session?.user?.role === "PATIENT") {
    const isAllowed = PATIENT_ALLOWED.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      window.location.href = "/patient-portal";
      return null;
    }
    return <>{children}</>;
  }

  // Safety: if permissions are empty (API failed), allow access rather than lock out
  if (permissions.length === 0) {
    return <>{children}</>;
  }

  // Check page-level permission
  if (!canView(pathname)) {
    const isPatient = session?.user?.role === "PATIENT";
    return (
      <div className="min-h-screen flex items-center justify-center bg-midnight-950">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-display font-bold text-white">Access Denied</h2>
          <p className="text-sm text-slate-400 max-w-sm">
            You don&apos;t have permission to access this page.
            Contact your administrator if you believe this is an error.
          </p>
          <button onClick={() => window.location.href = isPatient ? "/patient-portal" : "/dashboard"}
            className="btn-primary inline-flex">{isPatient ? "Go to Patient Portal" : "Go to Dashboard"}</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

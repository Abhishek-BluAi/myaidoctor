"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PermissionEntry, hasPermission, canViewPath } from "@/lib/permissions";

interface PermissionContextValue {
  permissions: PermissionEntry[];
  loading: boolean;
  /** Check if user has a specific resource+action permission */
  can: (resource: string, action?: string) => boolean;
  /** Check if user can view a sidebar path */
  canView: (path: string) => boolean;
  /** Reload permissions from server */
  reload: () => void;
}

const PermissionContext = createContext<PermissionContextValue>({
  permissions: [],
  loading: true,
  can: () => false,
  canView: () => false,
  reload: () => {},
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (status !== "authenticated") {
      setPermissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/permissions");
      const data = await res.json();
      setPermissions(data.permissions || []);
    } catch {
      setPermissions([]);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (resource: string, action: string = "view") =>
      hasPermission(permissions, resource, action),
    [permissions]
  );

  const canView = useCallback(
    (path: string) => canViewPath(permissions, path),
    [permissions]
  );

  return (
    <PermissionContext.Provider
      value={{ permissions, loading, can, canView, reload: load }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

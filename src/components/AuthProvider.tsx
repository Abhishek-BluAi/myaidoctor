"use client";

import { SessionProvider } from "next-auth/react";
import { PermissionProvider } from "./PermissionProvider";
import ThemeProvider from "./ThemeProvider";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <PermissionProvider>{children}</PermissionProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

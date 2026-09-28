import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Check both possible cookie names
  const hasSession =
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token");

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|signup|forgot-password|reset-password|api|_next|favicon.ico|images|fonts|m/|qr/).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "tutor_session";

function decodeToken(token: string): { role: string; username: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr);
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      role: payload.role as string,
      username: payload.username as string,
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api auth, and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Read session token
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? decodeToken(token) : null;

  // 1. Root route: redirect based on auth status
  if (pathname === "/") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(
      new URL(user.role === "admin" ? "/admin" : "/student", request.url)
    );
  }

  // 2. Login route: redirect to portal if already authenticated
  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(
        new URL(user.role === "admin" ? "/admin" : "/student", request.url)
      );
    }
    return NextResponse.next();
  }

  // 3. Student routes: require login (admin or student)
  if (pathname.startsWith("/student")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // 4. Admin routes: require admin role
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (user.role !== "admin") {
      // Students cannot access admin portal!
      return NextResponse.redirect(new URL("/student", request.url));
    }
    return NextResponse.next();
  }

  // 5. Admin API routes guard
  if (pathname.startsWith("/api/admin")) {
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

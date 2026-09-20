import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSessionCookieName } from "@/lib/session";

export const config = {
  matcher: [
    "/((?!login|api/login|_next/static|_next/image|favicon.ico|logo.svg).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get(getSessionCookieName())?.value
  );
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isAdminArea =
    path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");
  const isShared = path === "/api/logout";

  if (session.role === "admin") {
    // مدیر فقط بخش مدیریت را می‌بیند؛ صفحه‌های فروشگاه مخصوص حساب هر فروشگاه است.
    if (isAdminArea || isShared) return NextResponse.next();
    if (isApi) {
      return NextResponse.json(
        { error: "این بخش مخصوص حساب فروشگاه است." },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isAdminArea) {
    if (isApi) {
      return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

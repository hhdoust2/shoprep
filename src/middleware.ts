import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue, getSessionCookieName } from "@/lib/session";

export const config = {
  matcher: [
    "/((?!login|api/login|_next/static|_next/image|favicon.ico|logo.svg).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const cookieValue = request.cookies.get(getSessionCookieName())?.value;
  const isValid = await verifySessionValue(cookieValue);

  if (isValid) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

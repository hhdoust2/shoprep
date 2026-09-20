import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/login";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: NextRequest) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const result = await authenticate(username, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await setSessionCookie(result.session);
  return NextResponse.json({ ok: true, role: result.session.role });
}

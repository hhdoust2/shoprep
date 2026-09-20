import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, ensureSchema } from "@/lib/db";
import { isAdminSession } from "@/lib/auth";
import { validateName, validatePassword, validateUsername } from "@/lib/stores";

// ساخت حساب فروشگاه جدید (فقط مدیر)
export async function POST(request: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403 });
  }
  await ensureSchema();

  let body: { name?: unknown; username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const problem =
    validateName(name) ?? validateUsername(username) ?? validatePassword(password);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const result = await db.execute({
      sql: "INSERT INTO stores (name, username, password_hash) VALUES (?, ?, ?)",
      args: [name, username, hash],
    });
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (err) {
    if (/unique/i.test(err instanceof Error ? err.message : String(err))) {
      return NextResponse.json(
        { error: "این نام کاربری قبلاً استفاده شده است." },
        { status: 409 }
      );
    }
    throw err;
  }
}

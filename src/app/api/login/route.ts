import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, ensureSchema } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 1000 * 60 * 15; // ۱۵ دقیقه قفل پس از تلاش‌های ناموفق پیاپی

interface LoginState {
  failed_count: number;
  locked_until: string | null;
}

export async function POST(request: NextRequest) {
  await ensureSchema();

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";

  const stateResult = await db.execute(
    "SELECT failed_count, locked_until FROM login_state WHERE id = 1"
  );
  const state = stateResult.rows[0] as unknown as LoginState;

  if (state.locked_until && new Date(state.locked_until).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "به دلیل تلاش‌های ناموفق زیاد، ورود موقتاً قفل شده است." },
      { status: 429 }
    );
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !password) {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const isMatch = await bcrypt.compare(password, hash);

  if (!isMatch) {
    const newFailedCount = state.failed_count + 1;
    const lockedUntil =
      newFailedCount >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
        : null;

    await db.execute({
      sql: "UPDATE login_state SET failed_count = ?, locked_until = ? WHERE id = 1",
      args: [newFailedCount, lockedUntil],
    });

    return NextResponse.json({ error: "رمز عبور اشتباه است." }, { status: 401 });
  }

  await db.execute(
    "UPDATE login_state SET failed_count = 0, locked_until = NULL WHERE id = 1"
  );

  await setSessionCookie();

  return NextResponse.json({ ok: true });
}

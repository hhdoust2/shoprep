import bcrypt from "bcryptjs";
import { db, ensureSchema } from "./db";
import type { Session } from "./session";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 1000 * 60 * 15; // ۱۵ دقیقه قفل پس از تلاش‌های ناموفق پیاپی

export const ADMIN_USERNAME = "admin";

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; status: number; error: string };

const GENERIC_ERROR = "نام کاربری یا رمز عبور اشتباه است.";

// برای نام‌های کاربری ناموجود هم یک مقایسه‌ی bcrypt انجام می‌دهیم تا زمان پاسخ
// نشان ندهد آن نام کاربری وجود دارد یا نه.
let dummyHash: string | undefined;
function getDummyHash(): string {
  if (!dummyHash) dummyHash = bcrypt.hashSync("dummy-password-for-timing", 10);
  return dummyHash;
}

interface Target {
  hash: string;
  session: Session;
}

async function findTarget(username: string): Promise<Target | null> {
  if (username === ADMIN_USERNAME) {
    const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
    return hash ? { hash, session: { role: "admin" } } : null;
  }

  const result = await db.execute({
    sql: "SELECT id, password_hash, is_active FROM stores WHERE username = ?",
    args: [username],
  });
  const row = result.rows[0] as unknown as
    | { id: number | string; password_hash: string; is_active: number | string }
    | undefined;

  if (!row || !Number(row.is_active) || !row.password_hash) return null;
  return {
    hash: String(row.password_hash),
    session: { role: "store", storeId: Number(row.id) },
  };
}

export async function authenticate(
  usernameInput: string,
  password: string
): Promise<AuthResult> {
  await ensureSchema();

  const username = usernameInput.trim().toLowerCase().slice(0, 64);
  if (!username || !password) {
    return { ok: false, status: 400, error: "نام کاربری و رمز عبور را وارد کنید." };
  }

  const target = await findTarget(username);
  if (!target) {
    await bcrypt.compare(password, getDummyHash());
    return { ok: false, status: 401, error: GENERIC_ERROR };
  }

  // شمارنده‌ی تلاش‌های ناموفق فقط برای حساب‌های واقعی نگه داشته می‌شود.
  const attemptResult = await db.execute({
    sql: "SELECT failed_count, locked_until FROM login_attempts WHERE username = ?",
    args: [username],
  });
  const attempt = attemptResult.rows[0] as unknown as
    | { failed_count: number | string; locked_until: string | null }
    | undefined;

  if (attempt?.locked_until) {
    if (new Date(attempt.locked_until).getTime() > Date.now()) {
      return {
        ok: false,
        status: 429,
        error: "به دلیل تلاش‌های ناموفق زیاد، ورود موقتاً قفل شده است.",
      };
    }
    // قفل تمام شده؛ شمارش از صفر شروع می‌شود.
    await db.execute({
      sql: "DELETE FROM login_attempts WHERE username = ?",
      args: [username],
    });
  }

  const isMatch = await bcrypt.compare(password, target.hash);

  if (!isMatch) {
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    await db.execute({
      sql: `INSERT INTO login_attempts (username, failed_count, locked_until)
            VALUES (?, 1, NULL)
            ON CONFLICT(username) DO UPDATE SET
              failed_count = failed_count + 1,
              locked_until = CASE WHEN failed_count + 1 >= ? THEN ? ELSE locked_until END`,
      args: [username, MAX_ATTEMPTS, lockedUntil],
    });
    return { ok: false, status: 401, error: GENERIC_ERROR };
  }

  await db.execute({
    sql: "DELETE FROM login_attempts WHERE username = ?",
    args: [username],
  });
  return { ok: true, session: target.session };
}

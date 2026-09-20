import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, ensureSchema } from "@/lib/db";
import { isAdminSession } from "@/lib/auth";
import { validateName, validatePassword } from "@/lib/stores";

interface Body {
  action?: unknown;
  password?: unknown;
  active?: unknown;
  name?: unknown;
}

// عملیات روی یک فروشگاه (فقط مدیر): تغییر رمز، فعال/غیرفعال کردن، باز کردن قفل کارت، تغییر نام
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403 });
  }
  await ensureSchema();

  const storeId = Number(params.id);
  if (!Number.isInteger(storeId) || storeId <= 0) {
    return NextResponse.json({ error: "شناسه‌ی نامعتبر است." }, { status: 400 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const storeResult = await db.execute({
    sql: "SELECT username FROM stores WHERE id = ?",
    args: [storeId],
  });
  const store = storeResult.rows[0] as unknown as { username: string } | undefined;
  if (!store) {
    return NextResponse.json({ error: "فروشگاه پیدا نشد." }, { status: 404 });
  }

  switch (body.action) {
    case "set_password": {
      const password = typeof body.password === "string" ? body.password : "";
      const problem = validatePassword(password);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });

      const hash = await bcrypt.hash(password, 10);
      await db.execute({
        sql: "UPDATE stores SET password_hash = ? WHERE id = ?",
        args: [hash, storeId],
      });
      // قفل ورود ناشی از تلاش‌های ناموفق قبلی هم برداشته می‌شود.
      await db.execute({
        sql: "DELETE FROM login_attempts WHERE username = ?",
        args: [String(store.username)],
      });
      return NextResponse.json({ ok: true });
    }

    case "set_active": {
      await db.execute({
        sql: "UPDATE stores SET is_active = ? WHERE id = ?",
        args: [body.active ? 1 : 0, storeId],
      });
      return NextResponse.json({ ok: true });
    }

    case "unlock_card": {
      await db.execute({
        sql: "UPDATE store_cards SET locked = 0 WHERE store_id = ?",
        args: [storeId],
      });
      return NextResponse.json({ ok: true });
    }

    case "rename": {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const problem = validateName(name);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });

      await db.execute({
        sql: "UPDATE stores SET name = ? WHERE id = ?",
        args: [name, storeId],
      });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
  }
}

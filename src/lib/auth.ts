import { db, ensureSchema } from "./db";
import { getSession } from "./session";

export interface ActiveStore {
  id: number;
  name: string;
  username: string;
}

// فروشگاهِ واردشده را برمی‌گرداند، فقط اگر حسابش هنوز فعال باشد. وضعیت «فعال» هر بار
// از دیتابیس خوانده می‌شود، پس غیرفعال کردن یک حساب فوراً اثر می‌کند و نیازی به
// منتظر ماندن برای پایان اعتبار کوکی (۱۲ ساعت) نیست.
export async function getActiveStore(): Promise<ActiveStore | null> {
  const session = await getSession();
  if (!session || session.role !== "store") return null;

  await ensureSchema();
  const result = await db.execute({
    sql: "SELECT id, name, username, is_active FROM stores WHERE id = ?",
    args: [session.storeId],
  });
  const row = result.rows[0] as unknown as
    | { id: number | string; name: string; username: string; is_active: number | string }
    | undefined;

  if (!row || !Number(row.is_active)) return null;
  return { id: Number(row.id), name: String(row.name), username: String(row.username) };
}

export async function isAdminSession(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "admin";
}

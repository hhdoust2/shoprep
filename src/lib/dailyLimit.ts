import { db, ensureSchema } from "./db";

// شمارش پیام‌های امروز؛ اگر storeId داده شود فقط همان فروشگاه، وگرنه کل سرویس.
export async function getTodayCount(storeId?: number): Promise<number> {
  await ensureSchema();
  const result =
    storeId === undefined
      ? await db.execute(
          `SELECT COUNT(*) as count FROM interaction_log WHERE date(created_at) = date('now')`
        )
      : await db.execute({
          sql: `SELECT COUNT(*) as count FROM interaction_log
                WHERE date(created_at) = date('now') AND store_id = ?`,
          args: [storeId],
        });
  const row = result.rows[0] as unknown as { count: number | string } | undefined;
  return Number(row?.count ?? 0);
}

// سقف روزانه برای هر فروشگاه
export function getDailyCap(): number {
  const cap = Number(process.env.DAILY_MESSAGE_CAP);
  return Number.isFinite(cap) && cap > 0 ? cap : 100;
}

// سقف اختیاریِ روزانه برای مجموع همه‌ی فروشگاه‌ها (مثلاً برای رعایت سقف حساب
// OpenRouter). اگر DAILY_TOTAL_CAP تنظیم نشده باشد، null است.
export function getTotalCap(): number | null {
  const cap = Number(process.env.DAILY_TOTAL_CAP);
  return Number.isFinite(cap) && cap > 0 ? cap : null;
}

export type CapStatus = "ok" | "store" | "total";

export async function checkDailyCap(storeId: number): Promise<CapStatus> {
  if ((await getTodayCount(storeId)) >= getDailyCap()) return "store";
  const totalCap = getTotalCap();
  if (totalCap !== null && (await getTodayCount()) >= totalCap) return "total";
  return "ok";
}

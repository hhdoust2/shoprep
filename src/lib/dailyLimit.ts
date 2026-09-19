import { db, ensureSchema } from "./db";

export async function getTodayCount(): Promise<number> {
  await ensureSchema();
  const result = await db.execute(
    `SELECT COUNT(*) as count FROM interaction_log WHERE date(created_at) = date('now')`
  );
  const row = result.rows[0] as unknown as { count: number | string } | undefined;
  return Number(row?.count ?? 0);
}

export function getDailyCap(): number {
  const cap = Number(process.env.DAILY_MESSAGE_CAP);
  return Number.isFinite(cap) && cap > 0 ? cap : 100;
}

export async function isDailyCapReached(): Promise<boolean> {
  return (await getTodayCount()) >= getDailyCap();
}

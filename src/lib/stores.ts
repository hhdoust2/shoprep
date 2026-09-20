import { db, ensureSchema } from "./db";

export interface StoreSummary {
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  hasPassword: boolean;
  generated: number;
  copied: number;
  unedited: number;
  today: number;
  hasCard: boolean;
  cardLocked: boolean;
  lastUsed: string | null;
}

export async function listStoresWithStats(): Promise<StoreSummary[]> {
  await ensureSchema();
  const result = await db.execute(
    `SELECT
       s.id, s.name, s.username, s.is_active,
       (s.password_hash != '') AS has_password,
       (SELECT COUNT(*) FROM interaction_log l WHERE l.store_id = s.id) AS generated,
       (SELECT COUNT(*) FROM interaction_log l
          WHERE l.store_id = s.id AND l.selected_reply IS NOT NULL) AS copied,
       (SELECT COALESCE(SUM(l.no_edit_flag), 0) FROM interaction_log l
          WHERE l.store_id = s.id) AS unedited,
       (SELECT COUNT(*) FROM interaction_log l
          WHERE l.store_id = s.id AND date(l.created_at) = date('now')) AS today,
       (SELECT COUNT(*) FROM store_cards c WHERE c.store_id = s.id) AS has_card,
       (SELECT COALESCE(MAX(c.locked), 0) FROM store_cards c WHERE c.store_id = s.id) AS card_locked,
       (SELECT MAX(l.created_at) FROM interaction_log l WHERE l.store_id = s.id) AS last_used
     FROM stores s
     ORDER BY s.id`
  );

  return result.rows.map((raw) => {
    const r = raw as unknown as Record<string, number | string | null>;
    return {
      id: Number(r.id),
      name: String(r.name),
      username: String(r.username),
      isActive: Boolean(Number(r.is_active)),
      hasPassword: Boolean(Number(r.has_password)),
      generated: Number(r.generated ?? 0),
      copied: Number(r.copied ?? 0),
      unedited: Number(r.unedited ?? 0),
      today: Number(r.today ?? 0),
      hasCard: Number(r.has_card ?? 0) > 0,
      cardLocked: Boolean(Number(r.card_locked ?? 0)),
      lastUsed: r.last_used ? String(r.last_used) : null,
    };
  });
}

export function validateUsername(value: string): string | null {
  if (!/^[a-z0-9._-]{3,32}$/.test(value)) {
    return "نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف کوچک انگلیسی، عدد و . _ - باشد.";
  }
  if (value === "admin") return "این نام کاربری رزرو شده است.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد.";
  if (value.length > 72) return "رمز عبور حداکثر ۷۲ کاراکتر می‌تواند باشد.";
  return null;
}

export function validateName(value: string): string | null {
  if (!value) return "نام فروشگاه الزامی است.";
  if (value.length > 60) return "نام فروشگاه حداکثر ۶۰ کاراکتر می‌تواند باشد.";
  return null;
}

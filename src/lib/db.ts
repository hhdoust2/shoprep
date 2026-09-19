import { createClient, type Client } from "@libsql/client";

declare global {
  // eslint-disable-next-line no-var
  var __panelDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __panelSchemaReady: Promise<void> | undefined;
}

// فاصله، خط جدید یا علامت نقل‌قول اضافه (که هنگام کپی/پیست در Vercel ممکن است
// همراه مقدار بیاید) باعث می‌شود Turso خطای ۴۰۰ برگرداند؛ پس پاکشان می‌کنیم.
function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/^["']+|["']+$/g, "").trim();
  return cleaned || undefined;
}

function createConnection(): Client {
  const url = cleanEnv(process.env.TURSO_DATABASE_URL);
  const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);

  if (!url) {
    throw new Error("TURSO_DATABASE_URL در متغیرهای محیطی تنظیم نشده است.");
  }

  // فقط برای عیب‌یابی در لاگ‌ها؛ خود توکن یا آدرس کامل چاپ نمی‌شود.
  try {
    console.log(
      "[db] scheme=%s host=%s tokenLength=%s tokenLooksLikeJwt=%s",
      url.split(":")[0],
      new URL(url.replace(/^libsql:/, "https:")).host,
      authToken ? authToken.length : 0,
      authToken ? authToken.startsWith("eyJ") : false
    );
  } catch {
    console.log("[db] TURSO_DATABASE_URL is not a valid URL");
  }

  // برای دیتابیس ریموت Turso (url با پیشوند libsql:// یا https://) این کلاینت
  // از HTTP استفاده می‌کند و به باینری Native نیازی ندارد؛ همین باعث می‌شود
  // روی توابع سرورلس Vercel (که سیستم فایلشان فقط-خواندنی است) بدون مشکل کار کند.
  return createClient({ url, authToken });
}

// در حالت dev، نکست‌جی‌اس ماژول‌ها را هات‌ریلود می‌کند؛ برای جلوگیری از باز شدن
// چند اتصال هم‌زمان، از یک نمونه‌ی singleton سراسری استفاده می‌کنیم.
export const db: Client = global.__panelDb ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  global.__panelDb = db;
}

// این آرایه باید با scripts/init-db.mjs هم‌گام بماند (برای پایلوت فعلی، اسکیما ثابت است).
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS store_card (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_info TEXT NOT NULL,
    products TEXT NOT NULL,
    shipping_terms TEXT NOT NULL,
    return_policy TEXT NOT NULL,
    tone TEXT NOT NULL,
    contact_info TEXT NOT NULL,
    extra_notes TEXT NOT NULL,
    locked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS interaction_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_message TEXT NOT NULL,
    suggestions TEXT NOT NULL,
    selected_reply TEXT,
    no_edit_flag INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS login_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  )`,
  `INSERT OR IGNORE INTO login_state (id, failed_count, locked_until) VALUES (1, 0, NULL)`,
];

export function ensureSchema(): Promise<void> {
  if (!global.__panelSchemaReady) {
    global.__panelSchemaReady = db
      .batch(SCHEMA_STATEMENTS, "write")
      .then(() => undefined);
  }
  return global.__panelSchemaReady;
}

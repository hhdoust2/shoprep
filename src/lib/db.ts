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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    store_id INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS login_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  )`,
  `INSERT OR IGNORE INTO login_state (id, failed_count, locked_until) VALUES (1, 0, NULL)`,
  // --- چندفروشگاهی: هر فروشگاه یک حساب کاربری، کارت و تاریخچه‌ی جدا دارد ---
  `CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS store_cards (
    store_id INTEGER PRIMARY KEY REFERENCES stores(id),
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
  `CREATE TABLE IF NOT EXISTS login_attempts (
    username TEXT PRIMARY KEY,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  )`,
];

// دیتابیس‌هایی که قبل از چندفروشگاهی ساخته شده‌اند: ستون store_id اضافه می‌شود و
// کارت و تاریخچه‌ی فروشگاه قبلی (اگر باشد) به یک حساب با نام کاربری «store1» منتقل
// می‌شود. آن حساب تا وقتی مدیر برایش رمز نگذاشته نمی‌تواند وارد شود.
// همه‌ی مراحل idempotent هستند و اجرای دوباره‌شان بی‌ضرر است.
async function migrateSchema(): Promise<void> {
  // وجود ستون را با یک SELECT ساده می‌سنجیم (به‌جای PRAGMA) که روی هر نوع اتصال کار کند.
  let hasStoreId = true;
  try {
    await db.execute("SELECT store_id FROM interaction_log LIMIT 1");
  } catch {
    hasStoreId = false;
  }
  if (!hasStoreId) {
    try {
      await db.execute("ALTER TABLE interaction_log ADD COLUMN store_id INTEGER");
    } catch (err) {
      // اگر هم‌زمان یک نمونه‌ی دیگر ستون را ساخته باشد، خطای تکراری بودن بی‌اهمیت است.
      if (!/duplicate column/i.test(err instanceof Error ? err.message : String(err))) {
        throw err;
      }
    }
  }

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_interaction_log_store_created ON interaction_log (store_id, created_at)"
  );

  await db.execute(
    `INSERT INTO stores (name, username, password_hash, is_active)
     SELECT 'فروشگاه اول', 'store1', '', 1
     WHERE NOT EXISTS (SELECT 1 FROM stores)
       AND EXISTS (SELECT 1 FROM store_card WHERE id = 1)`
  );
  await db.execute(
    `INSERT OR IGNORE INTO store_cards (
       store_id, business_info, products, shipping_terms, return_policy,
       tone, contact_info, extra_notes, locked, created_at, updated_at
     )
     SELECT s.id, c.business_info, c.products, c.shipping_terms, c.return_policy,
            c.tone, c.contact_info, c.extra_notes, c.locked, c.created_at, c.updated_at
     FROM store_card c
     JOIN stores s ON s.username = 'store1' AND s.password_hash = ''
     WHERE c.id = 1`
  );
  await db.execute(
    `UPDATE interaction_log
     SET store_id = (SELECT id FROM stores WHERE username = 'store1' AND password_hash = '')
     WHERE store_id IS NULL
       AND EXISTS (SELECT 1 FROM stores WHERE username = 'store1' AND password_hash = '')`
  );
}

// فقط برای عیب‌یابی: وقتی Turso خطا می‌دهد، چند درخواست ساده‌ی مستقیم می‌فرستیم
// تا کد و متن جواب واقعی سرور در لاگ‌های Vercel دیده شود. هیچ توکنی چاپ نمی‌شود.
async function probe(label: string, url: string, init: RequestInit): Promise<void> {
  try {
    const res = await fetch(url, init);
    const text = (await res.text()).slice(0, 200);
    console.error(
      "[db-debug] %s status=%s server=%s type=%s body=%s",
      label,
      res.status,
      res.headers.get("server"),
      res.headers.get("content-type"),
      text
    );
  } catch (e) {
    console.error(
      "[db-debug] %s fetch failed: %s",
      label,
      e instanceof Error ? e.message : String(e)
    );
  }
}

async function debugPipeline(): Promise<void> {
  const rawUrl = cleanEnv(process.env.TURSO_DATABASE_URL) ?? "";
  const token = cleanEnv(process.env.TURSO_AUTH_TOKEN) ?? "";
  const base = rawUrl.replace(/^libsql:/, "https:").replace(/\/+$/, "");
  const auth = { Authorization: `Bearer ${token}` };
  const body = JSON.stringify({
    requests: [
      { type: "execute", stmt: { sql: "SELECT 1" } },
      { type: "close" },
    ],
  });
  const json = { "Content-Type": "application/json" };

  await probe("health(no-auth)", `${base}/health`, { method: "GET" });
  await probe("version(auth)", `${base}/version`, { method: "GET", headers: auth });
  await probe("pipeline(no-auth)", `${base}/v2/pipeline`, {
    method: "POST",
    headers: json,
    body,
  });
  await probe("pipeline(auth)", `${base}/v2/pipeline`, {
    method: "POST",
    headers: { ...auth, ...json },
    body,
  });
}

// دستورها را یکی‌یکی اجرا می‌کنیم (نه در یک batch/تراکنش)؛ همه idempotent هستند.
// اگر خطا بدهد، نتیجه‌ی ناموفق کش نمی‌شود تا درخواست بعدی دوباره تلاش کند.
export function ensureSchema(): Promise<void> {
  if (!global.__panelSchemaReady) {
    global.__panelSchemaReady = (async () => {
      try {
        for (const sql of SCHEMA_STATEMENTS) {
          await db.execute(sql);
        }
        await migrateSchema();
      } catch (err) {
        global.__panelSchemaReady = undefined;
        console.error(
          "[db] schema setup failed:",
          err instanceof Error ? err.message : String(err)
        );
        await debugPipeline();
        throw err;
      }
    })();
  }
  return global.__panelSchemaReady;
}

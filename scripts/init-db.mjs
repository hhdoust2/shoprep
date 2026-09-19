// اسکریپت یک‌باره برای ساخت جدول‌ها روی دیتابیس Turso، پیش از اولین دیپلوی.
// قبل از اجرا مطمئن شوید TURSO_DATABASE_URL و TURSO_AUTH_TOKEN در محیط export شده‌اند، مثلاً:
//   export TURSO_DATABASE_URL=libsql://...
//   export TURSO_AUTH_TOKEN=...
//   npm run init-db
//
// نکته: این آرایه باید با SCHEMA_STATEMENTS در src/lib/db.ts هم‌گام بماند
// (که برای پایلوت فعلی چون هفت فیلد کارت و جدول لاگ ثابت‌اند، مشکلی ایجاد نمی‌کند).
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("TURSO_DATABASE_URL تنظیم نشده است.");
  process.exit(1);
}

const db = createClient({ url, authToken });

const statements = [
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

await db.batch(statements, "write");
console.log("جدول‌ها با موفقیت روی Turso ساخته شدند.");

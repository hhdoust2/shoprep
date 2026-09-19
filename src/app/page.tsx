import Link from "next/link";
import { db, ensureSchema } from "@/lib/db";
import MessageBox from "@/components/MessageBox";

export default async function HomePage() {
  await ensureSchema();
  const result = await db.execute("SELECT id FROM store_card WHERE id = 1");
  const hasCard = result.rows.length > 0;

  if (!hasCard) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-lg font-semibold text-ink">
          هنوز کارت فروشگاه تکمیل نشده
        </h1>
        <p className="mb-6 text-sm text-ink/60">
          پیش از دریافت پیشنهاد پاسخ، باید یک‌بار کارت فروشگاه را پر کنید.
        </p>
        <Link
          href="/card"
          className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          تکمیل کارت فروشگاه
        </Link>
      </div>
    );
  }

  return <MessageBox />;
}

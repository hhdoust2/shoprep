import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { db, ensureSchema } from "@/lib/db";
import MessageBox from "@/components/MessageBox";

// این صفحه هر بار باید وضعیت تازه‌ی کارت فروشگاه را از دیتابیس بخواند،
// نه یک نسخه‌ی کش‌شده از اولین بار که ساخته شده.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  // تضمین می‌کند این صفحه هرگز موقع build ساخته نشود و به دیتابیس وصل نشود.
  noStore();
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

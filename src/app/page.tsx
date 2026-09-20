import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { db, ensureSchema } from "@/lib/db";
import { getActiveStore } from "@/lib/auth";
import MessageBox from "@/components/MessageBox";

// این صفحه هر بار باید وضعیت تازه‌ی کارت فروشگاه را از دیتابیس بخواند،
// نه یک نسخه‌ی کش‌شده از اولین بار که ساخته شده.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  // تضمین می‌کند این صفحه هرگز موقع build ساخته نشود و به دیتابیس وصل نشود.
  noStore();
  const store = await getActiveStore();
  if (!store) redirect("/login");

  await ensureSchema();
  const result = await db.execute({
    sql: "SELECT store_id FROM store_cards WHERE store_id = ?",
    args: [store.id],
  });
  const hasCard = result.rows.length > 0;

  if (!hasCard) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-2 text-xs text-ink/50">فروشگاه: {store.name}</p>
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

  return (
    <>
      <p className="mx-auto max-w-2xl px-4 pt-6 text-xs text-ink/50">
        فروشگاه: {store.name}
      </p>
      <MessageBox />
    </>
  );
}

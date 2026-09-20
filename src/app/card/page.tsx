import { redirect } from "next/navigation";
import { db, ensureSchema } from "@/lib/db";
import { getActiveStore } from "@/lib/auth";
import StoreCardForm from "@/components/StoreCardForm";
export const dynamic = "force-dynamic";

export default async function CardPage() {
  const store = await getActiveStore();
  if (!store) redirect("/login");

  await ensureSchema();
  const result = await db.execute({
    sql: "SELECT * FROM store_cards WHERE store_id = ?",
    args: [store.id],
  });
  const card = result.rows[0] as unknown as
    | (Record<string, string> & { locked: number })
    | undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold text-ink">کارت فروشگاه</h1>
      <p className="mb-1 text-xs text-ink/50">فروشگاه: {store.name}</p>
      <p className="mb-6 text-sm text-ink/60">
        این اطلاعات به‌عنوان زمینه برای تولید پیشنهاد پاسخ استفاده می‌شود و تا
        پایان پایلوت قابل تغییر نیست.
      </p>
      <StoreCardForm initialCard={card ?? null} locked={Boolean(card?.locked)} />
    </div>
  );
}

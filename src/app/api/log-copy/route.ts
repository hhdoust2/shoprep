import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getActiveStore } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const store = await getActiveStore();
  if (!store) {
    return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });
  }
  await ensureSchema();

  let body: { logId?: unknown; copiedText?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const logId = Number(body.logId);
  const copiedText = typeof body.copiedText === "string" ? body.copiedText : "";

  if (!logId || !copiedText) {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  // فقط رکوردهای همین فروشگاه قابل دسترسی‌اند.
  const result = await db.execute({
    sql: "SELECT suggestions FROM interaction_log WHERE id = ? AND store_id = ?",
    args: [logId, store.id],
  });
  const row = result.rows[0] as unknown as { suggestions: string } | undefined;

  if (!row) {
    return NextResponse.json({ error: "رکورد پیدا نشد." }, { status: 404 });
  }

  // مقایسه سمت سرور با متن اصلی پیشنهاد؛ به ادعای کلاینت برای «بدون ویرایش
  // بودن» اعتماد نمی‌کنیم چون این شاخص، معیار اصلی سنجش کیفیت پایلوت است.
  const originalSuggestions: string[] = JSON.parse(row.suggestions);
  const noEditFlag = originalSuggestions.includes(copiedText) ? 1 : 0;

  await db.execute({
    sql: "UPDATE interaction_log SET selected_reply = ?, no_edit_flag = ? WHERE id = ? AND store_id = ?",
    args: [copiedText, noEditFlag, logId, store.id],
  });

  return NextResponse.json({ ok: true, noEditFlag: Boolean(noEditFlag) });
}

import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getActiveStore } from "@/lib/auth";

const FIELDS = [
  "business_info",
  "products",
  "shipping_terms",
  "return_policy",
  "tone",
  "contact_info",
  "extra_notes",
] as const;

export async function GET() {
  const store = await getActiveStore();
  if (!store) {
    return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });
  }
  await ensureSchema();
  const result = await db.execute({
    sql: "SELECT * FROM store_cards WHERE store_id = ?",
    args: [store.id],
  });
  return NextResponse.json({ card: result.rows[0] ?? null });
}

export async function POST(request: NextRequest) {
  const store = await getActiveStore();
  if (!store) {
    return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });
  }
  await ensureSchema();

  const existingResult = await db.execute({
    sql: "SELECT locked FROM store_cards WHERE store_id = ?",
    args: [store.id],
  });
  const existing = existingResult.rows[0] as unknown as
    | { locked: number }
    | undefined;

  // هفت فیلد کارت تا پایان پایلوت قفل است: پس از اولین ذخیره، درخواست بعدی رد می‌شود.
  if (existing?.locked) {
    return NextResponse.json(
      { error: "کارت فروشگاه تا پایان پایلوت قفل است و قابل ویرایش نیست." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  for (const field of FIELDS) {
    const value = body[field];
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json(
        { error: `فیلد «${field}» الزامی است.` },
        { status: 400 }
      );
    }
  }

  await db.execute({
    sql: `
      INSERT INTO store_cards (
        store_id, business_info, products, shipping_terms, return_policy,
        tone, contact_info, extra_notes, locked, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now')
      )
      ON CONFLICT(store_id) DO UPDATE SET
        business_info = excluded.business_info,
        products = excluded.products,
        shipping_terms = excluded.shipping_terms,
        return_policy = excluded.return_policy,
        tone = excluded.tone,
        contact_info = excluded.contact_info,
        extra_notes = excluded.extra_notes,
        locked = 1,
        updated_at = datetime('now')
      WHERE store_cards.locked = 0
    `,
    args: [store.id, ...FIELDS.map((f) => body[f] as string)],
  });

  return NextResponse.json({ ok: true });
}

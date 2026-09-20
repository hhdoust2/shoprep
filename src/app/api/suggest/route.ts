import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getActiveStore } from "@/lib/auth";
import { checkDailyCap } from "@/lib/dailyLimit";
import { buildSystemPrompt, StoreCard } from "@/lib/prompt";
import { generateSuggestions } from "@/lib/modelClient";

// اجازه‌ی زمان بیشتر برای تلاش با مدل‌های جایگزین (سقف پلن رایگان Vercel).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const store = await getActiveStore();
  if (!store) {
    return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });
  }
  await ensureSchema();

  // بررسی سقف روزانه پیش از هرگونه تماس با مدل، برای کنترل هزینه
  const cap = await checkDailyCap(store.id);
  if (cap === "store") {
    return NextResponse.json(
      { error: "سقف پیام روزانه پر شده است. فردا دوباره تلاش کنید." },
      { status: 429 }
    );
  }
  if (cap === "total") {
    return NextResponse.json(
      { error: "ظرفیت روزانه‌ی کل سرویس پر شده است. فردا دوباره تلاش کنید." },
      { status: 429 }
    );
  }

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(
      { error: "متن پیام مشتری الزامی است." },
      { status: 400 }
    );
  }

  const cardResult = await db.execute({
    sql: "SELECT * FROM store_cards WHERE store_id = ?",
    args: [store.id],
  });
  const card = cardResult.rows[0] as unknown as StoreCard | undefined;

  if (!card) {
    return NextResponse.json(
      { error: "ابتدا باید کارت فروشگاه تکمیل شود." },
      { status: 400 }
    );
  }

  let suggestions: string[];
  try {
    const systemPrompt = buildSystemPrompt(card);
    suggestions = await generateSuggestions(systemPrompt, message);
  } catch (err) {
    console.error("model generation failed:", err);
    return NextResponse.json(
      { error: "تولید پیشنهاد با خطا مواجه شد. دوباره تلاش کنید." },
      { status: 502 }
    );
  }

  const insertResult = await db.execute({
    sql: "INSERT INTO interaction_log (store_id, customer_message, suggestions) VALUES (?, ?, ?)",
    args: [store.id, message, JSON.stringify(suggestions)],
  });

  return NextResponse.json({
    logId: Number(insertResult.lastInsertRowid),
    suggestions,
  });
}

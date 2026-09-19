import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { isDailyCapReached } from "@/lib/dailyLimit";
import { buildSystemPrompt, StoreCard } from "@/lib/prompt";
import { generateSuggestions } from "@/lib/modelClient";

export async function POST(request: NextRequest) {
  await ensureSchema();

  // بررسی سقف روزانه پیش از هرگونه تماس با مدل، برای کنترل هزینه
  if (await isDailyCapReached()) {
    return NextResponse.json(
      { error: "سقف پیام روزانه پر شده است. فردا دوباره تلاش کنید." },
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

  const cardResult = await db.execute("SELECT * FROM store_card WHERE id = 1");
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
    sql: "INSERT INTO interaction_log (customer_message, suggestions) VALUES (?, ?)",
    args: [message, JSON.stringify(suggestions)],
  });

  return NextResponse.json({
    logId: Number(insertResult.lastInsertRowid),
    suggestions,
  });
}

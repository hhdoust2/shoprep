// این ماژول فقط باید از کد سمت سرور (route handler ها) فراخوانی شود؛
// کلید API هرگز نباید به کامپوننت کلاینتی پاس داده شود.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function generateSuggestions(
  systemPrompt: string,
  customerMessage: string
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model =
    process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.1-8b-instruct:free";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY تنظیم نشده است.");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: customerMessage },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`خطا در تماس با مدل (${response.status}): ${text}`);
  }

  const data = await response.json();
  const rawContent: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = rawContent.replace(/```json|```/g, "").trim();

  let parsed: { suggestions?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("خروجی مدل قابل تجزیه به JSON نبود.");
  }

  if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
    throw new Error("مدل هیچ پیشنهادی برنگرداند.");
  }

  return (parsed.suggestions as unknown[])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 3);
}

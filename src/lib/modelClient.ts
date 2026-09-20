// این ماژول فقط باید از کد سمت سرور (route handler ها) فراخوانی شود؛
// کلید API هرگز نباید به کامپوننت کلاینتی پاس داده شود.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// مدل‌های رایگان گاهی کند یا ناپایدارند؛ هر تلاش سقف زمانی دارد و کل کار هم
// یک بودجه‌ی زمانی، تا درخواست از مهلت تابع سرورلس (maxDuration) بیرون نزند.
const ATTEMPT_TIMEOUT_MS = 20_000;
const TOTAL_BUDGET_MS = 50_000;

const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

type ModelError = Error & { fatal?: boolean };

function fatalError(message: string): ModelError {
  return Object.assign(new Error(message), { fatal: true });
}

// مدل اصلی از OPENROUTER_MODEL و مدل‌های جایگزین (به ترتیب، با ویرگول جدا شده)
// از OPENROUTER_FALLBACK_MODELS خوانده می‌شوند. اگر فقط یک مدل تنظیم شده باشد،
// همان یک بار دیگر امتحان می‌شود.
function getModelList(): string[] {
  const primary = (process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL).trim();
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((m) => m.trim());
  const unique = [primary, ...fallbacks].filter(
    (m, i, all) => m.length > 0 && all.indexOf(m) === i
  );
  return unique.length === 1 ? [unique[0], unique[0]] : unique;
}

// مدل‌های کوچک گاهی قبل یا بعد از JSON متن اضافه می‌نویسند؛ اول تجزیه‌ی مستقیم،
// و اگر نشد، بیرون کشیدن اولین بلوک {...}.
function parseSuggestions(rawContent: string): string[] {
  const cleaned = rawContent.replace(/```json|```/g, "").trim();

  let parsed: { suggestions?: unknown } | undefined;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        parsed = undefined;
      }
    }
  }

  if (!parsed) {
    throw new Error("خروجی مدل قابل تجزیه به JSON نبود.");
  }
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("مدل هیچ پیشنهادی برنگرداند.");
  }

  const suggestions = (parsed.suggestions as unknown[])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 3);

  if (suggestions.length === 0) {
    throw new Error("مدل هیچ پیشنهادی برنگرداند.");
  }
  return suggestions;
}

async function callModel(
  model: string,
  apiKey: string,
  systemPrompt: string,
  customerMessage: string
): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

  try {
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
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = (await response.text()).slice(0, 300);
      const message = `خطا در تماس با مدل (${response.status}): ${text}`;
      // کلید نامعتبر با عوض کردن مدل درست نمی‌شود؛ بی‌خود وقت نمی‌گیریم.
      throw response.status === 401 ? fatalError(message) : new Error(message);
    }

    const data = await response.json();
    const rawContent: string = data?.choices?.[0]?.message?.content ?? "";
    return parseSuggestions(rawContent);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`مدل در ${ATTEMPT_TIMEOUT_MS / 1000} ثانیه پاسخ نداد.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateSuggestions(
  systemPrompt: string,
  customerMessage: string
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY تنظیم نشده است.");
  }

  const models = getModelList();
  const startedAt = Date.now();
  let lastError: unknown;

  for (const model of models) {
    if (Date.now() - startedAt > TOTAL_BUDGET_MS) break;

    try {
      const suggestions = await callModel(
        model,
        apiKey,
        systemPrompt,
        customerMessage
      );
      if (model !== models[0]) {
        console.warn("[model] پاسخ از مدل جایگزین گرفته شد:", model);
      }
      return suggestions;
    } catch (err) {
      lastError = err;
      console.error(
        "[model] تلاش ناموفق برای",
        model,
        ":",
        err instanceof Error ? err.message : String(err)
      );
      if ((err as ModelError).fatal) break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("همه‌ی مدل‌ها ناموفق بودند.");
}

"use client";

import { useState } from "react";

interface Props {
  logId: number;
  suggestions: string[];
}

interface SuggestionState {
  text: string;
  copied: boolean;
  copying: boolean;
}

export default function SuggestionsPanel({ logId, suggestions }: Props) {
  const [items, setItems] = useState<SuggestionState[]>(
    suggestions.map((text) => ({ text, copied: false, copying: false }))
  );

  function updateText(index: number, text: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, text, copied: false } : item
      )
    );
  }

  async function handleCopy(index: number) {
    const item = items[index];

    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, copying: true } : it))
    );

    try {
      await navigator.clipboard.writeText(item.text);
    } catch {
      // اگر کلیپ‌بورد در دسترس نبود، ثبت آماری همچنان انجام می‌شود
    }

    try {
      await fetch("/api/log-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, copiedText: item.text }),
      });
    } catch {
      // خطای ثبت آماری نباید مانع کار فروشنده شود
    }

    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, copying: false, copied: true } : it
      )
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-line bg-white p-3">
          <textarea
            value={item.text}
            onChange={(e) => updateText(index, e.target.value)}
            rows={3}
            className="w-full resize-none border-0 bg-transparent p-0 text-sm text-ink focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => handleCopy(index)}
              disabled={item.copying}
              className="rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-dark hover:bg-accent/20 disabled:opacity-50"
            >
              {item.copying ? "در حال کپی..." : "کپی پاسخ"}
            </button>
            {item.copied && (
              <span className="text-xs text-accent-dark">کپی شد</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

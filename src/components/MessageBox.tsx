"use client";

import { useState, FormEvent } from "react";
import SuggestionsPanel from "./SuggestionsPanel";

interface SuggestResult {
  logId: number;
  suggestions: string[];
}

export default function MessageBox() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطای نامشخص");
      setResult({ logId: data.logId, suggestions: data.suggestions });
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold text-ink">
        پیشنهاد پاسخ به مشتری
      </h1>
      <p className="mb-6 text-sm text-ink/60">
        پیام مشتری را اینجا کپی کنید تا سه پیشنهاد پاسخ آماده دریافت کنید. هر
        سه پیشنهاد قابل ویرایش هستند.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="مثلاً: سلام، این کفش سایز ۴۰ داره؟"
          className="w-full rounded-lg border border-line bg-white p-3 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {loading ? "در حال تولید..." : "دریافت سه پیشنهاد"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-8">
          <SuggestionsPanel logId={result.logId} suggestions={result.suggestions} />
        </div>
      )}
    </div>
  );
}

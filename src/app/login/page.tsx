"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطای نامشخص");
      router.push(data.role === "admin" ? "/admin" : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-white p-3 text-sm text-ink focus:border-accent focus:outline-none";

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <img src="/logo.svg" alt="لوگو" className="mx-auto mb-4 h-10 w-10" />
      <h1 className="mb-6 text-center text-xl font-semibold text-ink">
        ورود به پنل
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="نام کاربری"
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          dir="ltr"
          className={inputClass}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="رمز عبور"
          autoComplete="current-password"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {loading ? "در حال ورود..." : "ورود"}
        </button>
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { StoreSummary } from "@/lib/stores";

interface Props {
  stores: StoreSummary[];
  dailyCap: number;
  totalCap: number | null;
  todayTotal: number;
}

interface Credentials {
  title: string;
  name: string;
  username: string;
  password: string;
  origin: string;
}

const fa = (value: number): string => value.toLocaleString("fa-IR");

function percent(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${(Math.round((1000 * part) / whole) / 10).toLocaleString("fa-IR")}٪`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    }).format(new Date(`${value.replace(" ", "T")}Z`));
  } catch {
    return value;
  }
}

// حروف و عددهایی که با هم اشتباه گرفته نمی‌شوند (بدون l و 1 و o و 0)
function randomPassword(length = 10): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => alphabet[v % alphabet.length]).join("");
}

async function send(
  url: string,
  method: "POST" | "PATCH",
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "خطای نامشخص" };
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد." };
  }
}

const inputClass =
  "w-full rounded-lg border border-line bg-white p-2 text-sm text-ink focus:border-accent focus:outline-none";
const smallButton =
  "rounded-md border border-line bg-white px-3 py-1 text-xs font-medium text-ink/70 hover:border-accent hover:text-accent disabled:opacity-50";

export default function AdminPanel({ stores, dailyCap, totalCap, todayTotal }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await send("/api/admin/stores", "POST", {
      name,
      username,
      password,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "خطای نامشخص");
      return;
    }
    setCredentials({
      title: "حساب جدید ساخته شد",
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password,
      origin: window.location.origin,
    });
    setCopied(false);
    setName("");
    setUsername("");
    setPassword("");
    router.refresh();
  }

  async function patch(store: StoreSummary, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await send(`/api/admin/stores/${store.id}`, "PATCH", payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "خطای نامشخص");
      return false;
    }
    router.refresh();
    return true;
  }

  async function resetPassword(store: StoreSummary) {
    if (!window.confirm(`رمز «${store.name}» عوض شود؟ رمز قبلی دیگر کار نمی‌کند.`)) return;
    const newPassword = randomPassword();
    const ok = await patch(store, { action: "set_password", password: newPassword });
    if (ok) {
      setCredentials({
        title: "رمز جدید ثبت شد",
        name: store.name,
        username: store.username,
        password: newPassword,
        origin: window.location.origin,
      });
      setCopied(false);
    }
  }

  async function toggleActive(store: StoreSummary) {
    if (
      store.isActive &&
      !window.confirm(`حساب «${store.name}» غیرفعال شود؟ فوراً از ورود بازمی‌ماند.`)
    ) {
      return;
    }
    await patch(store, { action: "set_active", active: !store.isActive });
  }

  async function unlockCard(store: StoreSummary) {
    if (
      !window.confirm(
        `قفل کارت «${store.name}» باز شود؟ فروشنده می‌تواند کارت را ویرایش و دوباره ذخیره کند.`
      )
    ) {
      return;
    }
    await patch(store, { action: "unlock_card" });
  }

  async function rename(store: StoreSummary) {
    const next = window.prompt("نام جدید فروشگاه", store.name);
    if (next && next.trim() && next.trim() !== store.name) {
      await patch(store, { action: "rename", name: next.trim() });
    }
  }

  async function copyCredentials() {
    if (!credentials) return;
    const text = `آدرس: ${credentials.origin}\nنام کاربری: ${credentials.username}\nرمز عبور: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold text-ink">مدیریت فروشگاه‌ها</h1>
      <p className="mb-6 text-sm text-ink/60">
        هر فروشگاه حساب، کارت و تاریخچه‌ی جدا دارد. امروز در کل {fa(todayTotal)}
        {totalCap ? ` از ${fa(totalCap)}` : ""} پیشنهاد گرفته شده؛ سقف هر فروشگاه{" "}
        {fa(dailyCap)} در روز است.
      </p>

      {credentials && (
        <div className="mb-6 rounded-lg border border-accent bg-accent-light p-4">
          <div className="mb-2 text-sm font-semibold text-ink">
            {credentials.title}: {credentials.name}
          </div>
          <div className="space-y-1 text-sm text-ink" dir="ltr">
            <div>{credentials.origin}</div>
            <div>username: {credentials.username}</div>
            <div>password: {credentials.password}</div>
          </div>
          <p className="mt-2 text-xs text-ink/60">
            این رمز فقط همین یک بار نمایش داده می‌شود. آن را برای فروشنده بفرست.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={copyCredentials} className={smallButton}>
              {copied ? "کپی شد" : "کپی اطلاعات ورود"}
            </button>
            <button type="button" onClick={() => setCredentials(null)} className={smallButton}>
              بستن
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-8 space-y-3 rounded-lg border border-line bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-ink">افزودن فروشگاه</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام فروشگاه"
          className={inputClass}
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="نام کاربری (انگلیسی، مثلاً shop2)"
          dir="ltr"
          autoCapitalize="none"
          className={inputClass}
        />
        <div className="flex gap-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رمز عبور (حداقل ۸ کاراکتر)"
            dir="ltr"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setPassword(randomPassword())}
            className={`${smallButton} whitespace-nowrap`}
          >
            رمز تصادفی
          </button>
        </div>
        <button
          type="submit"
          disabled={busy || !name.trim() || !username.trim() || !password}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
        >
          ساخت حساب
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {stores.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-ink/60">
          هنوز فروشگاهی ساخته نشده است.
        </p>
      ) : (
        <ul className="space-y-3">
          {stores.map((store) => (
            <li key={store.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{store.name}</span>
                <span className="text-xs text-ink/50" dir="ltr">
                  {store.username}
                </span>
                {!store.isActive && (
                  <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">
                    غیرفعال
                  </span>
                )}
                {!store.hasPassword && (
                  <span className="rounded bg-ochre-light px-2 py-0.5 text-xs text-ochre">
                    رمز ندارد
                  </span>
                )}
                <span className="rounded bg-accent-light px-2 py-0.5 text-xs text-accent-dark">
                  {store.cardLocked ? "کارت: قفل" : store.hasCard ? "کارت: باز" : "کارت: ثبت نشده"}
                </span>
              </div>

              <div className="mt-2 text-xs text-ink/60">
                امروز {fa(store.today)} از {fa(dailyCap)} · کل {fa(store.generated)} درخواست ·{" "}
                {fa(store.copied)} کپی · بدون ویرایش{" "}
                {percent(store.unedited, store.copied)} · آخرین استفاده{" "}
                {formatDateTime(store.lastUsed)}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resetPassword(store)}
                  className={smallButton}
                >
                  {store.hasPassword ? "رمز جدید" : "تعیین رمز"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleActive(store)}
                  className={smallButton}
                >
                  {store.isActive ? "غیرفعال کردن" : "فعال کردن"}
                </button>
                {store.cardLocked && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => unlockCard(store)}
                    className={smallButton}
                  >
                    باز کردن قفل کارت
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => rename(store)}
                  className={smallButton}
                >
                  تغییر نام
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const FIELD_DEFS: { key: string; label: string; placeholder: string }[] = [
  {
    key: "business_info",
    label: "اطلاعات پایه کسب‌وکار",
    placeholder: "نام فروشگاه، حوزه فعالیت، ساعات پاسخ‌گویی و ...",
  },
  {
    key: "products",
    label: "محصولات",
    placeholder: "فهرست یا دسته‌بندی محصولات و ویژگی‌های مهم آن‌ها",
  },
  {
    key: "shipping_terms",
    label: "شرایط ارسال",
    placeholder: "زمان و هزینه ارسال، شهرهای تحت پوشش و ...",
  },
  {
    key: "return_policy",
    label: "شرایط بازگشت کالا",
    placeholder: "مهلت بازگشت، شرایط سلامت کالا، هزینه بازگشت و ...",
  },
  {
    key: "tone",
    label: "لحن پاسخ",
    placeholder: "مثلاً: رسمی و مختصر / صمیمی و دوستانه",
  },
  {
    key: "contact_info",
    label: "اطلاعات تماس",
    placeholder: "شماره تماس، آیدی پشتیبانی، آدرس و ...",
  },
  {
    key: "extra_notes",
    label: "نکات تکمیلی",
    placeholder: "هر نکته دیگری که مدل باید در پاسخ‌ها رعایت کند",
  },
];

interface Props {
  initialCard: Record<string, string> | null;
  locked: boolean;
}

export default function StoreCardForm({ initialCard, locked }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    initialCard ?? Object.fromEntries(FIELD_DEFS.map((f) => [f.key, ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLocked, setIsLocked] = useState(locked);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطای نامشخص");
      setSaved(true);
      setIsLocked(true);
      // نسخه‌ی کش‌شده‌ی صفحه‌ی اصلی («پیشنهاد پاسخ») را باطل می‌کند تا با
      // کلیک روی تب، وضعیت تازه‌ی کارت (نه حالت قبل از ذخیره) نشان داده شود.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isLocked && (
        <p className="rounded-md bg-ochre-light p-3 text-sm text-ochre">
          کارت فروشگاه تکمیل و قفل شده و تا پایان پایلوت قابل ویرایش نیست.
        </p>
      )}

      {FIELD_DEFS.map((field) => (
        <div key={field.key}>
          <label className="mb-1 block text-sm font-medium text-ink">
            {field.label}
          </label>
          <textarea
            className="w-full rounded-lg border border-line bg-white p-2 text-sm text-ink focus:border-accent focus:outline-none disabled:bg-paper disabled:text-ink/50"
            rows={3}
            disabled={isLocked}
            placeholder={field.placeholder}
            value={values[field.key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
          />
        </div>
      ))}

      {!isLocked && (
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : "ذخیره و قفل کردن کارت فروشگاه"}
        </button>
      )}

      {saved && (
        <p className="text-sm text-accent-dark">
          با موفقیت ذخیره شد. از این پس این کارت تا پایان پایلوت قفل است.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

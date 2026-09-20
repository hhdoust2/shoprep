import { unstable_noStore as noStore } from "next/cache";
import { db, ensureSchema } from "@/lib/db";
import { getDailyCap, getTodayCount } from "@/lib/dailyLimit";

// آمار باید همیشه تازه از دیتابیس خوانده شود و هرگز موقع build ساخته نشود.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Totals {
  generated: number | string | null;
  copied: number | string | null;
  unedited: number | string | null;
}

interface DayRow extends Totals {
  day: string;
}

const toNumber = (value: number | string | null | undefined): number =>
  Number(value ?? 0);

const fa = (value: number): string => value.toLocaleString("fa-IR");

function percent(part: number, whole: number): string {
  if (whole === 0) return "—";
  const value = Math.round((1000 * part) / whole) / 10;
  return `${value.toLocaleString("fa-IR")}٪`;
}

function formatDay(day: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${day}T00:00:00Z`));
  } catch {
    return day;
  }
}

function StatCard({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg border border-accent bg-accent-light p-4"
          : "rounded-lg border border-line bg-white p-4"
      }
    >
      <div className="text-xs text-ink/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-ink/50">{hint}</div> : null}
    </div>
  );
}

export default async function StatsPage() {
  noStore();
  await ensureSchema();

  const totalsResult = await db.execute(
    `SELECT
       COUNT(*) AS generated,
       SUM(CASE WHEN selected_reply IS NOT NULL THEN 1 ELSE 0 END) AS copied,
       SUM(no_edit_flag) AS unedited
     FROM interaction_log`
  );
  const totalsRow = totalsResult.rows[0] as unknown as Totals | undefined;
  const generated = toNumber(totalsRow?.generated);
  const copied = toNumber(totalsRow?.copied);
  const unedited = toNumber(totalsRow?.unedited);

  const daysResult = await db.execute(
    `SELECT
       date(created_at) AS day,
       COUNT(*) AS generated,
       SUM(CASE WHEN selected_reply IS NOT NULL THEN 1 ELSE 0 END) AS copied,
       SUM(no_edit_flag) AS unedited
     FROM interaction_log
     GROUP BY date(created_at)
     ORDER BY day DESC
     LIMIT 14`
  );
  const days = daysResult.rows as unknown as DayRow[];

  const todayCount = await getTodayCount();
  const cap = getDailyCap();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold text-ink">نتایج پایلوت</h1>
      <p className="mb-6 text-sm text-ink/60">
        شاخص اصلی، درصد پاسخ‌هایی است که فروشنده دقیقاً همان‌طور که مدل نوشته
        کپی کرده و ویرایش نکرده است.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <StatCard
          label="پاسخ بدون ویرایش"
          value={percent(unedited, copied)}
          hint={`${fa(unedited)} از ${fa(copied)} پاسخ کپی‌شده`}
          highlight
        />
        <StatCard
          label="امروز"
          value={`${fa(todayCount)} از ${fa(cap)}`}
          hint="پیام‌های دریافت‌شده در سقف روزانه"
        />
        <StatCard
          label="کل درخواست‌های پیشنهاد"
          value={fa(generated)}
        />
        <StatCard
          label="پاسخ کپی‌شده"
          value={fa(copied)}
          hint={`${percent(copied, generated)} از درخواست‌ها`}
        />
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-ink">
        ۱۴ روز اخیر
      </h2>
      {days.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-ink/60">
          هنوز هیچ درخواستی ثبت نشده است.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink/60">
                <th className="px-3 py-2 text-start font-medium">روز</th>
                <th className="px-3 py-2 text-start font-medium">درخواست</th>
                <th className="px-3 py-2 text-start font-medium">کپی‌شده</th>
                <th className="px-3 py-2 text-start font-medium">بدون ویرایش</th>
                <th className="px-3 py-2 text-start font-medium">درصد</th>
              </tr>
            </thead>
            <tbody>
              {days.map((row) => {
                const dayCopied = toNumber(row.copied);
                const dayUnedited = toNumber(row.unedited);
                return (
                  <tr key={row.day} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{formatDay(row.day)}</td>
                    <td className="px-3 py-2">{fa(toNumber(row.generated))}</td>
                    <td className="px-3 py-2">{fa(dayCopied)}</td>
                    <td className="px-3 py-2">{fa(dayUnedited)}</td>
                    <td className="px-3 py-2">{percent(dayUnedited, dayCopied)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-ink/50">
        روزها به وقت UTC حساب می‌شوند، یعنی هر روز ساعت ۳:۳۰ بامداد به وقت
        تهران شروع می‌شود؛ سقف روزانه هم با همین مرز صفر می‌شود. پاسخ‌هایی که
        فروشنده با دکمه‌ی کپی خود پنل برنداشته باشد، شمرده نمی‌شود.
      </p>
    </div>
  );
}

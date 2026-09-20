import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getSession } from "@/lib/session";
import { getDailyCap, getTodayCount, getTotalCap } from "@/lib/dailyLimit";
import { listStoresWithStats } from "@/lib/stores";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  noStore();
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const stores = await listStoresWithStats();
  const todayTotal = await getTodayCount();

  return (
    <AdminPanel
      stores={stores}
      dailyCap={getDailyCap()}
      totalCap={getTotalCap()}
      todayTotal={todayTotal}
    />
  );
}

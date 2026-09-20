"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Role = "admin" | "store" | null;

const STORE_LINKS = [
  { href: "/", label: "پیشنهاد پاسخ" },
  { href: "/card", label: "کارت فروشگاه" },
  { href: "/stats", label: "نتایج" },
];

const ADMIN_LINKS = [{ href: "/admin", label: "مدیریت فروشگاه‌ها" }];

// کوکی نقش فقط برای انتخاب منوی درست است؛ دسترسی واقعی سمت سرور بررسی می‌شود.
function readRole(): Role {
  const entry = document.cookie
    .split("; ")
    .find((item) => item.startsWith("panel_role="));
  const value = entry?.split("=")[1];
  return value === "admin" || value === "store" ? value : null;
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    setRole(readRole());
  }, [pathname]);

  if (pathname === "/login") return null;

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      setRole(null);
      router.push("/login");
      router.refresh();
    }
  }

  const links = role === "admin" ? ADMIN_LINKS : role === "store" ? STORE_LINKS : [];

  return (
    <header className="border-b border-line bg-white px-4 py-3">
      <nav className="mx-auto flex max-w-4xl items-center gap-6 text-sm">
        <img src="/logo.svg" alt="لوگو" className="h-6 w-6" />
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              pathname === link.href
                ? "font-medium text-accent"
                : "font-medium text-ink/60 hover:text-accent"
            }
          >
            {link.label}
          </Link>
        ))}
        {role && (
          <button
            type="button"
            onClick={logout}
            className="ms-auto font-medium text-ink/60 hover:text-accent"
          >
            خروج
          </button>
        )}
      </nav>
    </header>
  );
}

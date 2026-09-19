"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "پیشنهاد پاسخ" },
  { href: "/card", label: "کارت فروشگاه" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="border-b border-line bg-white px-4 py-3">
      <nav className="mx-auto flex max-w-4xl items-center gap-6 text-sm">
        <img src="/logo.svg" alt="لوگو" className="h-6 w-6" />
        {LINKS.map((link) => (
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
      </nav>
    </header>
  );
}

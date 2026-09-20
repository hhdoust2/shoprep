import { cookies } from "next/headers";

const COOKIE_NAME = "panel_session";
// کوکی نقش فقط برای نمایش منوی درست در رابط کاربری است (قابل خواندن توسط مرورگر)؛
// هیچ دسترسی‌ای به آن وابسته نیست و اعتبارسنجی همیشه با کوکی امضاشده‌ی اصلی انجام می‌شود.
const ROLE_COOKIE_NAME = "panel_role";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // ۱۲ ساعت

export type Session = { role: "admin" } | { role: "store"; storeId: number };

// از Web Crypto (crypto.subtle) استفاده می‌کنیم چون هم در Node.js (روت‌های api)
// و هم در Edge Runtime (middleware) به‌صورت یکسان در دسترس است؛ اگر از ماژول
// Node "crypto" استفاده می‌کردیم، میدل‌ور (که روی Edge اجرا می‌شود) کار نمی‌کرد.

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET در متغیرهای محیطی تنظیم نشده است.");
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(bytes.map((b) => parseInt(b, 16)));
}

function markerFor(session: Session): string {
  return session.role === "admin" ? "admin" : `store-${session.storeId}`;
}

function sessionFromMarker(marker: string): Session | null {
  if (marker === "admin") return { role: "admin" };
  const match = /^store-(\d+)$/.exec(marker);
  if (!match) return null;
  const storeId = Number(match[1]);
  return Number.isSafeInteger(storeId) && storeId > 0
    ? { role: "store", storeId }
    : null;
}

export async function createSessionValue(session: Session): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${markerFor(session)}.${expires}`;
  const key = await getKey();
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${toHex(signature)}`;
}

export async function verifySession(
  value: string | undefined | null
): Promise<Session | null> {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [marker, expiresStr, signatureHex] = parts;

  const session = sessionFromMarker(marker);
  if (!session) return null;

  try {
    const key = await getKey();
    const enc = new TextEncoder();
    const payload = `${marker}.${expiresStr}`;
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromHex(signatureHex) as BufferSource,
      enc.encode(payload)
    );
    if (!valid) return null;
  } catch {
    return null;
  }

  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Date.now() > expires) return null;

  return session;
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

// فقط در route handler ها و server component ها (نه middleware) استفاده شود.
export async function getSession(): Promise<Session | null> {
  return verifySession(cookies().get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(session: Session): Promise<void> {
  const value = await createSessionValue(session);
  const secure = process.env.NODE_ENV === "production";
  const maxAge = SESSION_TTL_MS / 1000;
  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  cookies().set(ROLE_COOKIE_NAME, session.role, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  cookies().set(ROLE_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

import { cookies } from "next/headers";

const COOKIE_NAME = "panel_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // ۱۲ ساعت

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

export async function createSessionValue(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `ok.${expires}`;
  const key = await getKey();
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${toHex(signature)}`;
}

export async function verifySessionValue(
  value: string | undefined | null
): Promise<boolean> {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [marker, expiresStr, signatureHex] = parts;

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
    if (!valid) return false;
  } catch {
    return false;
  }

  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Date.now() > expires) return false;

  return marker === "ok";
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

export async function setSessionCookie(): Promise<void> {
  const value = await createSessionValue();
  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

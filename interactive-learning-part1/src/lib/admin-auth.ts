import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("Set ADMIN_SESSION_SECRET (16+ characters) in your environment.");
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  return safeEqual(sign(input), sign(pw));
}

export async function startSession() {
  const expires = String(Date.now() + MAX_AGE * 1000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return false;
    const [expires, sig] = raw.split(".");
    if (!expires || !sig || !safeEqual(sig, sign(expires))) return false;
    return Number(expires) > Date.now();
  } catch {
    return false;
  }
}

/** Call at the top of every admin page, server action and API route. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE_NAME = "ses_session";
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function sign(value: string): string {
  const sig = crypto.createHmac("sha256", SECRET).update(value).digest("hex");
  return `${value}.${sig}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(value).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return value;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7日
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const userId = unsign(raw);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** ログイン必須ページで使用。未ログインなら null を返すので呼び出し側で redirect */
export async function requireUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

/** スタッフ（管理者/営業/経理）専用ページのガード。エンジニアはマイページへ送る */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "SALES" && user.role !== "ACCOUNTING") {
    redirect("/mypage");
  }
  return user;
}

/** 現在ログイン中ユーザーに紐づく技術者レコードを取得（エンジニア本人ポータル用） */
export async function getCurrentEngineerId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const userId = unsign(raw);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.engineerId ?? null;
}

/**
 * Internal console — support/operations workspace.
 * Authenticated support users land here; customers are redirected (middleware + here).
 */
import { redirect } from "next/navigation";
import postgres from "postgres";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";
import { usersRepo } from "@/lib/data/repositories/usersRepo";
import { ConsoleApp } from "@/components/internal/ConsoleApp";

export const metadata: Metadata = {
  title: "Operations Console — ParcelPilot",
};

export default async function InternalPage() {
  const token = await getSessionTokenFromCookieStore();
  if (!token) redirect("/login");

  const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
  let ctx;
  let userLabel: string | null = null;
  try {
    ctx = await resolveSession(sql as unknown as Parameters<typeof resolveSession>[0], token);
    if (ctx) userLabel = (await usersRepo.getOwn(ctx))?.loginId ?? null;
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (!ctx) redirect("/login");
  if (ctx.category !== "support") redirect("/unauthorized");

  return (
    <ConsoleApp
      identity={{ name: userLabel ?? "Support", role: ctx.role }}
      isManager={ctx.role === "ops_manager"}
    />
  );
}

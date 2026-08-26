/**
 * Root page — customer-facing support home.
 * Authenticated customers land here; support users go to /internal.
 * No-auth → /login (handled by middleware).
 */
import { redirect } from "next/navigation";
import postgres from "postgres";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";
import { usersRepo } from "@/lib/data/repositories/usersRepo";
import { accountsRepo } from "@/lib/data/repositories/accountsRepo";
import { CustomerHome } from "@/components/customer/CustomerHome";

export default async function RootPage() {
  const token = await getSessionTokenFromCookieStore();
  if (!token) redirect("/login");

  const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
  let ctx;
  let userLabel: string | null = null;
  let accountName: string | null = null;
  try {
    ctx = await resolveSession(sql as unknown as Parameters<typeof resolveSession>[0], token);
    if (ctx) {
      const [user, account] = await Promise.all([
        usersRepo.getOwn(ctx),
        ctx.accountId ? accountsRepo.getById(ctx, ctx.accountId) : Promise.resolve(null),
      ]);
      userLabel = user?.loginId ?? null;
      accountName = account?.displayName ?? null;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (!ctx) redirect("/login");
  if (ctx.category === "support") redirect("/internal");

  return (
    <CustomerHome
      identity={{ name: userLabel ?? "Customer", role: ctx.role }}
      accountName={accountName}
    />
  );
}

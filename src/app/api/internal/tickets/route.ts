import { NextResponse } from "next/server";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";
import postgres from "postgres";
import { config } from "@/lib/config";
import { ticketsRepo } from "@/lib/data/repositories/ticketsRepo";

export async function GET() {
  const token = await getSessionTokenFromCookieStore();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
  try {
    const ctx = await resolveSession(sql as unknown as Parameters<typeof resolveSession>[0], token);
    if (!ctx || ctx.category !== "support") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tickets = await ticketsRepo.listAll(ctx);
    return NextResponse.json({ tickets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

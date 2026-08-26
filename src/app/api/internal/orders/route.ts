/**
 * GET /api/internal/orders — active order board for the support console.
 * Requires support category. RLS scopes rows; ops see all accounts.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/data/client";
import { requireSession } from "@/lib/auth/session";
import { ordersRepo } from "@/lib/data/repositories/ordersRepo";

export async function GET(req: NextRequest) {
  const db = getDb();

  const ctxResult = await requireSession(req, db);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  if (ctx.category !== "support") {
    return NextResponse.json({ error: "Unauthorized. Requires support role." }, { status: 403 });
  }

  try {
    const orders = await ordersRepo.listAllDetailed(ctx);
    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/data/client";
import { requireSession } from "@/lib/auth/session";
import { pendingActionsRepo } from "@/lib/data/repositories/pendingActionsRepo";

export async function GET(req: NextRequest) {
  const db = getDb();
  
  const ctxResult = await requireSession(req, db);
  if (ctxResult instanceof NextResponse) return ctxResult; 
  const ctx = ctxResult;

  if (ctx.role !== 'ops_manager') {
    return NextResponse.json({ error: "Unauthorized. Requires ops_manager." }, { status: 403 });
  }

  try {
    const actions = await pendingActionsRepo.listForOps(ctx);
    return NextResponse.json({ actions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

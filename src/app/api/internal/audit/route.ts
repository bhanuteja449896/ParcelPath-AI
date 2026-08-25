import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/data/client";
import { requireSession } from "@/lib/auth/session";
import { auditRepo } from "@/lib/data/repositories/auditRepo";

export async function GET(req: NextRequest) {
  const db = getDb();
  
  const ctxResult = await requireSession(req, db);
  if (ctxResult instanceof NextResponse) return ctxResult; 
  const ctx = ctxResult;

  if (ctx.role !== 'ops_manager') {
    return NextResponse.json({ error: "Unauthorized. Requires ops_manager." }, { status: 403 });
  }

  try {
    const logs = await auditRepo.listForOps(ctx, 100);
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

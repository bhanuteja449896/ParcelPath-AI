import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/data/client";
import { requireSession } from "@/lib/auth/session";
import { issuesRepo } from "@/lib/data/repositories/issuesRepo";

export async function GET(req: NextRequest) {
  const db = getDb();
  
  const ctxResult = await requireSession(req, db);
  if (ctxResult instanceof NextResponse) return ctxResult; 
  const ctx = ctxResult;

  if (ctx.category !== 'support') {
    return NextResponse.json({ error: "Unauthorized. Requires support role." }, { status: 403 });
  }

  try {
    const findings = await issuesRepo.getFindings(ctx);
    return NextResponse.json({ findings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

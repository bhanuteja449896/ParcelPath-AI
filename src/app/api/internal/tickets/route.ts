/**
 * GET /api/internal/tickets — ticket workload for the support console.
 * Requires support category. RLS scopes rows; ops see all accounts.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/data/client";
import { requireSession } from "@/lib/auth/session";
import { withUserContext } from "@/lib/data/withUserContext";
import { ticketsRepo } from "@/lib/data/repositories/ticketsRepo";
import { extractReferenceTime } from "@/lib/data/referenceTime";

export async function GET(req: NextRequest) {
  const db = getDb();

  const ctxResult = await requireSession(req, db);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  if (ctx.category !== "support") {
    return NextResponse.json({ error: "Unauthorized. Requires support role." }, { status: 403 });
  }

  try {
    // Reference time anchors all SLA math (D8) — clients must NOT use wall-clock time
    const refRows = await withUserContext(ctx, async (tx) => {
      return tx<{ value: unknown }[]>`
        SELECT value FROM system_metadata WHERE key = 'reference_time'
      `;
    });
    const referenceTime = (
      refRows.length > 0 ? extractReferenceTime(refRows[0].value) : new Date()
    ).toISOString();

    const tickets = await ticketsRepo.listAllDetailed(ctx);
    return NextResponse.json({ tickets, referenceTime });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

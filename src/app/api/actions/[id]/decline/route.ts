import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/data/client";
import { requireSession } from "@/lib/auth/session";
import { withUserContext } from "@/lib/data/withUserContext";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  
  // 1 & 2. Validate session & resolve current user
  const ctxResult = await requireSession(req, db);
  if (ctxResult instanceof NextResponse) return ctxResult; // 401
  const ctx = ctxResult;

  const { id } = await params;

  try {
    // We execute the decline in one transaction using the context
    await withUserContext(ctx, async (tx) => {
      // Load pending action
      const rows = await tx`
        SELECT status, user_id FROM pending_actions WHERE id = ${id}
      `;
      if (rows.length === 0) {
        throw new Error("Action not found");
      }
      const action = rows[0];

      // Re-verify status idempotently
      if (action.status !== 'awaiting_confirmation') {
        throw new Error("Action is no longer awaiting confirmation.");
      }
      
      // Update action to cancelled
      await tx`
        UPDATE pending_actions 
        SET status = 'cancelled', executed_by = ${ctx.userId} 
        WHERE id = ${id}
      `;
      
      // Audit log
      await tx`
        INSERT INTO audit_log (
          actor_id, actor_category, actor_role, action, resource_type, pending_action_id, outcome, metadata
        ) VALUES (
          ${ctx.userId}, ${ctx.category}, ${ctx.role}, 'decline_action', 'pending_action', ${id}, 'success', '{}'::jsonb
        )
      `;
    });

    return NextResponse.json({ success: true, message: "Action declined and cancelled successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

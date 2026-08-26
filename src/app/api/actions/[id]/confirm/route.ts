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
    // Execute all steps inside one transaction
    const resultMsg = await withUserContext(ctx, async (tx) => {
      // 3. Load pending action
      const rows = await tx`
        SELECT * FROM pending_actions WHERE id = ${id}
      `;
      if (rows.length === 0) {
        throw new Error("Action not found");
      }
      const action = rows[0];

      // Verify ownership or ops_manager role
      if (action.user_id !== ctx.userId && ctx.role !== 'ops_manager') {
        throw new Error("Permission denied to confirm this action.");
      }

      // 4. Verify status
      if (action.status === 'executed') return "Action already executed.";
      if (action.status === 'cancelled') return "Action already cancelled.";
      if (action.status !== 'awaiting_confirmation') {
        throw new Error(`Action status is ${action.status}`);
      }
      
      // 5. Verify expiry
      const now = new Date();
      if (new Date(action.expires_at) < now) {
        await tx`UPDATE pending_actions SET status = 'expired' WHERE id = ${id}`;
        throw new Error("Action has expired. Please request a new draft.");
      }

      // 6. Semantic validators & Re-check resource
      const payload = action.payload as Record<string, any>;
      const outcomeData: any = {};
      
      if (action.action_type === 'cancel_order') {
        const orderRows = await tx`SELECT status FROM orders WHERE order_id = ${payload.orderId} AND account_id = ${action.target_account_id}`;
        if (orderRows.length === 0) throw new Error("Order not found in scope.");
        if (orderRows[0].status === 'cancelled') throw new Error("Order is already cancelled.");
        
        // 9. Execute mutation
        await tx`UPDATE orders SET status = 'cancelled', cancelled_at = now() WHERE order_id = ${payload.orderId} AND account_id = ${action.target_account_id}`;
        
        // 10. Audit log
        await tx`
          INSERT INTO audit_log (actor_user_id, actor_category, actor_role, account_id, action, resource_type, resource_id, old_state, new_state, pending_action_id, outcome, metadata)
          VALUES (${ctx.userId}, ${ctx.category}, ${ctx.role}, ${action.target_account_id}, 'cancel_order', 'order', ${payload.orderId}, ${tx.json({status: orderRows[0].status})}, ${tx.json({status: 'cancelled'})}, ${id}, 'success', '{}'::jsonb)
        `;
        outcomeData.message = `Order ${payload.orderId} cancelled successfully.`;
      } 
      else if (action.action_type === 'update_ticket') {
        const ticketRows = await tx`SELECT status, priority FROM tickets WHERE ticket_id = ${payload.ticketId} AND account_id = ${action.target_account_id}`;
        if (ticketRows.length === 0) throw new Error("Ticket not found in scope.");
        
        const updates: Record<string, any> = {};
        if (payload.status) updates.status = payload.status;
        if (payload.priority) updates.priority = payload.priority;
        
        if (Object.keys(updates).length > 0) {
          // Dynamic update is tricky with tagged templates, so we do it safely:
         if (payload.status && payload.priority) {
             await tx`UPDATE tickets SET status = ${payload.status}, priority = ${payload.priority} WHERE ticket_id = ${payload.ticketId} AND account_id = ${action.target_account_id}`;
           } else if (payload.status) {
             await tx`UPDATE tickets SET status = ${payload.status} WHERE ticket_id = ${payload.ticketId} AND account_id = ${action.target_account_id}`;
           } else if (payload.priority) {
             await tx`UPDATE tickets SET priority = ${payload.priority} WHERE ticket_id = ${payload.ticketId} AND account_id = ${action.target_account_id}`;
           }
        }
        
        // 10. Audit log
        await tx`
          INSERT INTO audit_log (actor_user_id, actor_category, actor_role, account_id, action, resource_type, resource_id, old_state, new_state, pending_action_id, outcome, metadata)
          VALUES (${ctx.userId}, ${ctx.category}, ${ctx.role}, ${action.target_account_id}, 'update_ticket', 'ticket', ${payload.ticketId}, ${tx.json(ticketRows[0])}, ${tx.json(updates)}, ${id}, 'success', '{}'::jsonb)
        `;
        outcomeData.message = `Ticket ${payload.ticketId} updated successfully.`;
      }
      else if (action.action_type === 'create_escalation') {
        const ticketRows = await tx`SELECT status FROM tickets WHERE ticket_id = ${payload.ticketId} AND account_id = ${action.target_account_id}`;
        if (ticketRows.length === 0) throw new Error("Ticket not found in scope.");
        
        await tx`UPDATE tickets SET status = 'escalated' WHERE ticket_id = ${payload.ticketId} AND account_id = ${action.target_account_id}`;
        
        await tx`
          INSERT INTO audit_log (actor_user_id, actor_category, actor_role, account_id, action, resource_type, resource_id, old_state, new_state, pending_action_id, outcome, metadata)
          VALUES (${ctx.userId}, ${ctx.category}, ${ctx.role}, ${action.target_account_id}, 'create_escalation', 'ticket', ${payload.ticketId}, ${tx.json({status: ticketRows[0].status})}, ${tx.json({status: 'escalated'})}, ${id}, 'success', '{}'::jsonb)
        `;
        outcomeData.message = `Ticket ${payload.ticketId} escalated.`;
      }
      else {
        throw new Error(`Unsupported action type: ${action.action_type}`);
      }

      // 11. Mark pending action executed
      await tx`
        UPDATE pending_actions 
        SET status = 'executed', executed_at = now(), executed_by = ${ctx.userId}, result = ${tx.json(outcomeData)} 
        WHERE id = ${id}
      `;
      
      return outcomeData.message;
    });

    return NextResponse.json({ success: true, message: resultMsg });
  } catch (error: any) {
    // If it fails, log to audit_log outside the transaction if possible?
    // According to specs, failed actions are audited. But if the transaction threw, we might need a separate connection to log the failure.
    // We will do a separate insert for the failure log.
    try {
       await db`
          INSERT INTO audit_log (actor_user_id, actor_category, actor_role, account_id, action, resource_type, pending_action_id, outcome, metadata)
          VALUES (${ctx.userId}, ${ctx.category}, ${ctx.role}, ${ctx.accountId}, 'confirm_action_failed', 'pending_action', ${id}, 'failed', ${db.json({error: error.message})})
       `;
    } catch (e) {
       // Ignore secondary audit failure
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

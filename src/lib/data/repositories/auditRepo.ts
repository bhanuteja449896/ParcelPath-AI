import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";
import { TransactionSql } from "postgres";

export interface AuditEvent {
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  oldState?: any;
  newState?: any;
  pendingActionId?: string | null;
  outcome: 'success' | 'rejected' | 'failed';
  metadata?: any;
}

export const auditRepo = {
  /**
   * Inserts an audit log entry.
   * Note: This usually runs inside an existing transaction, so we accept 
   * an optional tx parameter. If not provided, it creates a new transaction.
   */
  async insert(ctx: AgentContext, event: AuditEvent, existingTx?: TransactionSql): Promise<void> {
    const doInsert = async (tx: TransactionSql) => {
      await tx`
        INSERT INTO audit_log (
          actor_user_id, actor_category, actor_role, account_id,
          action, resource_type, resource_id, old_state, new_state,
          pending_action_id, outcome, metadata
        ) VALUES (
          ${ctx.userId},
          ${ctx.category},
          ${ctx.role},
          ${ctx.accountId ?? null},
          ${event.action},
          ${event.resourceType ?? null},
          ${event.resourceId ?? null},
          ${event.oldState ? tx.json(event.oldState) : null},
          ${event.newState ? tx.json(event.newState) : null},
          ${event.pendingActionId ?? null},
          ${event.outcome},
          ${event.metadata ? tx.json(event.metadata) : tx.json({})}
        )
      `;
    };

    if (existingTx) {
      await doInsert(existingTx);
    } else {
      await withUserContext(ctx, doInsert);
    }
  },

  /**
   * Lists audit logs. 
   * RLS automatically restricts this to ops_manager role.
   */
  async listForOps(ctx: AgentContext, limit: number = 50, offset: number = 0): Promise<any[]> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT 
          id,
          occurred_at AS "occurredAt",
          actor_user_id AS "actorUserId",
          actor_category AS "actorCategory",
          actor_role AS "actorRole",
          account_id AS "accountId",
          action,
          resource_type AS "resourceType",
          resource_id AS "resourceId",
          old_state AS "oldState",
          new_state AS "newState",
          pending_action_id AS "pendingActionId",
          outcome,
          metadata
        FROM audit_log
        ORDER BY occurred_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows;
    });
  }
};

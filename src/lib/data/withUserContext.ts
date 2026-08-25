import type { Sql, TransactionSql } from "postgres";
import { getDb } from "./client";
import { AgentContext } from "@/lib/types";

/**
 * Wraps a database operation in a transaction, injecting the user identity
 * into PostgreSQL session variables (GUCs). This activates Row Level Security (RLS)
 * for the duration of the transaction.
 * 
 * Any errors thrown in the callback will automatically rollback the transaction.
 * 
 * @param ctx The authenticated AgentContext
 * @param fn The database operations to perform
 * @returns The result of the callback
 */
export async function withUserContext<T>(
  ctx: AgentContext,
  fn: (tx: TransactionSql) => Promise<T>,
  client?: Sql
): Promise<T> {
  const db = client ?? getDb();

  return await db.begin(async (tx) => {
    // Inject context into postgres session config (is_local = true means scoped to this transaction).
    // Coalescing to empty string for null accountId as set_config expects text.
    await tx`
      SELECT set_config('app.user_id', ${ctx.userId}, true),
             set_config('app.category', ${ctx.category}, true),
             set_config('app.role', ${ctx.role}, true),
             set_config('app.account_id', ${ctx.accountId ?? ""}, true)
    `;
    
    return await fn(tx);
  });
}

import crypto from "node:crypto";
import { getDb } from "../client";
import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export interface SessionInfo extends AgentContext {
  sessionId: string;
  expiresAt: Date;
}

export const sessionsRepo = {
  /**
   * Hashes the raw session token.
   */
  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  },

  /**
   * Creates a new session (bypasses RLS via SECURITY DEFINER as it's pre-auth).
   */
  async createSession(
    userId: string,
    token: string,
    expiresAt: Date,
    absoluteExpiresAt: Date,
    ip?: string,
    userAgent?: string
  ): Promise<string> {
    const db = getDb();
    const tokenHash = this.hashToken(token);
    
    const rows = await db<{ app_create_session: string }[]>`
      SELECT app_create_session(
        ${userId}::uuid, 
        ${tokenHash}::text, 
        ${expiresAt}::timestamptz, 
        ${absoluteExpiresAt}::timestamptz, 
        ${ip ?? null}::inet, 
        ${userAgent ?? null}::text
      )
    `;
    return rows[0]!.app_create_session;
  },

  /**
   * Looks up a session by token and returns full context (bypasses RLS via SECURITY DEFINER).
   */
  async findSessionByToken(token: string): Promise<SessionInfo | null> {
    const db = getDb();
    const tokenHash = this.hashToken(token);
    
    const rows = await db<any[]>`
      SELECT 
        session_id AS "sessionId",
        user_id AS "userId",
        expires_at AS "expiresAt",
        category,
        role,
        account_id AS "accountId",
        is_active AS "isActive"
      FROM app_lookup_session(${tokenHash})
    `;
    
    if (rows.length === 0) return null;
    return rows[0] as SessionInfo;
  },

  /**
   * Revokes a session by marking revoked_at.
   * Requires a valid AgentContext to ensure users can only revoke their own sessions (or ops).
   */
  async revokeSession(ctx: AgentContext, token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await withUserContext(ctx, async (tx) => {
      await tx`
        UPDATE sessions 
        SET revoked_at = now() 
        WHERE token_hash = ${tokenHash} 
          AND revoked_at IS NULL
      `;
    });
  },

  /**
   * Opportunistically deletes old/expired sessions using SECURITY DEFINER.
   */
  async purgeExpired(): Promise<void> {
    const db = getDb();
    await db`SELECT app_purge_expired_sessions()`;
  }
};

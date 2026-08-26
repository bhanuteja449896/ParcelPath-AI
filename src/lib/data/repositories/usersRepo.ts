import { getDb } from "../client";
import { AgentContext } from "@/lib/types";
import { PreAuthUser } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export const usersRepo = {
  /**
   * Pre-auth lookup using SECURITY DEFINER function to bypass RLS.
   * Only returns minimal properties needed for password verification.
   */
  async findByLoginId(loginId: string): Promise<PreAuthUser | null> {
    const db = getDb();
    
    // Call the SECURITY DEFINER function
    const rows = await db<PreAuthUser[]>`
      SELECT 
        id, 
        password_hash AS "passwordHash", 
        is_active AS "isActive", 
        failed_login_count AS "failedLoginCount", 
        locked_until AS "lockedUntil"
      FROM app_lookup_login(${loginId})
    `;
    
    return rows[0] || null;
  },

  /**
   * Records a successful or failed login attempt using the SECURITY DEFINER function.
   */
  async recordLoginResult(userId: string, success: boolean): Promise<void> {
    const db = getDb();
    
    await db`
      SELECT app_record_login_result(${userId}, ${success})
    `;
  },

  /**
   * Safe identity fields for the authenticated user (own row only — RLS scoped).
   * Used by page headers to display a human-readable label.
   */
  async getOwn(
    ctx: AgentContext
  ): Promise<{ loginId: string; category: string; role: string } | null> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<{ loginId: string; category: string; role: string }[]>`
        SELECT login_id AS "loginId", category, role
        FROM users
        WHERE id = ${ctx.userId}
      `;
      return rows[0] ?? null;
    });
  },
};

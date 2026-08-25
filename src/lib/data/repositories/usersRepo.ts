import { getDb } from "../client";
import { PreAuthUser } from "@/lib/types";

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
  }
};

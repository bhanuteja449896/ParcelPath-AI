/**
 * Core type definitions shared across the application.
 * ARCHITECTURE.md SS8, SS9, SS12.
 */

/** User category — drives route, persona, coarse data scope */
export type UserCategory = "customer" | "support";

/** Fine-grained role within category */
export type UserRole =
  | "customer_user"
  | "customer_admin"
  | "support_agent"
  | "ops_manager";

/**
 * Identity context built exclusively from the server-side session.
 * NEVER accept any of these fields from the client.
 * Set as GUCs in every DB transaction (ARCHITECTURE.md SS12).
 */
export interface AgentContext {
  userId: string;
  category: UserCategory;
  role: UserRole;
  /** null for support users; always populated for customer users */
  accountId: string | null;
  isActive: boolean;
}

/** Minimal user shape returned by pre-auth lookup (SECURITY DEFINER fn) */
export interface PreAuthUser {
  id: string;
  passwordHash: string;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

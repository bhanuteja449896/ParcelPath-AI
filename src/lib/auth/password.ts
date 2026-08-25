/**
 * Password hashing module (ARCHITECTURE.md SS6, TASKS.md T06).
 *
 * Uses Argon2id with OWASP-recommended parameters:
 *   memoryCost: 19456 KiB (~19 MiB), timeCost: 2, parallelism: 1
 *
 * PHC string format stored in users.password_hash — never exposed.
 * dummyVerify() equalises timing on unknown login IDs (§5 step 4).
 */
import { hash, verify, type Options } from "@node-rs/argon2";

/** OWASP Argon2id parameters (ARCHITECTURE.md SS6) */
const ARGON2_OPTIONS: Options = {
  algorithm: 2, // Argon2id
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash a plaintext password into a PHC string.
 * Never call this in request handlers directly — only at seed time
 * or when a user changes their password.
 */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a stored PHC hash.
 * Constant-time internally via libargon2.
 */
export async function verifyPassword(
  storedHash: string,
  plain: string
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, ARGON2_OPTIONS);
  } catch {
    // Invalid PHC format or library error — treat as mismatch
    return false;
  }
}

/**
 * Dummy PHC hash constant for timing equalisation.
 * Used when a login ID is not found — we still run a verify call
 * so response time is indistinguishable from a real failed verify.
 * (ARCHITECTURE.md SS5 step 4, SS28 "User enumeration" mitigation)
 *
 * Pre-computed at startup; the exact value does not matter as long as it
 * is a valid Argon2id PHC string so verify() does real work.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$dW1teWR1bW15ZHVtbXlkdW0$" +
  "xKVIYFUUuEQmCVg8VFD4x6JlNWbdlGSSrn2xjQsPTpU";

/**
 * Run a dummy Argon2id verification to blunt timing-based user enumeration.
 * Always resolves (does not throw). Call this when the login ID is not found.
 */
export async function dummyVerify(): Promise<void> {
  // Always fails — "dummy_plain" will not match DUMMY_HASH.
  // The purpose is to consume CPU time equivalent to a real verify.
  await verifyPassword(DUMMY_HASH, "dummy_plain_for_timing_equalization").catch(
    () => {}
  );
}

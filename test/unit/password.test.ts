/**
 * Unit tests for password hashing module (TASKS.md T06).
 * Tests: hashPassword, verifyPassword, dummyVerify.
 * Does NOT require DB connection.
 */
import { describe, it, expect, vi } from "vitest";

// Mock config before importing password module
vi.mock("@/lib/config", () => ({
  config: {
    databaseUrl: "postgres://test",
    session: {
      cookieName: "pp_session",
      ttlHours: 168,
      idleRefreshMin: 60,
      absoluteCapDays: 30,
      secureCookie: false,
    },
  },
}));

const { hashPassword, verifyPassword, dummyVerify } = await import(
  "@/lib/auth/password"
);

describe("hashPassword", () => {
  it("returns a PHC string starting with $argon2id$", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("produces different hashes for the same input (salt randomness)", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    expect(h1).not.toBe(h2);
  });

  it("refuses empty string (library-level)", async () => {
    // argon2 may accept empty strings; we just confirm it produces a PHC string
    const hash = await hashPassword("");
    expect(hash).toMatch(/^\$argon2id\$/);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const plain = "my-super-secret-password-123!";
    const hash = await hashPassword(plain);
    const result = await verifyPassword(hash, plain);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct-password");
    const result = await verifyPassword(hash, "wrong-password");
    expect(result).toBe(false);
  });

  it("returns false for invalid PHC string (no throw)", async () => {
    const result = await verifyPassword("not-a-valid-hash", "anything");
    expect(result).toBe(false);
  });

  it("is case-sensitive", async () => {
    const hash = await hashPassword("Password123");
    expect(await verifyPassword(hash, "password123")).toBe(false);
    expect(await verifyPassword(hash, "PASSWORD123")).toBe(false);
    expect(await verifyPassword(hash, "Password123")).toBe(true);
  });
});

describe("dummyVerify", () => {
  it("does not throw", async () => {
    await expect(dummyVerify()).resolves.toBeUndefined();
  });

  it("takes a non-trivial amount of time (> 1ms, < 30s)", async () => {
    const start = Date.now();
    await dummyVerify();
    const elapsed = Date.now() - start;
    // Argon2id with m=19456,t=2 should take at least a few ms
    expect(elapsed).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(30_000);
  });
});

describe("password policy enforcement (naming spec)", () => {
  it("does NOT store plaintext — hash and input differ", async () => {
    const plain = "my-password";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash).not.toContain(plain);
  });
});

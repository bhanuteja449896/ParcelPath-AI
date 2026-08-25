/**
 * Unit tests for session token utilities (TASKS.md T07).
 * Tests: generateSessionToken, hashToken. No DB connection needed.
 */
import { describe, it, expect, vi } from "vitest";

// Mock dependencies before importing session module
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

// Mock next/headers so it doesn't error in Node test env
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
}));

// Mock next/server
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn(),
    redirect: vi.fn(),
  },
}));

const { generateSessionToken, hashToken } = await import("@/lib/auth/session");

describe("generateSessionToken", () => {
  it("returns a non-empty string", () => {
    const token = generateSessionToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("returns unique values each call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));
    expect(tokens.size).toBe(100);
  });

  it("is base64url-safe (no +, /, = characters)", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateSessionToken();
      expect(t).not.toMatch(/[+/=]/);
    }
  });

  it("produces 32-byte (43-char base64url) token", () => {
    // base64url of 32 bytes = ceil(32*4/3) without padding = 43 chars
    const token = generateSessionToken();
    expect(token.length).toBe(43);
  });
});

describe("hashToken", () => {
  it("returns a hex string of 64 chars (SHA-256)", () => {
    const hash = hashToken("some-raw-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const h1 = hashToken("abc");
    const h2 = hashToken("abc");
    expect(h1).toBe(h2);
  });

  it("is unique per distinct input", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("raw token is not stored in the hash", () => {
    const raw = generateSessionToken();
    const hash = hashToken(raw);
    expect(hash).not.toContain(raw);
  });
});

/**
 * Typed configuration module (ARCHITECTURE.md SS33, TASKS.md T02).
 * Reads env vars with defaults and validation. Server-side only.
 * Never use NEXT_PUBLIC_ for secrets.
 */

function require_env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
}

function optional_env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optional_int(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`Environment variable ${key} must be an integer, got: ${v}`);
  return n;
}

export const config = {
  /** Neon pooled endpoint — all request-time DB access (app_runtime role) */
  databaseUrl: require_env("DATABASE_URL"),
  /** Neon direct endpoint — migrations/seeding only (project owner role) */
  directUrl: optional_env("DIRECT_URL", ""),

  /** Session cookie settings (ARCHITECTURE.md SS7) */
  session: {
    cookieName: optional_env("SESSION_COOKIE_NAME", "pp_session"),
    /** Total session TTL in hours (default 7 days = 168h) */
    ttlHours: optional_int("SESSION_TTL_HOURS", 168),
    /** Slide expiry if idle more than this many minutes (default 60m) */
    idleRefreshMin: optional_int("SESSION_IDLE_REFRESH_MIN", 60),
    /** Absolute max session length in days (default 30d) */
    absoluteCapDays: optional_int("SESSION_ABSOLUTE_CAP_DAYS", 30),
    /** Use Secure flag on cookie (auto-enabled in production) */
    secureCookie: optional_env("NODE_ENV", "development") === "production",
  },

  /** LLM settings */
  llm: {
    baseUrl: optional_env("LLM_BASE_URL", "https://api.openai.com/v1"),
    apiKey: optional_env("LLM_API_KEY", ""),
    model: optional_env("LLM_MODEL", "gpt-4o-mini"),
    embedModel: optional_env("EMBED_MODEL", "text-embedding-3-small"),
  },

  /** Seed demo password (dev only — hashed at seed time, never stored plain) */
  seedDemoPassword: optional_env("SEED_DEMO_PASSWORD", ""),

  /** Log level */
  logLevel: optional_env("LOG_LEVEL", "info"),

  /** Reseed guard */
  allowReseed: optional_env("ALLOW_RESEED", "false") === "true",
} as const;

export type Config = typeof config;

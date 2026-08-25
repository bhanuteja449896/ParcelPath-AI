/**
 * PostgreSQL client singleton (ARCHITECTURE.md SS13, SS3.2).
 * Uses postgres.js with prepare:false for PgBouncer transaction-mode compatibility.
 * App request-time access uses DATABASE_URL (app_runtime role, pooled).
 * Migration/seed scripts use DIRECT_URL (owner role, direct) via their own connections.
 */
import postgres from "postgres";
import { config } from "@/lib/config";

/** Get a new postgres.js client for the pooled DATABASE_URL (app_runtime role). */
export function getDbClient(): postgres.Sql {
  return postgres(config.databaseUrl, {
    prepare: false, // Required for PgBouncer transaction-mode pooling
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Module-level singleton for use in long-lived server contexts (Next.js App Router)
let _singleton: postgres.Sql | null = null;

export function getDb(): postgres.Sql {
  if (!_singleton) {
    _singleton = getDbClient();
  }
  return _singleton;
}

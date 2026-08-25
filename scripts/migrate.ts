/**
 * Minimal SQL migration runner (ARCHITECTURE.md §31).
 * Applies db/migrations/*.sql in filename order over DIRECT_URL (project owner),
 * tracking applied files in schema_migrations. Substitutes {{VAR}} tokens from env.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const DIRECT_URL = env.DIRECT_URL;
if (!DIRECT_URL) {
  console.error("FAIL: DIRECT_URL missing from .env");
  process.exit(1);
}

let ownerRole = "neondb_owner";
try {
  ownerRole = new URL(DIRECT_URL).username || ownerRole;
} catch { /* keep default */ }

const vars: Record<string, string> = {
  OWNER_ROLE: ownerRole,
  APP_RUNTIME_DB_PASSWORD: env.APP_RUNTIME_DB_PASSWORD ?? "",
};

function substitute(sqlText: string): string {
  return sqlText.replace(/\{\{([A-Z0-9_]+)\}\}/g, (raw, key: string) => {
    const v = vars[key];
    if (!v) {
      console.error(`FAIL: substitution variable ${key} is empty (set it in .env)`);
      process.exit(1);
    }
    return v;
  });
}

const sql = postgres(DIRECT_URL, { prepare: false, max: 1 });

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const dir = path.join(ROOT, "db", "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

  let applied = 0;
  for (const f of files) {
    const done = await sql`SELECT 1 FROM schema_migrations WHERE filename = ${f}`;
    if (done.length > 0) {
      console.log(`skip  ${f} (already applied)`);
      continue;
    }
    const text = substitute(fs.readFileSync(path.join(dir, f), "utf8"));
    const t = Date.now();
    try {
      await sql.begin(async tx => {
        await tx.unsafe(text);
        await tx`INSERT INTO schema_migrations (filename) VALUES (${f})`;
      });
      applied++;
      console.log(`apply ${f} OK (${Date.now() - t}ms)`);
    } catch (e) {
      console.error(`FAIL  ${f}: ${(e as Error).message}`);
      process.exitCode = 1;
      break; // stop on first failure; later migrations depend on earlier ones
    }
  }
  console.log(applied > 0 ? `Done: ${applied} migration(s) applied.` : "Nothing to apply.");
}

main()
  .catch(e => { console.error("FATAL", e); process.exit(1); })
  .finally(() => sql.end({ timeout: 5 }));

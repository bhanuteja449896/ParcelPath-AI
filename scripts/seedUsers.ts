import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { hashPassword } from "../src/lib/auth/password";

const ROOT = path.resolve(import.meta.dirname, "..");

// ── Load env ──────────────────────────────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_a-z]+)=(.*)/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const env = loadEnv();

const DIRECT_URL = env.DIRECT_URL;
const SEED_DEMO_PASSWORD = env.SEED_DEMO_PASSWORD || "DemoPassword123!";

if (!DIRECT_URL) {
  console.error("FAIL: DIRECT_URL missing from .env");
  process.exit(1);
}

async function main() {
  const sql = postgres(DIRECT_URL, { prepare: false });

  console.log("Hashing password (may take a few seconds due to Argon2id costs)...");
  const pwdHash = await hashPassword(SEED_DEMO_PASSWORD);

  await sql.begin(async (tx) => {
    // 1. Get account IDs for the customers
    const accts = await tx<{ id: string; code: string }[]>`
      SELECT id, code FROM accounts WHERE code IN ('northstar_logistics', 'lumenworks')
    `;
    const northstarId = accts.find(a => a.code === 'northstar_logistics')?.id;
    const lumenworksId = accts.find(a => a.code === 'lumenworks')?.id;

    if (!northstarId || !lumenworksId) {
      throw new Error("Seed accounts not found. Run ingest:data first.");
    }

    // 2. Clear old users (cascades to sessions/pending_actions/etc)
    await tx`DELETE FROM users`;

    const demoUsers = [
      { login: "northstar_admin", category: "customer", role: "customer_admin", account: northstarId },
      { login: "northstar_user", category: "customer", role: "customer_user", account: northstarId },
      { login: "lumenworks_user", category: "customer", role: "customer_user", account: lumenworksId },
      { login: "support01", category: "support", role: "support_agent", account: null },
      { login: "ops01", category: "support", role: "ops_manager", account: null },
    ];

    console.log("Inserting demo users...");
    for (const u of demoUsers) {
      await tx`
        INSERT INTO users (login_id, password_hash, category, role, account_id)
        VALUES (${u.login}, ${pwdHash}, ${u.category}, ${u.role}, ${u.account})
      `;
      console.log(`  ✅ Inserted ${u.login} (${u.role})`);
    }
  });

  await sql.end();
  console.log("User seeding complete.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

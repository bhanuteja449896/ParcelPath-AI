import postgres from "postgres";
import { verifyPassword } from "../src/lib/auth/password";
import { config } from "../src/lib/config";
import "dotenv/config";

async function run() {
  const sql = postgres(config.databaseUrl, { prepare: false });
  const users = await sql`SELECT login_id, password_hash FROM users WHERE login_id = 'northstar_user'`;
  if (!users.length) { console.log("User not found"); return; }
  
  const hash = users[0].password_hash;
  const isOk = await verifyPassword("DemoPassword123!", hash);
  console.log("Verified:", isOk);
  
  const isOkOld = await verifyPassword("password123", hash);
  console.log("Verified old:", isOkOld);
  
  process.exit(0);
}
run();

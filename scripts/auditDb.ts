import postgres from "postgres";
import path from "path";
import fs from "fs";

async function main() {

const envPath = path.join(process.cwd(), ".env");
const env: Record<string, string> = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_a-z]+)=(.*)/);
  if (m) env[m[1]!] = m[2]!.trim();
}

const sql = postgres(env.DIRECT_URL!, { prepare: false });

const [accts, orders, tickets, docs, chunks, users, meta] = await Promise.all([
  sql`SELECT count(*) as n FROM accounts`,
  sql`SELECT count(*) as n FROM orders`,
  sql`SELECT count(*) as n FROM tickets`,
  sql`SELECT count(*) as n FROM documents`,
  sql`SELECT count(*) as n FROM document_chunks`,
  sql`SELECT count(*) as n FROM users`,
  sql`SELECT key, value FROM system_metadata`,
]);

console.log("\n=== Database Row Counts ===");
console.log(`  accounts:        ${accts[0].n}`);
console.log(`  orders:          ${orders[0].n}`);
console.log(`  tickets:         ${tickets[0].n}`);
console.log(`  documents:       ${docs[0].n}`);
console.log(`  document_chunks: ${chunks[0].n}`);
console.log(`  users:           ${users[0].n}`);
console.log("\n=== System Metadata ===");
for (const row of meta) console.log(`  ${row.key}: ${row.value}`);

const sampleOrders = await sql`SELECT order_id, status, carrier FROM orders ORDER BY order_id LIMIT 10`;
console.log("\n=== Sample Orders ===");
for (const o of sampleOrders) console.log(`  ${o.order_id}  status=${o.status}  carrier=${o.carrier}`);

const sampleTickets = await sql`SELECT ticket_id, subject FROM tickets ORDER BY ticket_id LIMIT 10`;
console.log("\n=== Sample Tickets ===");
for (const t of sampleTickets) console.log(`  ${t.ticket_id}  ${t.subject}`);

const docList = await sql`SELECT title, authority, source_filename FROM documents ORDER BY title`;
console.log("\n=== Ingested Documents ===");
for (const d of docList) console.log(`  [${d.authority}] ${d.title}  (${d.source_filename})`);

const userList = await sql`SELECT login_id, category, role FROM users ORDER BY login_id`;
console.log("\n=== Demo Users ===");
for (const u of userList) console.log(`  ${u.login_id}  category=${u.category}  role=${u.role}`);

await sql.end();
}

main().catch(console.error);


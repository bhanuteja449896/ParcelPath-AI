import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { config } from "@/lib/config";

const sql = postgres(config.databaseUrl, { prepare: false });

describe("Security RLS Tests (ST-21)", () => {
  afterAll(async () => {
    await sql.end();
  });

  it("ST-21: Direct SQL without GUC context returns zero rows (RLS proof)", async () => {
    // Attempting to query the 'orders' table without setting app.user_id, app.account_id, etc.
    // Since RLS is enabled and forces closed on missing context, this should return 0 rows.
    const orders = await sql`SELECT * FROM orders`;
    expect(orders.length).toBe(0);

    const tickets = await sql`SELECT * FROM tickets`;
    expect(tickets.length).toBe(0);
  });
});

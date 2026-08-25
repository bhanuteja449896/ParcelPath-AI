/**
 * XLSX Data Ingestion — T10 (ARCHITECTURE.md SS16-17, TASKS.md T10)
 *
 * Parses ParcelPilot_Assessment_Data.xlsx and loads:
 *   README sheet → system_metadata.reference_time  (official assessment clock)
 *   accounts sheet → accounts table
 *   orders  sheet → orders table
 *   tickets sheet → tickets table (historical_resolution flagged)
 *
 * Idempotent: full replace inside ONE transaction.
 * Prod guard: aborts if NODE_ENV=production unless ALLOW_RESEED=true.
 * Writes seed_version + data_pack_sha256 to system_metadata.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import xlsx from "xlsx";
import postgres from "postgres";

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

// ── Prod guard ────────────────────────────────────────────────────────────────
if (env.NODE_ENV === "production" && env.ALLOW_RESEED !== "true") {
  console.error("ABORT: NODE_ENV=production and ALLOW_RESEED is not true. Set ALLOW_RESEED=true to reseed.");
  process.exit(1);
}

const DIRECT_URL = env.DIRECT_URL;
if (!DIRECT_URL) {
  console.error("FAIL: DIRECT_URL missing from .env — need owner role for seed writes");
  process.exit(1);
}

// ── Status mapping: XLSX → DB CHECK constraint values ─────────────────────────
const ORDER_STATUS_MAP: Record<string, string> = {
  BOOKED:       "pending",
  PENDING:      "pending",
  PICKED_UP:    "picked_up",
  IN_TRANSIT:   "in_transit",
  DELIVERED:    "delivered",
  CANCELLED:    "cancelled",
  EXCEPTION:    "exception",
};

const TICKET_STATUS_MAP: Record<string, string> = {
  open:      "open",
  pending:   "pending",
  escalated: "escalated",
  resolved:  "resolved",
  closed:    "closed",
};

const TICKET_CATEGORY_MAP: Record<string, string> = {
  complaint:    "complaint",
  billing:      "billing",
  delivery:     "delivery",
  cancellation: "cancellation",
};

// ── Parse ISO-ish datetime strings from XLSX ──────────────────────────────────
function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  // "2026-08-16 09:00" or ISO with timezone
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    return new Date(s.replace(" ", "T") + ":00.000+05:30"); // IST timezone
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const xlsxPath = path.join(ROOT, "data", "raw", "ParcelPilot_Assessment_Data.xlsx");
  if (!fs.existsSync(xlsxPath)) {
    console.error(`FAIL: workbook not found at ${xlsxPath}`);
    process.exit(1);
  }

  console.log(`Reading workbook: ${xlsxPath}`);
  const rawBytes = fs.readFileSync(xlsxPath);
  const dataPackSha256 = crypto.createHash("sha256").update(rawBytes).digest("hex");
  const wb = xlsx.read(rawBytes, { type: "buffer", cellDates: true });

  // ── 1. README sheet → reference_time ──────────────────────────────────────
  const readmeWs = wb.Sheets["README"];
  if (!readmeWs) throw new Error("README sheet not found in workbook");
  const readmeRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(readmeWs, { defval: null });
  const snapshotRow = readmeRows.find(
    (r) => String(Object.values(r)[0]).toLowerCase().includes("snapshot")
  );
  if (!snapshotRow) throw new Error("Could not locate 'Dataset snapshot' row in README sheet");
  const snapshotStr = String(Object.values(snapshotRow)[1] ?? "");
  // "2026-08-16 11:00 Asia/Kolkata" → parse as IST
  const referenceTime = parseDate(snapshotStr.replace(" Asia/Kolkata", "").replace(" Asia/Kolkata", "")) ??
    new Date(snapshotStr.split(" ").slice(0, 2).join("T") + ":00.000+05:30");
  console.log(`reference_time: ${referenceTime.toISOString()}`);

  // ── 2. Parse accounts ──────────────────────────────────────────────────────
  const accountsWs = wb.Sheets["accounts"];
  if (!accountsWs) throw new Error("accounts sheet not found");
  const rawAccounts = xlsx.utils.sheet_to_json<Record<string, unknown>>(accountsWs, { defval: null });
  console.log(`accounts sheet: ${rawAccounts.length} rows`);

  const accounts = rawAccounts.map((r) => ({
    code: String(r.account_id ?? "").toLowerCase().replace("acct-00", ""),
    display_name: String(r.account_name ?? ""),
    plan_tier: String(r.plan ?? "").toLowerCase(),
    // Store original ACCT-XXX id in seed_attributes for order/ticket resolution
    _acct_id_xlsx: String(r.account_id ?? ""),
    _contract_file: String(r.contract_file ?? ""),
  }));

  // Build a slug for the account code: northstar, lumenworks, etc.
  const accountCodeFromName = (name: string): string =>
    name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  // ── 3. Parse orders ────────────────────────────────────────────────────────
  const ordersWs = wb.Sheets["orders"];
  if (!ordersWs) throw new Error("orders sheet not found");
  const rawOrders = xlsx.utils.sheet_to_json<Record<string, unknown>>(ordersWs, { defval: null });
  console.log(`orders sheet: ${rawOrders.length} rows`);

  // ── 4. Parse tickets ───────────────────────────────────────────────────────
  const ticketsWs = wb.Sheets["tickets"];
  if (!ticketsWs) throw new Error("tickets sheet not found");
  const rawTickets = xlsx.utils.sheet_to_json<Record<string, unknown>>(ticketsWs, { defval: null });
  console.log(`tickets sheet: ${rawTickets.length} rows`);

  // ── 5. Connect to DB ───────────────────────────────────────────────────────
  const sql = postgres(DIRECT_URL, { prepare: false, max: 1 });

  try {
    await sql.begin(async (tx) => {
      console.log("\nStarting transactional seed...");

      // ── 5a. Upsert accounts ──────────────────────────────────────────────
      console.log("Upserting accounts...");
      const accountIdMap = new Map<string, string>(); // ACCT-XXX → postgres uuid

      for (const a of accounts) {
        const code = accountCodeFromName(a.display_name);
        const rows = await tx<{ id: string }[]>`
          INSERT INTO accounts (code, display_name, plan_tier)
          VALUES (${code}, ${a.display_name}, ${a.plan_tier})
          ON CONFLICT (code) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                plan_tier    = EXCLUDED.plan_tier
          RETURNING id
        `;
        accountIdMap.set(a._acct_id_xlsx, rows[0]!.id);
        console.log(`  ${a._acct_id_xlsx} → accounts.id ${rows[0]!.id} (${code})`);
      }

      // ── 5b. Delete existing seed orders/tickets (fresh replace) ─────────
      console.log("Clearing old seeded orders & tickets...");
      await tx`DELETE FROM orders WHERE seed_attributes->>'seeded' = 'true'`;
      await tx`DELETE FROM tickets WHERE seed_attributes->>'seeded' = 'true'`;

      // ── 5c. Insert orders ────────────────────────────────────────────────
      console.log("Inserting orders...");
      let orderCount = 0;
      for (const r of rawOrders) {
        const acctUuid = accountIdMap.get(String(r.account_id ?? ""));
        if (!acctUuid) {
          console.warn(`  SKIP order ${r.order_id}: unknown account_id ${r.account_id}`);
          continue;
        }

        const rawStatus = String(r.status ?? "BOOKED").toUpperCase();
        const status = ORDER_STATUS_MAP[rawStatus] ?? "pending";

        // Derive SLA-relevant timestamps
        const pickupAt = parseDate(r.pickup_actual_at) ?? parseDate(r.pickup_window_start);
        const promisedDelivery = parseDate(r.pickup_window_end); // use window end as promise
        const deliveredAt = status === "delivered" ? parseDate(r.pickup_actual_at) : null;
        const cancelledAt = r.cancellation_requested_at ? parseDate(r.cancellation_requested_at) : null;

        // Seed attributes: all verbatim xlsx columns
        const seedAttrs = {
          seeded: "true",
          carrier_fault: r.carrier_fault ?? false,
          customer_fault: r.customer_fault ?? false,
          shipment_fee_inr: r.shipment_fee_inr ?? null,
          notes: r.notes ?? null,
          booked_at: r.booked_at ?? null,
          pickup_window_start: r.pickup_window_start ?? null,
          pickup_window_end: r.pickup_window_end ?? null,
        };

        await tx`
          INSERT INTO orders (
            order_id, account_id, carrier, service_level, status,
            origin, destination,
            pickup_at, promised_delivery_at, delivered_at,
            cancelled_at, cancelled_reason,
            seed_attributes
          ) VALUES (
            ${String(r.order_id ?? "")},
            ${acctUuid},
            ${String(r.carrier ?? "")},
            ${null},
            ${status},
            ${null}, ${null},
            ${pickupAt}, ${promisedDelivery}, ${deliveredAt},
            ${cancelledAt}, ${String(r.notes ?? "") || null},
            ${JSON.stringify(seedAttrs)}
          )
          ON CONFLICT (order_id) DO UPDATE
            SET account_id    = EXCLUDED.account_id,
                carrier       = EXCLUDED.carrier,
                status        = EXCLUDED.status,
                pickup_at     = EXCLUDED.pickup_at,
                cancelled_at  = EXCLUDED.cancelled_at,
                cancelled_reason = EXCLUDED.cancelled_reason,
                seed_attributes  = EXCLUDED.seed_attributes,
                updated_at    = now()
        `;
        orderCount++;
      }
      console.log(`  Inserted/updated ${orderCount} orders`);

      // ── 5d. Insert tickets ───────────────────────────────────────────────
      console.log("Inserting tickets...");
      let ticketCount = 0;
      for (const r of rawTickets) {
        const acctUuid = accountIdMap.get(String(r.account_id ?? ""));
        if (!acctUuid) {
          console.warn(`  SKIP ticket ${r.ticket_id}: unknown account_id ${r.account_id}`);
          continue;
        }

        const rawStatus = String(r.status ?? "open").toLowerCase();
        const status = TICKET_STATUS_MAP[rawStatus] ?? "open";

        // Infer category from subject keywords
        const subject = String(r.subject ?? "").toLowerCase();
        let category = "other";
        if (subject.includes("cancel")) category = "cancellation";
        else if (subject.includes("billing") || subject.includes("invoice") || subject.includes("fee") || subject.includes("credit")) category = "billing";
        else if (subject.includes("delivery") || subject.includes("pickup") || subject.includes("shipment")) category = "delivery";
        else if (subject.includes("fail") || subject.includes("error") || subject.includes("bug") || subject.includes("issue")) category = "complaint";

        // Infer priority from status + description keywords
        const desc = String(r.description ?? "").toLowerCase();
        let priority = "medium";
        if (status === "escalated") priority = "high";
        else if (desc.includes("urgent") || desc.includes("critical") || desc.includes("all users")) priority = "high";
        else if (desc.includes("minor") || desc.includes("cosmetic")) priority = "low";

        const hasHistoricalResolution = !!r.historical_resolution;
        const createdAt = parseDate(r.created_at) ?? new Date();

        // SLA: 24h from creation for standard, 4h for escalated/high
        const slaHours = priority === "high" || status === "escalated" ? 4 : 24;
        const slaDueAt = new Date(createdAt.getTime() + slaHours * 3600 * 1000);

        const seedAttrs = {
          seeded: "true",
          channel: r.channel ?? null,
          assigned_to: r.assigned_to ?? null,
          last_customer_message_at: r.last_customer_message_at ?? null,
        };

        await tx`
          INSERT INTO tickets (
            ticket_id, account_id, subject, description,
            category, priority, status, sla_due_at,
            historical_resolution, resolution_is_historical,
            seed_attributes, created_at
          ) VALUES (
            ${String(r.ticket_id ?? "")},
            ${acctUuid},
            ${String(r.subject ?? "")},
            ${String(r.description ?? "") || null},
            ${category}, ${priority}, ${status},
            ${slaDueAt},
            ${r.historical_resolution ? String(r.historical_resolution) : null},
            ${hasHistoricalResolution},
            ${JSON.stringify(seedAttrs)},
            ${createdAt}
          )
          ON CONFLICT (ticket_id) DO UPDATE
            SET account_id            = EXCLUDED.account_id,
                subject               = EXCLUDED.subject,
                description           = EXCLUDED.description,
                category              = EXCLUDED.category,
                priority              = EXCLUDED.priority,
                status                = EXCLUDED.status,
                sla_due_at            = EXCLUDED.sla_due_at,
                historical_resolution = EXCLUDED.historical_resolution,
                resolution_is_historical = EXCLUDED.resolution_is_historical,
                seed_attributes       = EXCLUDED.seed_attributes,
                updated_at            = now()
        `;
        ticketCount++;
      }
      console.log(`  Inserted/updated ${ticketCount} tickets`);

      // ── 5e. Write system_metadata ────────────────────────────────────────
      console.log("Writing system_metadata...");
      const seedVersion = `xlsx-${new Date().toISOString().slice(0, 10)}`;

      await tx`
        INSERT INTO system_metadata (key, value, updated_at) VALUES
          ('reference_time', ${JSON.stringify({ iso: referenceTime.toISOString(), original: snapshotStr })}, now()),
          ('seed_version', ${JSON.stringify(seedVersion)}, now()),
          ('data_pack_sha256', ${JSON.stringify(dataPackSha256)}, now())
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = now()
      `;

      console.log("\n✅ Seed complete:");
      console.log(`  accounts: ${accounts.length}`);
      console.log(`  orders:   ${orderCount}`);
      console.log(`  tickets:  ${ticketCount}`);
      console.log(`  reference_time: ${referenceTime.toISOString()}`);
      console.log(`  seed_version:   ${seedVersion}`);
      console.log(`  data_pack_sha256: ${dataPackSha256.slice(0, 16)}…`);
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

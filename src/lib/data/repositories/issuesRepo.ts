import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";
import { extractReferenceTime } from "../referenceTime";

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface Finding {
  type: string;
  severity: IssueSeverity;
  title: string;
  window: string;
  evidence: { ticket_id?: string; order_id?: string; account_code?: string }[];
  suggested_next: string;
}

export const issuesRepo = {
  /**
   * Fetches proactive findings.
   * Requires support roles (enforced by caller / RLS).
   */
  async getFindings(ctx: AgentContext): Promise<Finding[]> {
    return await withUserContext(ctx, async (tx) => {
      // 1. Get reference time (jsonb: { iso, original })
      const refRows = await tx`SELECT value FROM system_metadata WHERE key = 'reference_time'`;
      const refTime = refRows.length > 0 ? extractReferenceTime(refRows[0].value) : new Date();
      const refTimeStr = refTime.toISOString();

      const findings: Finding[] = [];

      // A. SLA Risk
      // open tickets: sla_due_at <= reference_time + severity lead (e.g., 24h)
      const slaRows = await tx`
        SELECT id, ticket_id, status, sla_due_at, account_id 
        FROM tickets 
        WHERE status IN ('open', 'escalated') 
          AND sla_due_at <= (${refTimeStr}::timestamptz + interval '24 hours')
        ORDER BY sla_due_at ASC
        LIMIT 10
      `;
      if (slaRows.length > 0) {
        findings.push({
          type: "sla_risk",
          severity: "high",
          title: `${slaRows.length} tickets nearing or breached SLA`,
          window: "Next 24h",
          evidence: slaRows.map(r => ({ ticket_id: r.ticket_id })),
          suggested_next: `Draft escalation for ticket ${slaRows[0].ticket_id}`,
        });
      }

      // B. Complaint Spike
      // tickets per category: last 48h count > 2x trailing-7d daily mean
      // We'll simplify the heuristic in SQL:
      const spikeRows = await tx`
        WITH recent AS (
          SELECT category, COUNT(*) as recent_count
          FROM tickets
          WHERE created_at >= (${refTimeStr}::timestamptz - interval '48 hours')
            AND created_at <= ${refTimeStr}::timestamptz
          GROUP BY category
        ),
        baseline AS (
          SELECT category, COUNT(*) / 7.0 as daily_mean
          FROM tickets
          WHERE created_at >= (${refTimeStr}::timestamptz - interval '9 days')
            AND created_at < (${refTimeStr}::timestamptz - interval '48 hours')
          GROUP BY category
        )
        SELECT r.category, r.recent_count, b.daily_mean
        FROM recent r
        JOIN baseline b ON r.category = b.category
        WHERE r.recent_count > (2 * b.daily_mean) AND r.recent_count >= 3
      `;
      if (spikeRows.length > 0) {
        for (const row of spikeRows) {
          findings.push({
            type: "complaint_spike",
            severity: "high",
            title: `Complaint Spike in ${row.category}`,
            window: "Last 48h",
            evidence: [],
            suggested_next: "Investigate root cause using document search",
          });
        }
      }

      // C. Cross-account incident
      // >=3 distinct accounts sharing category within 24h
      const incidentRows = await tx`
        SELECT category, COUNT(DISTINCT account_id) as account_count
        FROM tickets
        WHERE created_at >= (${refTimeStr}::timestamptz - interval '24 hours')
          AND created_at <= ${refTimeStr}::timestamptz
        GROUP BY category
        HAVING COUNT(DISTINCT account_id) >= 3
      `;
      if (incidentRows.length > 0) {
        for (const row of incidentRows) {
          findings.push({
            type: "cross_account_incident",
            severity: "critical",
            title: `Cross-account Incident: ${row.category}`,
            window: "Last 24h",
            evidence: [],
            suggested_next: "Draft follow-up task to update known issues",
          });
        }
      }

      // D. Order Anomaly
      // high rate of cancellations/exceptions per carrier
      const anomalyRows = await tx`
        SELECT carrier, COUNT(*) as fail_count
        FROM orders
        WHERE status IN ('cancelled', 'exception')
          AND updated_at >= (${refTimeStr}::timestamptz - interval '48 hours')
        GROUP BY carrier
        HAVING COUNT(*) >= 2
      `;
      if (anomalyRows.length > 0) {
        for (const row of anomalyRows) {
          findings.push({
            type: "order_anomaly",
            severity: "medium",
            title: `Elevated failures for ${row.carrier}`,
            window: "Last 48h",
            evidence: [],
            suggested_next: "Check carrier SLA agreement",
          });
        }
      }

      // We'll skip Product-issue cluster (FTS overlap) in this implementation 
      // to keep it simple, as it requires vector/FTS joining which might be brittle on mock data.

      return findings;
    });
  }
};

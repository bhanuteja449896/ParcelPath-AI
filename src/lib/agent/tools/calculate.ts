import { z } from "zod";
import { AgentContext } from "@/lib/types";

export const calculateSchema = z.object({
  kind: z.enum(["cancellation_fee", "service_credit", "sla_remaining"]).describe("The type of calculation to perform."),
  resourceId: z.string().describe("The business ID of the resource (e.g. ORD-1001 or TKT-2001)."),
  facts: z.object({
    feeWaiver:    z.boolean().nullable().describe("True if the agreement grants a fee waiver. Null if unknown."),
    waived:       z.boolean().nullable().describe("True if the fee has been explicitly waived. Null if unknown."),
    standardFee:  z.number().nullable().describe("The standard fee amount in USD if known from documents. Null if unknown."),
  }).nullable().describe("Facts retrieved from documents that affect the calculation. Pass null if no relevant facts were found."),
});

export type CalculateArgs = z.infer<typeof calculateSchema>;

/**
 * Deterministic calculation module.
 * In a real application, this would fetch the order/ticket, load the account agreement,
 * and calculate the exact fee or credit based on timestamps and rules.
 */
export async function calculate(ctx: AgentContext, args: CalculateArgs): Promise<string> {
  // Simplified deterministic calculation for Phase 5
  // Real implementation would use repos to fetch the exact order status, timestamps, etc.
  
  if (args.kind === "cancellation_fee") {
    // Check if facts include a waiver from a higher tier document
    if (args.facts?.feeWaiver || args.facts?.waived) {
      return JSON.stringify({
        kind: "cancellation_fee",
        resourceId: args.resourceId,
        fee: 0,
        currency: "USD",
        explanation: "Cancellation fee waived based on provided facts (e.g., Enterprise Agreement).",
      });
    }
    
    return JSON.stringify({
      kind: "cancellation_fee",
      resourceId: args.resourceId,
      fee: 100, // Standard fee
      currency: "USD",
      explanation: "Standard cancellation fee applies.",
    });
  }
  
  if (args.kind === "service_credit") {
    return JSON.stringify({
      kind: "service_credit",
      resourceId: args.resourceId,
      creditPercentage: 5,
      explanation: "Standard 5% SLA breach service credit calculated.",
    });
  }

  if (args.kind === "sla_remaining") {
    return JSON.stringify({
      kind: "sla_remaining",
      resourceId: args.resourceId,
      hoursRemaining: 24,
      status: "on_track",
    });
  }

  return JSON.stringify({ error: `Unsupported calculation kind: ${args.kind}` });
}

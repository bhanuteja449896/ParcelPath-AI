import { getDb } from "../data/client";
import { extractReferenceTime } from "../data/referenceTime";
import { AgentContext } from "@/lib/types";
import { config } from "@/lib/config";
import { getSystemPrompt } from "./prompts";
import { getLLMClient } from "../llm/client";
import { documentSearch } from "./tools/documentSearch";
import { dataLookup } from "./tools/dataLookup";
import { calculate } from "./tools/calculate";
import { draftAction } from "./tools/draftAction";
import OpenAI from "openai";

/**
 * We limit the loop to prevent runaway token usage.
 */
const MAX_ITERATIONS = 8;

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

/**
 * Gets the immutable reference time from the database.
 */
async function getReferenceTime(): Promise<Date> {
  const db = getDb();
  const rows = await db`SELECT value FROM system_metadata WHERE key = 'reference_time'`;
  if (rows.length > 0) {
    return extractReferenceTime(rows[0].value);
  }
  return new Date();
}

/**
 * Executes a tool based on the LLM's request.
 */
async function executeTool(ctx: AgentContext, name: string, argsStr: string): Promise<string> {
  let args: any;
  try {
    args = JSON.parse(argsStr);
  } catch (e) {
    return JSON.stringify({ error: "Invalid JSON arguments" });
  }

  try {
    switch (name) {
      case "document_search":
        return await documentSearch(ctx, { query: args.query, topicHint: args.topicHint ?? null });
      case "data_lookup":
        return await dataLookup(ctx, { entity: args.entity, id: args.id ?? null });
      case "calculate":
        return await calculate(ctx, { kind: args.kind, resourceId: args.resourceId, facts: args.facts ?? null });
      case "draft_action":
        return await draftAction(ctx, {
          type: args.type,
          params: {
            orderId: args.params?.orderId ?? null,
            ticketId: args.params?.ticketId ?? null,
            status: args.params?.status ?? null,
            priority: args.params?.priority ?? null,
            internalNote: args.params?.internalNote ?? null,
          },
          rationale: args.rationale,
        });
      default:
        return JSON.stringify({ error: `Tool ${name} not found or not authorized.` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: `Tool execution failed: ${e.message}` });
  }
}

// Manually defined tools — avoids zodFunction() schema incompatibilities
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "document_search",
      description: "Search for documents (agreements, policies, SOPs, known issues). Use this to find rules and answers.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Full sentence describing the question or issue to search for." },
          topicHint: { type: "string", description: "Optional topic hint to focus the search (e.g. 'cancellation', 'SLA'). Omit if not applicable." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "data_lookup",
      description: "Look up orders, tickets, or account details by their business ID. Support users may also list records: entity='tickets' or 'orders' with id=null returns the current workload across accounts (open/non-resolved items prioritized).",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["order", "ticket", "account", "orders", "tickets"],
            description: "The type of entity to look up.",
          },
          id: { type: "string", description: "Business ID (e.g. ORD-1001, TKT-2001). Omit (null) for list queries — support users get a cross-account list." },
        },
        required: ["entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Calculate cancellation fees, service credits, or SLA remaining. ALWAYS use this instead of doing math yourself.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["cancellation_fee", "service_credit", "sla_remaining"],
            description: "The type of calculation.",
          },
          resourceId: { type: "string", description: "Business ID of the resource (e.g. ORD-1001)." },
          facts: {
            type: "object",
            description: "Optional facts from documents that affect the calculation (e.g. fee waiver). Omit if none.",
            properties: {
              feeWaiver: { type: "boolean", description: "True if the agreement grants a fee waiver." },
              waived: { type: "boolean", description: "True if the fee has been explicitly waived." },
              standardFee: { type: "number", description: "Standard fee amount in USD from documents." },
            },
          },
        },
        required: ["kind", "resourceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_action",
      description: "Draft a state-changing action (cancel_order, update_ticket, create_escalation). Creates a pending action the user must confirm.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["cancel_order", "update_ticket", "create_escalation", "create_follow_up_task"],
            description: "The type of action to draft.",
          },
          params: {
            type: "object",
            description: "Action parameters.",
            properties: {
              orderId:      { type: "string", description: "For cancel_order: the order business ID (e.g. ORD-1001)." },
              ticketId:     { type: "string", description: "For update_ticket/create_escalation: ticket business ID." },
              status:       { type: "string", description: "For update_ticket: new status value." },
              priority:     { type: "string", description: "For update_ticket: new priority." },
              internalNote: { type: "string", description: "For update_ticket: internal note to add." },
            },
          },
          rationale: { type: "string", description: "Reason for this action, shown to the user for confirmation." },
        },
        required: ["type", "params", "rationale"],
      },
    },
  },
];

/**
 * The core agent loop.
 */
export async function runAgentLoop(ctx: AgentContext, messages: ChatMessage[]): Promise<ReadableStream> {
  const refTime = await getReferenceTime();
  const systemPrompt = getSystemPrompt(ctx, refTime);

  const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[])
  ];

  const llm = getLLMClient();

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        let iterations = 0;

        while (iterations < MAX_ITERATIONS) {
          iterations++;

          const response = await llm.chat.completions.create({
            model: config.llm.model,
            messages: conversation,
            tools: TOOLS,
            stream: true,
          });

          let currentMessage = "";
          const toolCalls: any[] = [];

          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              currentMessage += delta.content;
              sendEvent({ type: "token", content: delta.content });
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) {
                  toolCalls[tc.index] = {
                    id: tc.id,
                    type: "function",
                    function: { name: tc.function?.name ?? "", arguments: "" }
                  };
                }
                if (tc.function?.name && toolCalls[tc.index]) {
                  toolCalls[tc.index].function.name = tc.function.name;
                }
                if (tc.function?.arguments && toolCalls[tc.index]) {
                  toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            }
          }

          if (toolCalls.length === 0) {
            sendEvent({ type: "done" });
            break;
          }

          conversation.push({
            role: "assistant",
            content: currentMessage || null,
            tool_calls: toolCalls
          });

          for (const tc of toolCalls) {
            sendEvent({
              type: "tool_call",
              name: tc.function.name,
              arguments: tc.function.arguments
            });

            const result = await executeTool(ctx, tc.function.name, tc.function.arguments);

            sendEvent({
              type: "tool_result",
              name: tc.function.name,
              result
            });

            conversation.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result
            });
          }
        }

        if (iterations >= MAX_ITERATIONS) {
          sendEvent({ type: "error", content: "Agent loop limit reached." });
        }

      } catch (err: any) {
        console.error("Agent orchestrator error:", err);
        sendEvent({
          type: "error",
          content: "Assistant unavailable — please try again."
        });
      } finally {
        controller.close();
      }
    }
  });
}

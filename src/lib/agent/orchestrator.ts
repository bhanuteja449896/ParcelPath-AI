import { getDb } from "../data/client";
import { AgentContext } from "@/lib/types";
import { getSystemPrompt } from "./prompts";
import { getLLMClient } from "../llm/client";
import { documentSearch, documentSearchSchema } from "./tools/documentSearch";
import { dataLookup, dataLookupSchema } from "./tools/dataLookup";
import { calculate, calculateSchema } from "./tools/calculate";
import { draftAction, draftActionSchema } from "./tools/draftAction";
import { zodFunction } from "openai/helpers/zod";
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
 * Gets the immutable reference time from the database (simulating the current time for the scenario).
 */
async function getReferenceTime(): Promise<Date> {
  const db = getDb();
  const rows = await db`SELECT value FROM system_metadata WHERE key = 'reference_time'`;
  if (rows.length > 0) {
    return new Date(rows[0].value.replace(/"/g, ''));
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
      case "document_search": {
        const parsed = documentSearchSchema.parse(args);
        return await documentSearch(ctx, parsed);
      }
      case "data_lookup": {
        const parsed = dataLookupSchema.parse(args);
        return await dataLookup(ctx, parsed);
      }
      case "calculate": {
        const parsed = calculateSchema.parse(args);
        return await calculate(ctx, parsed);
      }
      case "draft_action": {
        const parsed = draftActionSchema.parse(args);
        return await draftAction(ctx, parsed);
      }
      default:
        return JSON.stringify({ error: `Tool ${name} not found or not authorized.` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: `Tool execution failed: ${e.message}` });
  }
}

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

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    zodFunction({
      name: "document_search",
      description: "Search for documents (agreements, policies, SOPs, known issues). Use this to find rules and answers.",
      parameters: documentSearchSchema,
    }),
    zodFunction({
      name: "data_lookup",
      description: "Look up orders, tickets, or account details. Provide the business ID (e.g., ORD-1001).",
      parameters: dataLookupSchema,
    }),
    zodFunction({
      name: "calculate",
      description: "Calculate cancellation fees, service credits, or SLA remaining. ALWAYS use this instead of doing math yourself.",
      parameters: calculateSchema,
    }),
    zodFunction({
      name: "draft_action",
      description: "Draft a state-changing action like cancel_order or update_ticket. This creates a pending action that the user must confirm.",
      parameters: draftActionSchema,
    })
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
            model: "gpt-4o", // Or preferred model
            messages: conversation,
            tools,
            stream: true,
          });

          let currentMessage = "";
          let toolCalls: any[] = [];
          
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
                    function: { name: tc.function?.name, arguments: "" }
                  };
                }
                if (tc.function?.arguments) {
                  toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            }
          }

          if (toolCalls.length === 0) {
            // No tools called, the loop is finished
            sendEvent({ type: "done" });
            break;
          }

          // We have tool calls
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
        sendEvent({ type: "error", content: err.message });
      } finally {
        controller.close();
      }
    }
  });
}

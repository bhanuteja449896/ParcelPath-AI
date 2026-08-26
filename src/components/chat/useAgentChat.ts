"use client";
/**
 * useAgentChat — client state machine over the /api/chat SSE stream.
 *
 * Backend event contract (orchestrator.ts):
 *   { type: "token", content }                       — answer delta
 *   { type: "tool_call", name, arguments }           — tool started
 *   { type: "tool_result", name, result }            — tool finished
 *   { type: "done" } | { type: "error", content }
 *
 * Sources are parsed from real document_search results; pending actions
 * from real draft_action results. No synthetic/fake activity is rendered.
 */
import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/agent/orchestrator";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UIToolCall {
  id: string;
  name: string;
  args: string;
  /** Raw tool result payload */
  result?: string;
  status: "running" | "completed" | "failed";
}

export interface UISource {
  citationId: string;
  title: string;
  authority: string;
  chunkText: string;
}

export interface UIPendingAction {
  pendingActionId: string;
  summary: string;
  actionType: string;
}

export interface UIEntity {
  kind: "order" | "ticket" | "account";
  id: string;
  detail?: Record<string, unknown>;
}

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  toolCalls?: UIToolCall[];
  sources?: UISource[];
  pendingAction?: UIPendingAction;
  error?: string;
  isComplete: boolean;
}

export interface ConversationMeta {
  sources: UISource[];
  entities: UIEntity[];
  pendingActions: UIPendingAction[];
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Result parsers (operate on actual backend payloads) ─────────────────────

/** Parses the "--- DOCUMENT CHUNK n ---" format emitted by formatChunksForLLM. */
export function parseSources(toolResult: string): UISource[] {
  if (!toolResult || !toolResult.includes("DOCUMENT CHUNK")) return [];
  const out: UISource[] = [];
  const blocks = toolResult.split(/--- DOCUMENT CHUNK \d+ ---/).slice(1);
  for (const block of blocks) {
    const citation = /\[Citation ID: ([^\]]+)\]/.exec(block)?.[1] ?? "";
    const title = /\[Title: ([^\]]+)\]/.exec(block)?.[1] ?? "Document";
    const authority = /\[Authority Tier: ([^\]()]+?)(?:\s*\(Precedence[^)]*\))?\]/.exec(block)?.[1]?.trim() ?? "";
    const bodyStart = block.indexOf("-----------------------------");
    const chunkText = (
      bodyStart >= 0 ? block.slice(bodyStart + 29) : block
    ).trim();
    if (citation || title) out.push({ citationId: citation, title, authority, chunkText });
  }
  return out;
}

function parseEntities(name: string, result: string): UIEntity[] {
  try {
    const parsed = JSON.parse(result);
    const r = parsed.result ?? parsed;
    if (name === "data_lookup" && r && typeof r === "object" && !Array.isArray(r)) {
      if (r.orderId) return [{ kind: "order", id: r.orderId, detail: r }];
      if (r.ticketId) return [{ kind: "ticket", id: r.ticketId, detail: r }];
      if (r.code) return [{ kind: "account", id: r.code, detail: r }];
    }
  } catch {
    /* not entity JSON */
  }
  return [];
}

function parsePendingAction(args: string, result: string): UIPendingAction | null {
  try {
    const parsed = JSON.parse(result);
    if (parsed?.status === "awaiting_confirmation" && parsed.pendingActionId) {
      let actionType = "action";
      try {
        actionType = JSON.parse(args)?.type ?? "action";
      } catch { /* keep default */ }
      return {
        pendingActionId: parsed.pendingActionId,
        summary: parsed.summary ?? "Confirm this action",
        actionType,
      };
    }
  } catch { /* not JSON */ }
  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patchAssistant = useCallback((id: string, patch: Partial<UIMessage> | ((m: UIMessage) => UIMessage)) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? (typeof patch === "function" ? patch(msg) : { ...msg, ...patch }) : msg
      )
    );
  }, []);

  const runStream = useCallback(
    async (history: UIMessage[]) => {
      // Build API payload from the visible conversation
      const payloadMessages: ChatMessage[] = history.flatMap((m) => {
        const msgs: ChatMessage[] = [
          { role: m.role, content: m.content },
        ];
        if (m.role === "assistant" && m.toolCalls?.length) {
          msgs[0] = {
            ...msgs[0],
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.args },
            })),
          };
          m.toolCalls.forEach((tc) => {
            if (tc.result !== undefined) {
              msgs.push({ role: "tool", tool_call_id: tc.id, content: tc.result });
            }
          });
        }
        return msgs;
      });

      setError(null);
      setIsLoading(true);

      const assistantId = newId();
      setMessages([
        ...history,
        { id: assistantId, role: "assistant", content: "", createdAt: Date.now(), isComplete: false },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payloadMessages }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(
            response.status === 401
              ? "Your session has expired. Please sign in again."
              : "ParcelPilot AI is temporarily unavailable."
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        const toolIndexRef: Record<number, number> = {}; // stream index → toolCalls array position

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();

            if (dataStr === "[DONE]") break;
            let event: any;
            try {
              event = JSON.parse(dataStr);
            } catch {
              continue;
            }

            switch (event.type) {
              case "token": {
                const delta = event.content as string;
                patchAssistant(assistantId, (m) => ({ ...m, content: m.content + delta }));
                break;
              }
              case "tool_call": {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    const calls = [...(msg.toolCalls ?? [])];
                    toolIndexRef[calls.length] = calls.length;
                    calls.push({
                      id: newId(),
                      name: event.name,
                      args: event.arguments,
                      status: "running",
                    });
                    return { ...msg, toolCalls: calls };
                  })
                );
                break;
              }
              case "tool_result": {
                const failed =
                  typeof event.result === "string" &&
                  /"error"\s*:/.test(event.result.slice(0, 60));
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    const calls = [...(msg.toolCalls ?? [])];
                    // Match the first running call with the same name
                    const idx = calls.findIndex(
                      (tc) => tc.name === event.name && tc.status === "running"
                    );
                    if (idx >= 0) calls[idx] = { ...calls[idx], result: event.result, status: failed ? "failed" : "completed" };

                    const next: UIMessage = { ...msg, toolCalls: calls };

                    if (!failed) {
                      const sources = parseSources(event.result);
                      const entities = parseEntities(event.name, event.result);
                      const pending =
                        event.name === "draft_action"
                          ? parsePendingAction(calls[idx]?.args ?? "{}", event.result)
                          : null;

                      if (sources.length) {
                        const existing = new Set((next.sources ?? []).map((s) => s.citationId));
                        next.sources = [...(next.sources ?? []), ...sources.filter((s) => !existing.has(s.citationId))];
                      }
                      if (entities.length) collectEntities(next, entities);
                      if (pending) next.pendingAction = pending;
                    }
                    return next;
                  })
                );
                break;
              }
              case "error": {
                patchAssistant(assistantId, {
                  error: event.content || "Something went wrong.",
                  isComplete: true,
                });
                setError(event.content || "Something went wrong.");
                break;
              }
              case "done":
                break;
            }
          }
        }

        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantId ? { ...msg, isComplete: true } : msg))
        );
      } catch (err: any) {
        if (err?.name === "AbortError") {
          // User stopped generation — keep partial content
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantId ? { ...msg, isComplete: true } : msg))
          );
        } else {
          const message =
            err?.message || "ParcelPilot AI is temporarily unavailable.";
          patchAssistant(assistantId, { error: message, isComplete: true });
          setError(message);
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [patchAssistant]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || isLoading) return;
      const userMessage: UIMessage = {
        id: newId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
        isComplete: true,
      };
      await runStream([...messages, userMessage]);
    },
    [messages, isLoading, runStream]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Re-runs the last user turn (retry after failure or regenerate). */
  const retry = useCallback(() => {
    if (isLoading || messages.length === 0) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    void runStream(messages.slice(0, lastUserIdx + 1));
  }, [messages, isLoading, runStream]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, stop, retry, reset };
}

// Side channel: attach entities to message objects without altering the public render shape
function collectEntities(msg: UIMessage, incoming: UIEntity[]) {
  const key = "__entities";
  const existing: UIEntity[] = ((msg as any)[key] as UIEntity[]) ?? [];
  const merged = [...existing];
  for (const e of incoming) {
    if (!merged.some((m) => m.kind === e.kind && m.id === e.id)) merged.push(e);
  }
  (msg as any)[key] = merged;
}

/** Extracts collected entities from a message (set during tool_result handling). */
export function getMessageEntities(msg: UIMessage): UIEntity[] {
  return ((msg as any)["__entities"] as UIEntity[]) ?? [];
}

/** Aggregated conversation metadata for context panels. */
export function getConversationMeta(messages: UIMessage[]): ConversationMeta {
  const meta: ConversationMeta = { sources: [], entities: [], pendingActions: [] };
  const seenSources = new Set<string>();
  const seenEntities = new Set<string>();
  for (const m of messages) {
    for (const s of m.sources ?? []) {
      if (!seenSources.has(s.citationId + s.title)) {
        seenSources.add(s.citationId + s.title);
        meta.sources.push(s);
      }
    }
    for (const e of getMessageEntities(m)) {
      const k = e.kind + e.id;
      if (!seenEntities.has(k)) {
        seenEntities.add(k);
        meta.entities.push(e);
      }
    }
    if (m.pendingAction) meta.pendingActions.push(m.pendingAction);
  }
  return meta;
}

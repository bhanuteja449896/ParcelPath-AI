import { useState, useRef, useCallback } from "react";
import { ChatMessage } from "@/lib/agent/orchestrator";

export type UIToolCall = {
  id: string;
  name: string;
  args: string;
  result?: string;
};

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: UIToolCall[];
  isComplete: boolean;
};

export function useAgentChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      isComplete: true,
    };

    setMessages((prev) => [...prev, userMessage]);

    // Build API payload
    const payloadMessages: ChatMessage[] = messages
      .concat(userMessage)
      .flatMap((m) => {
        const msgs: ChatMessage[] = [];
        msgs.push({
          role: m.role,
          content: m.content,
          tool_calls: m.toolCalls?.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.args },
          })),
        });
        
        if (m.toolCalls) {
          m.toolCalls.forEach((tc) => {
            if (tc.result) {
              msgs.push({
                role: "tool",
                tool_call_id: tc.id,
                content: tc.result,
              });
            }
          });
        }
        return msgs;
      });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message.");
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream.");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      // Initialize the assistant message
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", isComplete: false },
      ]);

      let currentAssistantMessage = "";
      let currentToolCalls: UIToolCall[] = [];
      let isDone = false;

      while (!isDone) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep the last partial line in the buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const dataStr = line.substring(6);
              if (dataStr === "[DONE]") {
                isDone = true;
                break;
              }

              const event = JSON.parse(dataStr);

              switch (event.type) {
                case "token":
                  currentAssistantMessage += event.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: currentAssistantMessage }
                        : msg
                    )
                  );
                  break;
                case "tool_call":
                  const tc: UIToolCall = {
                    id: crypto.randomUUID(), // we might not get the true id in streaming easily
                    name: event.name,
                    args: event.arguments,
                  };
                  currentToolCalls = [...currentToolCalls, tc];
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, toolCalls: currentToolCalls }
                        : msg
                    )
                  );
                  break;
                case "tool_result":
                  currentToolCalls = currentToolCalls.map((t) =>
                    t.name === event.name && t.result === undefined
                      ? { ...t, result: event.result }
                      : t
                  );
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, toolCalls: currentToolCalls }
                        : msg
                    )
                  );
                  break;
                case "done":
                  isDone = true;
                  break;
                case "error":
                  setError(event.content);
                  isDone = true;
                  break;
              }
            } catch (e) {
              console.warn("Failed to parse SSE line", line);
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, isComplete: true } : msg
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  return { messages, sendMessage, isLoading, error };
}

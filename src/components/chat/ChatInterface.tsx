"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentChat } from "./useAgentChat";
import { ToolTrace } from "./ToolTrace";
import { ActionCard } from "./ActionCard";

export function ChatInterface() {
  const { messages, sendMessage, isLoading, error } = useAgentChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  // Helper to extract drafted action JSON from the tool result
  const extractPendingAction = (toolCalls?: any[]) => {
    if (!toolCalls) return null;
    const draftTool = toolCalls.find(tc => tc.name === "draft_action" && tc.result);
    if (!draftTool) return null;
    try {
      const result = JSON.parse(draftTool.result);
      if (result.status === "awaiting_confirmation" && result.pendingActionId) {
        return {
          id: result.pendingActionId,
          summary: result.summary,
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-[600px] border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800">ParcelPath Support Agent</h2>
        <p className="text-xs text-slate-500">Ask me about your orders, tickets, or policies.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-10 text-sm">
            Send a message to start the conversation!
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const pendingAction = extractPendingAction(msg.toolCalls);

          return (
            <div key={msg.id || idx} className="flex flex-col">
              {!isUser && msg.toolCalls?.map((tc, tidx) => (
                <ToolTrace key={tidx} tool={tc} />
              ))}
              
              {msg.content && (
                <div className={`flex ${isUser ? "justify-end" : "justify-start"} mt-1`}>
                  <div 
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                      isUser 
                        ? "bg-blue-600 text-white rounded-br-none" 
                        : "bg-slate-100 text-slate-800 rounded-bl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              )}

              {/* Render action card if this message contains a drafted action */}
              {!isUser && pendingAction && (
                <div className="mt-2 ml-2 mr-10">
                  <ActionCard 
                    pendingActionId={pendingAction.id} 
                    summary={pendingAction.summary} 
                  />
                </div>
              )}
            </div>
          );
        })}

        {error && (
          <div className="text-red-500 text-xs text-center my-2 p-2 bg-red-50 rounded">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or request an action..."
          disabled={isLoading}
          className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-blue-600 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

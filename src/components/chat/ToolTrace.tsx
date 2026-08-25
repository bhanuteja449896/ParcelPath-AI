"use client";
import { UIToolCall } from "./useAgentChat";

export function ToolTrace({ tool }: { tool: UIToolCall }) {
  const isSearch = tool.name === "document_search";
  const isLookup = tool.name === "data_lookup";
  const isCalc = tool.name === "calculate";
  const isDraft = tool.name === "draft_action";

  const getIcon = () => {
    if (isSearch) return "🔍";
    if (isLookup) return "📦";
    if (isCalc) return "🧮";
    if (isDraft) return "✍️";
    return "🔧";
  };

  const getActionText = () => {
    try {
      const args = JSON.parse(tool.args || "{}");
      if (isSearch) return `Searched for "${args.query}"`;
      if (isLookup) return `Looked up ${args.entity} ${args.id || ""}`;
      if (isCalc) return `Calculated ${args.kind} for ${args.resourceId}`;
      if (isDraft) return `Drafted ${args.type} action`;
    } catch {
      return `Called ${tool.name}`;
    }
    return `Called ${tool.name}`;
  };

  return (
    <div className="flex flex-col gap-1 my-2 mx-12 text-xs">
      <div className="flex items-center gap-2 text-slate-500 font-medium">
        <span>{getIcon()}</span>
        <span>{getActionText()}</span>
        {!tool.result && (
          <span className="flex gap-1 ml-1">
            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
      
      {/* We can optionally render citations if this is a search result */}
      {isSearch && tool.result && (
        <div className="pl-6 flex flex-wrap gap-1 mt-1">
          {/* We would parse the formatChunksForLLM output here to display citation chips. */}
          {/* For simplicity in this iteration, we just show a generic 'Documents retrieved' badge if there are any. */}
          {tool.result.includes("DOCUMENT CHUNK") && (
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] border border-slate-200">
              Documents Retrieved
            </span>
          )}
        </div>
      )}
    </div>
  );
}

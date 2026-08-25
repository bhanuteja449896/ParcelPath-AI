"use client";

import { useState } from "react";

export function ActionCard({ pendingActionId, summary }: { pendingActionId: string, summary: string }) {
  const [status, setStatus] = useState<"pending" | "executing" | "executed" | "cancelled" | "failed">("pending");
  const [message, setMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("executing");
    try {
      const res = await fetch(`/api/actions/${pendingActionId}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("executed");
        setMessage(data.message || "Action executed successfully.");
      } else {
        setStatus("failed");
        setMessage(data.error || "Failed to confirm action.");
      }
    } catch (err: any) {
      setStatus("failed");
      setMessage(err.message || "Network error.");
    }
  }

  async function handleDecline() {
    setStatus("executing");
    try {
      const res = await fetch(`/api/actions/${pendingActionId}/decline`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("cancelled");
        setMessage(data.message || "Action declined.");
      } else {
        setStatus("failed");
        setMessage(data.error || "Failed to decline action.");
      }
    } catch (err: any) {
      setStatus("failed");
      setMessage(err.message || "Network error.");
    }
  }

  return (
    <div className="my-4 p-4 border border-blue-200 bg-blue-50/50 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-blue-900 text-sm tracking-tight flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Pending Action
        </h4>
        {status === "pending" && (
          <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Awaiting Confirmation</span>
        )}
      </div>
      
      <p className="text-sm text-slate-700 mb-4 font-medium">{summary}</p>
      
      {status === "pending" && (
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded text-sm transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded text-sm transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {status === "executing" && (
        <div className="text-sm text-slate-500 animate-pulse flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          Executing...
        </div>
      )}

      {(status === "executed" || status === "cancelled" || status === "failed") && (
        <div className={`text-sm p-2 rounded ${
          status === "executed" ? "bg-green-50 text-green-700 border border-green-200" :
          status === "cancelled" ? "bg-slate-100 text-slate-600 border border-slate-200" :
          "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}

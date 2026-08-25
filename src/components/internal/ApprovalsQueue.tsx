"use client";

import { useEffect, useState } from "react";
import { PendingAction } from "@/lib/data/repositories/pendingActionsRepo";
import { ActionCard } from "../chat/ActionCard";

export function ApprovalsQueue() {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal/pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setActions(data.actions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 animate-pulse">Loading approvals queue...</div>;
  if (error) return <div className="text-sm text-red-500">Error: {error}</div>;

  if (actions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
        No pending actions require your approval.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">
            {actions.length}
          </span>
          Actions Awaiting Approval
        </h3>
        <button onClick={fetchActions} className="text-xs text-blue-600 hover:underline">
          Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {actions.map(action => (
          <div key={action.id} className="relative">
            <div className="absolute top-4 right-4 text-xs text-slate-500 z-10 font-medium">
              Requested by {action.userId}
            </div>
            {/* Reusing ActionCard handles the confirmation flow. Once confirmed, they can hit refresh. */}
            <ActionCard 
              pendingActionId={action.id} 
              summary={action.displaySummary} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Finding } from "@/lib/data/repositories/issuesRepo";

export function IssuesDashboard() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFindings();
  }, []);

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal/issues");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setFindings(data.findings || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 animate-pulse p-6">Running analytics heuristics...</div>;
  if (error) return <div className="text-sm text-red-500 p-6">Error: {error}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Proactive Insights
        </h3>
        <button onClick={fetchFindings} className="text-xs text-blue-600 hover:underline">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {findings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
            No active issues detected across the network.
          </div>
        ) : (
          findings.map((finding, i) => (
            <div key={i} className={`p-4 border rounded-lg bg-white shadow-sm flex flex-col gap-3 ${
              finding.severity === 'critical' ? 'border-red-200' :
              finding.severity === 'high' ? 'border-orange-200' : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    finding.severity === 'critical' ? 'bg-red-500 animate-pulse' :
                    finding.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-400'
                  }`} />
                  {finding.title}
                </h4>
                <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {finding.window}
                </span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {finding.evidence.map((ev, idx) => (
                  <span key={idx} className="text-xs font-mono bg-slate-50 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                    {ev.ticket_id || ev.order_id || ev.account_code}
                  </span>
                ))}
              </div>

              <div className="bg-slate-50 rounded p-2 text-sm text-slate-700 flex justify-between items-center border border-slate-100 mt-1">
                <span><span className="font-semibold text-slate-500 mr-1">Suggested:</span> {finding.suggested_next}</span>
                <button 
                  onClick={() => {
                    // Quick and dirty copy to clipboard or alert to instruct agent
                    alert(`Copied to clipboard: "${finding.suggested_next}"\nPaste this in the Copilot to draft the action!`);
                    navigator.clipboard.writeText(finding.suggested_next);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Action ↗
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

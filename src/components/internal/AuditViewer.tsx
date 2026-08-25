"use client";

import { useEffect, useState } from "react";
import { AuditEvent } from "@/lib/data/repositories/auditRepo";

export function AuditViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal/audit");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 animate-pulse">Loading audit logs...</div>;
  if (error) return <div className="text-sm text-red-500">Error: {error}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">System Audit Log</h3>
        <button onClick={fetchLogs} className="text-xs text-blue-600 hover:underline">
          Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.occurred_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{log.actor_role}</div>
                      <div className="text-xs text-slate-500 truncate w-32" title={log.actor_user_id}>
                        {log.actor_user_id}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {log.action}
                    </td>
                    <td className="px-4 py-3">
                      {log.resource_type ? (
                        <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                          {log.resource_type} {log.resource_id}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        log.outcome === 'success' ? 'bg-green-100 text-green-700' :
                        log.outcome === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

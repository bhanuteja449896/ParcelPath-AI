import { redirect } from "next/navigation";
import postgres from "postgres";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ApprovalsQueue } from "@/components/internal/ApprovalsQueue";
import { AuditViewer } from "@/components/internal/AuditViewer";
import { IssuesDashboard } from "@/components/internal/IssuesDashboard";

export const metadata: Metadata = {
  title: "Internal Console — ParcelPilot",
};

export default async function InternalPage() {
  const token = await getSessionTokenFromCookieStore();
  if (!token) redirect("/login");

  const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
  let ctx;
  try {
    ctx = await resolveSession(sql as unknown as Parameters<typeof resolveSession>[0], token);
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (!ctx) redirect("/login");
  if (ctx.category !== "support") redirect("/unauthorized");

  const isManager = ctx.role === "ops_manager";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner">
            P
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">ParcelPilot <span className="text-slate-400 font-normal">| Support</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-slate-300">
            {ctx.userId} <span className="text-blue-400">({ctx.role})</span>
          </div>
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Support Agent Copilot & Insights */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <section className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm">
            <IssuesDashboard />
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <ChatInterface />
          </section>
        </div>

        {/* Manager Tools */}
        <div className="xl:col-span-2 flex flex-col gap-8">
          {isManager ? (
            <>
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <ApprovalsQueue />
              </section>
              
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <AuditViewer />
              </section>
            </>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-slate-800 mb-2">Manager Access Required</h2>
              <p className="text-slate-500 max-w-sm">
                The Approvals Queue and System Audit Log are restricted to operations managers.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

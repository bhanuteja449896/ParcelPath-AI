/**
 * Root page — redirects by session category (ARCHITECTURE.md SS4, TASKS.md T09).
 * Authenticated customers land here; support users go to /internal.
 * No-auth → /login (handled by middleware, but also guarded here for SSR).
 */
import { redirect } from "next/navigation";
import postgres from "postgres";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";
import { ChatInterface } from "@/components/chat/ChatInterface";

export default async function RootPage() {
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

  // Support users should be at /internal
  if (ctx.category === "support") redirect("/internal");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner">
            P
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">ParcelPilot</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-slate-600">
            Welcome, {ctx.userId} <span className="text-slate-400 font-normal">({ctx.role})</span>
          </div>
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Support Assistant</h2>
            <ChatInterface />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Quick Tips
            </h3>
            <ul className="text-sm text-slate-600 space-y-3 font-medium">
              <li>• Need to cancel an order? Just ask the assistant and it will calculate any applicable fees.</li>
              <li>• You can check the status of your existing support tickets.</li>
              <li>• The assistant knows your specific Enterprise SLAs.</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

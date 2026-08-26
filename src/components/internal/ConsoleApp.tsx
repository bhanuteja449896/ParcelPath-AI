"use client";
/**
 * ConsoleApp — internal support/operations shell.
 * Collapsible sidebar on desktop; drawer navigation on mobile.
 * Role gating is mirrored in the UI only — every API enforces permissions
 * server-side regardless of what this UI renders.
 */
import { useCallback, useState } from "react";
import { useAgentChat } from "@/components/chat/useAgentChat";
import { Logo, ThemeToggle, UserMenu } from "@/components/navigation/UserMenu";
import { ToastProvider } from "@/components/ui/Toast";
import { Icon, type IconName } from "@/components/ui/icons";
import { OverviewView } from "./OverviewView";
import { IssuesView } from "./IssuesView";
import { TicketsView } from "./TicketsView";
import { OrdersView } from "./OrdersView";
import { ApprovalsView } from "./ApprovalsView";
import { AuditView } from "./AuditView";
import { SupportChatView } from "./SupportChatView";

type ViewId = "overview" | "chat" | "tickets" | "orders" | "issues" | "approvals" | "audit";

const NAV: { id: ViewId; label: string; icon: IconName; managerOnly?: boolean }[] = [
  { id: "overview", label: "Overview", icon: "Grid" },
  { id: "chat", label: "AI Support", icon: "Sparkle" },
  { id: "tickets", label: "Tickets", icon: "Ticket" },
  { id: "orders", label: "Orders", icon: "Package" },
  { id: "issues", label: "Proactive Issues", icon: "Activity" },
  { id: "approvals", label: "Approvals", icon: "ListChecks", managerOnly: true },
  { id: "audit", label: "Audit log", icon: "Shield", managerOnly: true },
];

export function ConsoleApp({
  identity,
  isManager,
}: {
  identity: { name: string; role: string };
  isManager: boolean;
}) {
  const chat = useAgentChat();
  const [view, setView] = useState<ViewId>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);

  const items = NAV.filter((n) => !n.managerOnly || isManager);

  const navigate = useCallback((v: ViewId) => {
    setView(v);
    setMobileNavOpen(false);
  }, []);

  const draftInChat = useCallback((text: string) => {
    setPrefill(text);
    setView("chat");
  }, []);

  const renderNav = (compact: boolean) => (
    <nav aria-label="Console sections" className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const Ico = Icon[item.icon];
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            aria-current={active ? "page" : undefined}
            title={compact ? item.label : undefined}
            className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors ${
              active
                ? "bg-brand-soft text-brand-ink"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            } ${compact ? "justify-center px-0" : ""}`}
          >
            <Ico size={16} className="shrink-0" />
            {!compact && item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-canvas">
        {/* Desktop sidebar */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${
            collapsed ? "w-[68px]" : "w-[232px]"
          }`}
        >
          <div className={`flex h-14 shrink-0 items-center border-b border-line ${collapsed ? "justify-center px-2" : "px-4"}`}>
            {collapsed ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-on-brand">
                <Icon.Logo size={17} />
              </span>
            ) : (
              <Logo />
            )}
          </div>

          <div className="py-3">
            {renderNav(collapsed)}
          </div>

          <div className="mt-auto flex flex-col gap-1 p-3">
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-9 items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Icon.Sidebar size={15} />
              {!collapsed && "Collapse"}
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              {/* Mobile nav trigger */}
              <button
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                className="-ml-1 rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-2 md:hidden"
              >
                <Icon.Menu size={18} />
              </button>
              <h1 className="truncate text-[15px] font-semibold text-ink">
                {items.find((i) => i.id === view)?.label ?? "Overview"}
              </h1>
              <span className="hidden rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium capitalize text-brand-ink lg:inline">
                ParcelPilot Ops · {identity.role.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle className="hidden sm:inline-flex" />
              <UserMenu name={identity.name} role={identity.role} category="support" />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-hidden">
            {view === "overview" && (
              <OverviewView isManager={isManager} onNavigate={navigate} />
            )}
            {view === "chat" && (
              <SupportChatView chat={chat} identity={identity} prefill={prefill} onPrefillConsumed={() => setPrefill(null)} />
            )}
            {view === "issues" && <IssuesView onDraftInChat={draftInChat} />}
            {view === "tickets" && <TicketsView onAskAI={draftInChat} />}
            {view === "orders" && <OrdersView onAskAI={draftInChat} />}
            {view === "approvals" && isManager && <ApprovalsView />}
            {view === "audit" && isManager && <AuditView />}
          </main>
        </div>

        {/* Mobile navigation drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 animate-overlay-in bg-ink/40"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-sheet-in-right flex-col bg-surface shadow-sheet"
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
                <Logo />
                <button
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <Icon.X size={16} />
                </button>
              </div>
              <div className="py-3">
                {renderNav(false)}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-line p-4">
                <span className="text-[12px] text-ink-3">Appearance</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}

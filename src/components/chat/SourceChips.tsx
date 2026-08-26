"use client";
/**
 * Source chips + preview sheet.
 * Chips render the actual documents returned by document_search; clicking one
 * opens a preview with the relevant passage and its authority tier.
 */
import { useState } from "react";
import type { UISource } from "./useAgentChat";
import { Sheet } from "@/components/ui/Sheet";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/icons";

const AUTHORITY_META: Record<string, { label: string; tone: BadgeTone }> = {
  customer_agreement: { label: "Customer agreement", tone: "info" },
  current_policy: { label: "Current policy", tone: "success" },
  sop: { label: "SOP", tone: "success" },
  product_guide: { label: "Product guide", tone: "neutral" },
  known_issues: { label: "Known issues", tone: "warning" },
};

function authorityMeta(authority: string) {
  return (
    AUTHORITY_META[authority] ?? { label: authority ? authority.replace(/_/g, " ") : "Source", tone: "neutral" as BadgeTone }
  );
}

export function SourceChips({
  sources,
  className,
}: {
  sources: UISource[];
  className?: string;
}) {
  const [active, setActive] = useState<UISource | null>(null);

  if (!sources.length) return null;

  return (
    <>
      <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Sources</span>
        {sources.map((source) => {
          const meta = authorityMeta(source.authority);
          return (
            <button
              key={source.citationId || source.title}
              onClick={() => setActive(source)}
              className="group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 shadow-card transition-colors hover:border-brand/40 hover:text-brand-ink"
              aria-haspopup="dialog"
            >
              <Icon.Doc size={12} className="shrink-0 text-ink-3 transition-colors group-hover:text-brand-ink" />
              <span className="truncate">{source.title}</span>
              <span className="hidden shrink-0 text-[10.5px] text-ink-3 sm:inline">· {meta.label}</span>
            </button>
          );
        })}
      </div>

      <Sheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={active?.title ?? ""}
        description="Retrieved source"
        footer={<CopyButton text={active?.chunkText ?? ""} label="Copy passage" />}
      >
        {active && (
          <div className="flex flex-col gap-4">
            <Badge tone={authorityMeta(active.authority).tone}>
              Authority: {authorityMeta(active.authority).label}
            </Badge>
            <figure>
              <figcaption className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Relevant section
              </figcaption>
              <blockquote className="whitespace-pre-wrap rounded-xl border border-line bg-surface-inset p-4 text-[13px] leading-relaxed text-ink-2">
                {active.chunkText}
              </blockquote>
            </figure>
            <p className="text-[12px] leading-relaxed text-ink-3">
              Answers are grounded in this passage. If multiple documents apply, ParcelPilot
              prioritizes customer agreements over general policy.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}

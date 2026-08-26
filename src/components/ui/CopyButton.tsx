"use client";
/**
 * CopyButton — copy-to-clipboard with "Copied" micro-interaction.
 */
import { useEffect, useState } from "react";
import { Icon } from "./icons";

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* clipboard unavailable — fail silently */
        }
      }}
      aria-label={copied ? "Copied" : label}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink ${className ?? ""}`}
    >
      {copied ? (
        <>
          <Icon.Check size={13} className="text-success" />
          <span className="text-success">Copied</span>
        </>
      ) : (
        <>
          <Icon.Copy size={13} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

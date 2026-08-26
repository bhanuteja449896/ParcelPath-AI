/**
 * ParcelPilot icon set. Minimal stroke icons, 24px grid, currentColor.
 * Usage: <Icon.Send className="w-4 h-4" />
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const Icon = {
  Logo(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
        <path d="M3 7l9 5 9-5" />
        <path d="M12 22V12" />
        <path d="m7.5 4.5 9 5" opacity={0.55} />
      </svg>
    );
  },
  Send(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M5 12h14" />
        <path d="M12 5l7 7-7 7" />
      </svg>
    );
  },
  Stop(props: IconProps) {
    return (
      <svg {...base(props)}>
        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
      </svg>
    );
  },
  Copy(props: IconProps) {
    return (
      <svg {...base(props)}>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    );
  },
  Check(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  },
  X(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  },
  Refresh(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    );
  },
  ChevronDown(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  },
  ChevronRight(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  },
  Menu(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    );
  },
  Search(props: IconProps) {
    return (
      <svg {...base(props)}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    );
  },
  Package(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
        <path d="M3 7l9 5 9-5" />
        <path d="M12 22V12" />
      </svg>
    );
  },
  Ticket(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
        <path d="M13 6v2M13 11v2M13 16v2" />
      </svg>
    );
  },
  Calculator(props: IconProps) {
    return (
      <svg {...base(props)}>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" />
      </svg>
    );
  },
  Doc(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
        <path d="M14 2v6h6M9 13h6M9 17h6" />
      </svg>
    );
  },
  Sparkle(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" opacity={0.6} />
        <path d="M12 8.5 13.2 11l2.6 1.2-2.6 1.2L12 16l-1.2-2.6L8.2 12.2 10.8 11 12 8.5Z" fill="currentColor" stroke="none" />
      </svg>
    );
  },
  Shield(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    );
  },
  Alert(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  },
  Info(props: IconProps) {
    return (
      <svg {...base(props)}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    );
  },
  Logout(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
    );
  },
  User(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  },
  Sun(props: IconProps) {
    return (
      <svg {...base(props)}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  },
  Moon(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  },
  Clock(props: IconProps) {
    return (
      <svg {...base(props)}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  },
  PanelRight(props: IconProps) {
    return (
      <svg {...base(props)}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M15 3v18" />
      </svg>
    );
  },
  Sidebar(props: IconProps) {
    return (
      <svg {...base(props)}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
      </svg>
    );
  },
  ThumbsUp(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
      </svg>
    );
  },
  ThumbsDown(props: IconProps) {
    return (
      <svg {...base({ ...props, style: { transform: "rotate(180deg)", ...(props.style ?? {}) } })}>
        <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
      </svg>
    );
  },
  Grid(props: IconProps) {
    return (
      <svg {...base(props)}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  },
  ListChecks(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8" opacity={0} />
        <path d="m3 5 2 2 3.5-3.5M3 12.5l2 2 3.5-3.5M3 20l2 2 3.5-3.5" />
        <path d="M12 5h9M12 13.5h9M12 22h9" opacity={0.75} />
      </svg>
    );
  },
  Activity(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  },
  ArrowLeft(props: IconProps) {
    return (
      <svg {...base(props)}>
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    );
  },
};

export type IconName = keyof typeof Icon;

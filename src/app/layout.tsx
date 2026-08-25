/**
 * Root layout (ARCHITECTURE.md SS34).
 * Minimal shell — no marketing content, redirects by session category.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ParcelPilot AI Support",
  description: "AI-powered parcel tracking and support system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

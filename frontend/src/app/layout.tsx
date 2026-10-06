import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsightForge AI — AI-powered business analytics",
  description: "Upload business data and get analytics, forecasts and AI-driven insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

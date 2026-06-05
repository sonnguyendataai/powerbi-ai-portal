import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "DataMind Power BI AI Portal",
  description: "Enterprise analytics portal powered by Power BI, AI agents, and governed workflows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

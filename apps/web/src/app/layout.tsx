import type { ReactNode } from "react";
import { ThemeLanguageProvider } from "@/components/ThemeLanguageProvider";
import "./globals.css";

export const metadata = {
  title: "DataMind Power BI AI Portal",
  description: "Enterprise analytics portal powered by Power BI, AI agents, and governed workflows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeLanguageProvider>
          {children}
        </ThemeLanguageProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SettingsApplier, noFlashScript } from "@/features/ui/SettingsApplier";
import "./globals.css";

export const metadata: Metadata = { title: "Workspace", description: "Visual change-impact management" };
export const viewport: Viewport = { colorScheme: "light dark", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: noFlashScript }} /></head>
      <body>
        <SettingsApplier />
        {children}
      </body>
    </html>
  );
}

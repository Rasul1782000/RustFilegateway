import "./globals.css";
import type { ReactNode } from "react";
import Providers from "./providers";

export const metadata = {
  title: "File Gateway",
  description:
    "Pure-Rust file management with content-defined chunking, deduplication and intelligent compression",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

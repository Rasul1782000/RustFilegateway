import "./globals.css";
import type { ReactNode } from "react";
import Providers from "./providers";

export const metadata = {
  title: "File Gateway",
  description: "Pure-Rust file management with deduplication and compression",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

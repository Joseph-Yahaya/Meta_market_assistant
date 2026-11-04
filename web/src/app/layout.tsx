import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AI Market Assistant",
  description: "Inventory assistance and nearby shop discovery for Nigerian markets.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

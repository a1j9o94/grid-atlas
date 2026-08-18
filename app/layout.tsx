import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AtlasApp from "../components/AtlasApp";

export const metadata: Metadata = {
  title: "How your electricity works — an explorable map",
  description:
    "Who runs the grid where you live, in four layers. An explorable map of America's electricity system.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E",
  },
};

// The map lives in the layout, not the page: layouts persist across
// navigations, so the SVG (zoom state, lazily inked wires geometry, tweens)
// never remounts while the route changes under it.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AtlasApp />
        {children}
      </body>
    </html>
  );
}

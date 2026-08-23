import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AtlasApp from "../components/AtlasApp";

export const metadata: Metadata = {
  title: "How electricity reaches you: an explorable map",
  description:
    "See who coordinates wholesale markets, who sets state rules, and who owns local wires. Explore five layers of America's electricity system.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E",
  },
};

// There was no viewport export at all, which meant every env(safe-area-inset-*)
// in globals.css would have evaluated to zero: the insets are opt-in, and the
// opt-in is viewport-fit=cover. Cover lets the evidence sheet reach the glass
// instead of sitting inside letterbox bars on a notched phone. In exchange
// every box holding a control has to pad itself back out of the notch, which
// is what the max(12px, env(…)) padding on body does.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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

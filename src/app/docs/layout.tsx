import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Docs | Roc Candy",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return children;
}

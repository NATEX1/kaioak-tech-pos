import type { ReactNode } from "react";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh print:min-h-0">{children}</div>;
}

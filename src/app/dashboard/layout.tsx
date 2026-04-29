import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, MessageSquare } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b px-4 py-4">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">
            Gemini Construcción
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2">
          <Link
            href={{ pathname: "/dashboard/chat" }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <MessageSquare className="h-4 w-4" />
            Auditoría IA
          </Link>
        </nav>

        {/* Footer */}
        <div className="border-t px-4 py-3">
          <p className="text-[11px] text-muted-foreground">
            Gemini Construcción · v0.2.0
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}

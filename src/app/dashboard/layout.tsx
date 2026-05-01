import type { ReactNode } from "react";
import Link from "next/link";
import { MessageSquare, Database } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SessionProvider } from "@/contexts/SessionContext";
import { DashboardSidebar } from "@/components/chat/DashboardSidebar";
import { UserMenu } from "@/components/chat/UserMenu";
import { AdminNavLink } from "@/components/chat/AdminNavLink";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <aside className="flex w-60 shrink-0 flex-col border-r bg-card">

          {/* Brand block */}
          <div className="flex items-center gap-2.5 border-b px-4 py-4">
            {/* "E" mark — terracotta square, Fraunces italic */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-primary text-primary-foreground">
              <span className="font-display text-[15px] font-semibold italic leading-none select-none">E</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-[15px] font-medium tracking-[-0.01em]">EdificIA</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-muted-foreground">
                v0.6 · construcción
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-0.5 p-2">
            <Link
              href={{ pathname: "/dashboard/chat" }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Asistente de Obra
            </Link>
            <Link
              href={{ pathname: "/dashboard/documents" }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Database className="h-3.5 w-3.5" />
              Base Documental
            </Link>
            {/* Admin link — only visible when role === 'admin' */}
            <AdminNavLink />
          </nav>

          {/* Session history */}
          <div className="flex-1 overflow-hidden border-t py-2">
            <DashboardSidebar />
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t px-3 py-3">
            <UserMenu />
            <div className="flex items-center justify-between px-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">EdificIA · v0.6</p>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </SessionProvider>
  );
}

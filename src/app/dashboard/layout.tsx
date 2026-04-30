import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, MessageSquare, Shield } from "lucide-react";
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
          {/* Logo */}
          <div className="flex items-center gap-2.5 border-b px-4 py-4">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold tracking-tight">EdificIA</span>
          </div>

          {/* Nav */}
          <nav className="space-y-0.5 p-2">
            <Link
              href={{ pathname: "/dashboard/chat" }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <MessageSquare className="h-4 w-4" />
              Auditoría IA
            </Link>
            {/* Admin link — only visible when role === 'admin' */}
            <AdminNavLink />
          </nav>

          {/* Session history — client component */}
          <div className="flex-1 overflow-hidden border-t py-2">
            <DashboardSidebar />
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t px-3 py-3">
            <UserMenu />
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-muted-foreground">EdificIA · v0.6.0</p>
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

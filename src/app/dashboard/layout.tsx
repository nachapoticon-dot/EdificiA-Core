import type { ReactNode } from "react";
import { BriefcaseBusiness, MessageSquare, Database, Building2 } from "lucide-react";
import { SessionProvider } from "@/contexts/SessionContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DashboardSidebar } from "@/components/chat/sidebar/DashboardSidebar";
import { ActiveProjectSection } from "@/components/chat/sidebar/ActiveProjectSection";
import { UserMenu } from "@/components/chat/sidebar/UserMenu";
import { AdminNavLink } from "@/components/chat/sidebar/AdminNavLink";
import { OrganizationCard } from "@/components/chat/sidebar/OrganizationCard";
import { NavLink } from "@/components/chat/sidebar/NavLink";
import { AuthWatcher } from "@/components/auth/AuthWatcher";
import { MobileMenuButton } from "@/components/chat/sidebar/MobileMenuButton";
import { MobileSidebarOverlay } from "@/components/chat/sidebar/MobileSidebarOverlay";

function SidebarContent() {
  return (
    <>
      {/* Brand block */}
      <div className="border-b border-sidebar-border px-3 py-3">
        <div className="rounded-[8px] border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-foreground text-background shadow-sm">
              <span className="font-display text-[20px] font-semibold italic leading-none select-none">E</span>
              <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-primary" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block font-display text-[18px] font-medium tracking-[-0.01em] text-sidebar-foreground">
                EdificIA
              </span>
              <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground">
                Operaciones de obra
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-sidebar-border pt-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">v0.6</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary">Autónomo</span>
          </div>
        </div>
      </div>

      {/* Organization info card */}
      <div className="px-0 pt-2 pb-1">
        <OrganizationCard />
      </div>

      {/* Nav */}
      <nav className="space-y-1 p-2">
        <NavLink href="/dashboard/chat" icon={<MessageSquare className="h-3.5 w-3.5" />} label="Asistente de Obra" />
        <NavLink href="/dashboard/obras" icon={<Building2 className="h-3.5 w-3.5" />} label="Mis Obras" />
        <NavLink href="/dashboard/expedientes" icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Expedientes" />
        <NavLink href="/dashboard/documents" icon={<Database className="h-3.5 w-3.5" />} label="Base Documental" />
        <AdminNavLink />
      </nav>

      {/* Proyecto activo — shown when a project is selected */}
      <div className="border-t pt-2">
        <ActiveProjectSection />
      </div>

      {/* Session history */}
      <div className="flex-1 overflow-hidden border-t py-2">
        <DashboardSidebar />
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t px-3 py-3">
        <UserMenu />
        <div className="flex items-center justify-between px-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">EdificIA · v0.6</p>
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ProjectProvider>
        <SidebarProvider>
          <AuthWatcher />
          <div className="flex h-screen overflow-hidden bg-background ed-blueprint-bg">

            {/* Desktop sidebar — hidden on mobile */}
            <aside className="ed-rail hidden w-64 shrink-0 flex-col border-r bg-sidebar/95 shadow-sm lg:flex">
              <SidebarContent />
            </aside>

            {/* Mobile sidebar overlay */}
            <MobileSidebarOverlay>
              <SidebarContent />
            </MobileSidebarOverlay>

            {/* Main */}
            <main className="flex flex-1 flex-col overflow-hidden">
              {/* Mobile top bar */}
              <div className="flex h-[52px] shrink-0 items-center border-b bg-background/80 px-4 backdrop-blur lg:hidden">
                <MobileMenuButton />
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
            </main>

          </div>
        </SidebarProvider>
      </ProjectProvider>
    </SessionProvider>
  );
}

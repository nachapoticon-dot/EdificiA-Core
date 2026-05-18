import type { ReactNode } from "react";
import { BriefcaseBusiness, MessageSquare, Database, Building2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-foreground text-background shadow-sm">
          <span className="font-display text-[15px] font-semibold italic leading-none select-none">E</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[16px] font-medium">EdificIA</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-muted-foreground">
            v0.6 · construcción
          </span>
        </div>
        </div>
        <div className="mt-3 h-1 rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full bg-primary" />
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
          <ThemeToggle />
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

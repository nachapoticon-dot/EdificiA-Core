import type { ReactNode } from "react";
import { BriefcaseBusiness, Building2, FileText, MessageSquare } from "lucide-react";
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
                Auditoría de obra
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-0 pt-2 pb-1">
        <OrganizationCard />
      </div>

      <nav className="space-y-1 p-2">
        <NavLink href="/dashboard/chat" icon={<MessageSquare className="h-3.5 w-3.5" />} label="Chat" />
        <NavLink href="/dashboard/obras" icon={<Building2 className="h-3.5 w-3.5" />} label="Obras" />
        <NavLink href="/dashboard/expedientes" icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Expedientes" />
        <NavLink href="/dashboard/documents" icon={<FileText className="h-3.5 w-3.5" />} label="Documentos" />
        <AdminNavLink />
      </nav>

      <div className="border-t pt-2">
        <ActiveProjectSection />
      </div>

      <div className="flex-1 overflow-hidden border-t py-2">
        <DashboardSidebar />
      </div>

      <div className="flex flex-col gap-2 border-t px-3 py-3">
        <UserMenu />
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

            <aside className="ed-rail hidden w-64 shrink-0 flex-col border-r bg-sidebar/95 shadow-sm lg:flex">
              <SidebarContent />
            </aside>

            <MobileSidebarOverlay>
              <SidebarContent />
            </MobileSidebarOverlay>

            <main className="flex flex-1 flex-col overflow-hidden">
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

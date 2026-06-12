import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Activity, BriefcaseBusiness, MessageSquare, Building2 } from "lucide-react";
import { SessionProvider } from "@/contexts/SessionContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/chat/sidebar/DashboardSidebar";
import { ActiveProjectSection } from "@/components/chat/sidebar/ActiveProjectSection";
import { UserMenu } from "@/components/chat/sidebar/UserMenu";
import { AdminNavLink } from "@/components/chat/sidebar/AdminNavLink";
import { OrganizationCard } from "@/components/chat/sidebar/OrganizationCard";
import { NavLink } from "@/components/chat/sidebar/NavLink";
import { AuthWatcher } from "@/components/auth/AuthWatcher";

function BrandBlock() {
  return (
    <div className="rounded-[8px] border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 shadow-sm group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-foreground text-background shadow-sm group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
          <span className="font-display text-[20px] font-semibold italic leading-none select-none group-data-[collapsible=icon]:text-[15px]">E</span>
          <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-primary" />
        </div>
        <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
          <span className="block font-display text-[18px] font-medium tracking-[-0.01em] text-sidebar-foreground">
            EdificIA
          </span>
          <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground">
            Operaciones de obra
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-sidebar-border pt-2 group-data-[collapsible=icon]:hidden">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">v0.6</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary">Autónomo</span>
      </div>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SessionProvider>
      <ProjectProvider>
        <SidebarProvider
          defaultOpen={defaultOpen}
          className="h-svh overflow-hidden bg-background ed-blueprint-bg"
        >
          <AuthWatcher />

          <Sidebar collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border p-3 group-data-[collapsible=icon]:p-2">
              <BrandBlock />
            </SidebarHeader>

            <SidebarContent className="overflow-hidden">
              {/* Organization info card */}
              <div className="pt-2 group-data-[collapsible=icon]:hidden">
                <OrganizationCard />
              </div>

              {/* Nav */}
              <SidebarGroup className="p-2 pt-0 group-data-[collapsible=icon]:px-1.5">
                <SidebarMenu className="gap-1">
                  <NavLink href="/dashboard/chat" icon={<MessageSquare className="h-3.5 w-3.5" />} label="Asistente de Obra" />
                  <NavLink href="/dashboard/obras" icon={<Building2 className="h-3.5 w-3.5" />} label="Mis Obras" />
                  <NavLink href="/dashboard/expedientes" icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Mesa de Expedientes" />
                  <NavLink href="/dashboard/contexto" icon={<Activity className="h-3.5 w-3.5" />} label="Inteligencia Empresarial" />
                  <AdminNavLink />
                </SidebarMenu>
              </SidebarGroup>

              {/* Proyecto activo — shown when a project is selected */}
              <div className="border-t pt-2 group-data-[collapsible=icon]:hidden">
                <ActiveProjectSection />
              </div>

              {/* Session history */}
              <div className="flex-1 overflow-hidden border-t py-2 group-data-[collapsible=icon]:hidden">
                <DashboardSidebar />
              </div>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:px-1.5">
              <div className="group-data-[collapsible=icon]:hidden">
                <UserMenu />
              </div>
              <div className="flex items-center justify-between px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground group-data-[collapsible=icon]:hidden">
                  EdificIA · v0.6
                </p>
                <SidebarTrigger className="hidden text-muted-foreground md:flex" title="Colapsar barra (⌘B)" />
              </div>
            </SidebarFooter>

            <SidebarRail />
          </Sidebar>

          <SidebarInset className="overflow-hidden bg-transparent">
            {/* Mobile top bar */}
            <div className="flex h-[52px] shrink-0 items-center border-b bg-background/80 px-4 backdrop-blur md:hidden">
              <SidebarTrigger />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </ProjectProvider>
    </SessionProvider>
  );
}

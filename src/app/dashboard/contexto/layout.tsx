"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Activity, Building2, Files } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: Array<{ href: Route; label: string; icon: ReactNode; description: string }> = [
  {
    href: "/dashboard/contexto" as Route,
    label: "Centro",
    icon: <Activity className="h-3.5 w-3.5" strokeWidth={1.75} />,
    description: "Señales y decisión",
  },
  {
    href: "/dashboard/contexto/fuentes" as Route,
    label: "Fuentes",
    icon: <Files className="h-3.5 w-3.5" strokeWidth={1.75} />,
    description: "Lectura y permisos",
  },
  {
    href: "/dashboard/contexto/perfil" as Route,
    label: "Mapa Vivo",
    icon: <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
    description: "Empresa aprendida",
  },
];

export default function ContextoLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card/92 px-4 pt-4 backdrop-blur md:px-8 md:pt-5">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-end gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-t-[8px] border border-b-0 px-3 py-2 text-[12px] font-medium transition-colors md:px-4",
                  active
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40",
                )}
              >
                {tab.icon}
                <span className="flex flex-col leading-tight">
                  <span>{tab.label}</span>
                  <span className="hidden text-[10px] font-normal text-muted-foreground md:inline">{tab.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

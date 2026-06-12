"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Route } from "next";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

interface NavLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  /** If true, only exact match activates the highlight (default: startsWith) */
  exact?: boolean;
}

export function NavLink({ href, icon, label, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={label}
        render={<Link href={href as Route} />}
        className="gap-2.5 rounded-[8px] px-3 text-xs font-medium text-muted-foreground hover:text-foreground data-active:bg-primary/[0.08] data-active:font-medium data-active:text-foreground data-active:shadow-[inset_2px_0_0_var(--primary)] [&_svg]:size-3.5"
      >
        {icon}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

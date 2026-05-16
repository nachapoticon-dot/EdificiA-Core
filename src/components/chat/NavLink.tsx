"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Route } from "next";

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
    <Link
      href={href as Route}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";

/** Hamburger button visible only on mobile (< lg). */
export function MobileMenuButton() {
  const { toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      aria-label="Abrir menú"
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
    >
      <Menu className="h-4.5 w-4.5" />
    </button>
  );
}

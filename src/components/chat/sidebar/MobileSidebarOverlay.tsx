"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { usePathname } from "next/navigation";

/** Slide-over sidebar for mobile. Renders above all content with a backdrop. */
export function MobileSidebarOverlay({ children }: { children: ReactNode }) {
  const { open, close } = useSidebar();
  const pathname = usePathname();

  // Close on navigation
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-card shadow-lg transition-transform duration-300 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <button
          onClick={close}
          aria-label="Cerrar menú"
          className="absolute right-3 top-4 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {children}
      </aside>
    </>
  );
}

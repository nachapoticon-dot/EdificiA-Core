"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, LogOut, SlidersHorizontal } from "lucide-react";
import type { Route } from "next";
import { getInsForgeClient, clearPersistedToken } from "@/lib/insforge/client";

export function TopBarActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    setOpen(false);
    try { await getInsForgeClient().auth.signOut(); } catch { /* ignore */ }
    await fetch("/api/auth/logout", { method: "POST" });
    clearPersistedToken();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-0.5">

      {/* Settings dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          title="Configuración"
          aria-label="Configuración"
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border bg-card py-1 shadow-md">
            <Link
              href={"/dashboard/admin/settings" as Route}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              Configuración
            </Link>
            <div className="my-1 border-t" />
            <button
              onClick={() => { void handleLogout(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings, LogOut, SlidersHorizontal, Palette, Check, ChevronDown,
} from "lucide-react";
import type { Route } from "next";
import { getInsForgeClient, clearPersistedToken } from "@/lib/insforge/client";
import { useTheme } from "@/hooks/useTheme";
import { THEMES, THEME_LABELS, THEME_DESCRIPTIONS, type Theme } from "@/lib/theme";

export function TopBarActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  const closeMenu = useCallback(() => {
    setOpen(false);
    setThemesOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen((prev) => {
      if (prev) setThemesOpen(false);
      return !prev;
    });
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [closeMenu]);

  async function handleLogout() {
    closeMenu();
    try { await getInsForgeClient().auth.signOut(); } catch { /* ignore */ }
    await fetch("/api/auth/logout", { method: "POST" });
    clearPersistedToken();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-0.5">
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          title="Configuración"
          aria-label="Configuración"
          aria-expanded={open}
          onClick={toggleMenu}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full z-[60] mt-1 w-60 overflow-hidden rounded-lg border bg-card py-1"
            style={{
              borderColor: "color-mix(in oklch, var(--foreground) 18%, transparent)",
              backgroundColor: "var(--card)",
              boxShadow: "0 14px 32px oklch(0 0 0 / 0.22), 0 4px 10px oklch(0 0 0 / 0.10)",
            }}
          >
            <Link
              href={"/dashboard/admin/settings" as Route}
              onClick={closeMenu}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              Configuración
            </Link>

            <div className="my-1 border-t" />

            {/* Temas — fila colapsable */}
            <button
              type="button"
              onClick={() => setThemesOpen((v) => !v)}
              aria-expanded={themesOpen}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-accent"
            >
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">Temas</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {THEME_LABELS[theme]}
              </span>
              <ChevronDown
                className={`h-3 w-3 text-muted-foreground transition-transform ${themesOpen ? "rotate-180" : ""}`}
              />
            </button>

            {themesOpen && (
              <div className="border-t bg-background/40 py-1">
                {THEMES.map((t: Theme) => {
                  const active = t === theme;
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-accent ${
                        active ? "bg-accent/60" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        data-theme={t}
                        className="h-3 w-3 shrink-0 rounded-full border border-border"
                        style={{ background: "var(--brand)" }}
                      />
                      <span className="flex-1 leading-tight">
                        <span className="block text-foreground">{THEME_LABELS[t]}</span>
                        <span className="block text-[10px] text-muted-foreground">{THEME_DESCRIPTIONS[t]}</span>
                      </span>
                      {active && <Check className="h-3 w-3 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="my-1 border-t" />

            <button
              type="button"
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

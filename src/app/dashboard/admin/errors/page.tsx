"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgMember } from "@/hooks/useOrgMember";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  adminErrorEventsResponseSchema,
  type AdminErrorEventsResponse,
} from "@/lib/validators/api-responses";

type ErrorEvent = AdminErrorEventsResponse["events"][number];

const SEVERITY_STYLES: Record<ErrorEvent["severity"], string> = {
  warning: "border-[var(--warn)]/40 bg-[color-mix(in_oklch,var(--warn)_10%,transparent)] text-[var(--warn)]",
  error: "border-destructive/35 bg-destructive/10 text-destructive",
  critical: "border-destructive/55 bg-destructive/18 text-destructive",
};

export default function AdminErrorsPage() {
  const orgMember = useOrgMember();
  const router = useRouter();
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgMember.status === "ok" && orgMember.member.role !== "admin") {
      router.replace("/dashboard/chat");
    }
  }, [orgMember, router]);

  const loadEvents = useCallback(async () => {
    if (orgMember.status !== "ok" || orgMember.member.role !== "admin") return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return;
      const suffix = includeResolved ? "?includeResolved=1" : "";
      const res = await fetch(`/api/admin/error-events${suffix}`, { headers });
      if (!res.ok) throw new Error("No se pudieron cargar las alertas.");
      const parsed = adminErrorEventsResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("Respuesta inválida del servidor.");
      setEvents(parsed.data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las alertas.");
    } finally {
      setLoading(false);
    }
  }, [includeResolved, orgMember]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadEvents();
    });
    return () => {
      cancelled = true;
    };
  }, [loadEvents]);

  async function resolveEvent(eventId: string) {
    setResolvingId(eventId);
    setError(null);
    try {
      const res = await fetch("/api/admin/error-events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ id: eventId, resolved: true }),
      });
      if (!res.ok) throw new Error("No se pudo resolver la alerta.");
      setEvents((current) => current.filter((event) => event.id !== eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resolver la alerta.");
    } finally {
      setResolvingId(null);
    }
  }

  if (orgMember.status === "loading" || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <header className="border-b border-border bg-card/92 px-4 py-5 backdrop-blur md:px-8 md:py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/admin")}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Alertas del sistema
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Errores capturados en rutas críticas de EdificIA.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(event) => setIncludeResolved(event.target.checked)}
              className="h-4 w-4 rounded border"
            />
            Resueltas
          </label>
          <Button variant="outline" onClick={() => { void loadEvents(); }}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard label="Pendientes" value={events.filter((event) => !event.resolvedAt).length} />
          <SummaryCard label="Críticas" value={events.filter((event) => event.severity === "critical").length} tone="danger" />
          <SummaryCard label="Incluye resueltas" value={includeResolved ? "Sí" : "No"} />
        </div>

        {error && (
          <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

      <section className="overflow-hidden rounded-[10px] border bg-card shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
        {events.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No hay alertas pendientes.
          </div>
        ) : (
          <div className="divide-y">
            {events.map((event) => (
              <article key={event.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[event.severity]}`}>
                        {event.severity}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{event.route}</span>
                      {event.method && (
                        <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {event.method}
                        </span>
                      )}
                    </div>
                    <h2 className="break-words text-sm font-medium">{event.message}</h2>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()} · {event.fingerprint}
                    </p>
                  </div>
                  {!event.resolvedAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resolvingId === event.id}
                      onClick={() => { void resolveEvent(event.id); }}
                    >
                      {resolvingId === event.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Resolver
                    </Button>
                  )}
                </div>
                {Object.keys(event.context).length > 0 && (
                  <pre className="max-h-36 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    {JSON.stringify(event.context, null, 2)}
                  </pre>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "danger" }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "mt-2 text-[20px] font-semibold text-destructive" : "mt-2 text-[20px] font-semibold text-foreground"}>
        {value}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/insforge/client";
import { useOrgMember } from "@/hooks/useOrgMember";
import { useProjectContext } from "@/contexts/ProjectContext";
import { documentsResponseSchema } from "@/lib/validators/api-responses";
import { cn } from "@/lib/utils";

const INDEXING_LABELS: Record<string, string> = {
  pending: "Pendiente",
  indexed: "Indexado",
  degraded: "Solo texto",
  failed: "Error",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Documentos subidos por la organización y su estado en el índice de búsqueda. */
export default function DocumentsPage() {
  const member = useOrgMember();
  const canEdit = member.status === "ok" && member.member.role !== "viewer";
  const { projects } = useProjectContext();
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents", { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("documents fetch failed");
      return documentsResponseSchema.parse(await res.json()).files;
    },
  });

  async function run(id: string, method: "POST" | "DELETE", path: string) {
    setBusyId(id);
    try {
      await fetch(path, { method, headers: await getAuthHeaders() });
      await query.refetch();
    } finally {
      setBusyId(null);
    }
  }

  const projectName = (id: string | null | undefined) => projects.find((p) => p.id === id)?.name ?? "Sin obra";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <header className="border-b border-border bg-card px-8 py-5">
        <h1 className="font-display text-[20px] font-medium">Documentos</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Archivos subidos desde el chat. El agente los consulta con búsqueda semántica (o de texto si no hay embeddings).
        </p>
      </header>

      <div className="mx-auto w-full max-w-5xl px-8 py-6">
        {query.isLoading && <p className="text-[13px] text-muted-foreground">Cargando…</p>}
        {query.isError && <p className="text-[13px] text-destructive">No se pudieron cargar los documentos.</p>}
        {query.data?.length === 0 && <p className="text-[13px] text-muted-foreground">Todavía no se subieron archivos.</p>}

        {query.data && query.data.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Archivo</th>
                <th className="py-2 font-medium">Obra</th>
                <th className="py-2 font-medium">Índice</th>
                <th className="py-2 text-right font-medium">Fragmentos</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.data.map((f) => (
                <tr key={f.id}>
                  <td className="py-2.5">
                    <p className="font-medium">{f.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.file_type} · {formatSize(f.file_size_bytes)} · {new Date(f.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </td>
                  <td className="py-2.5 text-muted-foreground">{projectName(f.project_id)}</td>
                  <td className="py-2.5">
                    <span
                      title={f.indexing_error ?? undefined}
                      className={cn("rounded-[6px] bg-accent px-2 py-0.5 text-[11px]", f.indexing_status === "failed" && "text-destructive")}
                    >
                      {INDEXING_LABELS[f.indexing_status ?? "pending"] ?? f.indexing_status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-[12px]">{f.chunkCount}</td>
                  <td className="py-2.5 text-right">
                    {canEdit && (
                      <div className="inline-flex gap-1">
                        <button
                          title="Reindexar"
                          disabled={busyId === f.id}
                          onClick={() => void run(f.id, "POST", `/api/documents/${f.id}/reindex`)}
                          className="rounded-[6px] p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                        >
                          {busyId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          title="Eliminar"
                          disabled={busyId === f.id}
                          onClick={() => {
                            if (confirm(`¿Eliminar "${f.file_name}"? Se borra también del índice.`)) {
                              void run(f.id, "DELETE", `/api/documents/${f.id}`);
                            }
                          }}
                          className="rounded-[6px] p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

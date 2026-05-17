"use client";

import { useRef, useState } from "react";
import { CalendarRange, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  apiErrorResponseSchema,
  scheduleImportResponseSchema,
  type ScheduleImportResponse,
} from "@/lib/validators/api-responses";

interface ScheduleImportSectionProps {
  projectId: string;
}

const TEMPLATE_HINT = `task_code,name,description,status,start_date,due_date,progress_pct,predecessor_code
EST-01,Estructura H°A° P1,,in_progress,2026-04-01,2026-06-15,45,
EST-02,Estructura H°A° P2,,not_started,2026-06-16,2026-08-30,0,EST-01`;

export function ScheduleImportSection({ projectId }: ScheduleImportSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScheduleImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);

      const res = await fetch(`/api/projects/${projectId}/schedule/import`, {
        method: "POST",
        body: formData,
        headers: await getAuthHeaders(),
      });
      const data: unknown = await res.json();

      if (!res.ok) {
        const parsed = apiErrorResponseSchema.safeParse(data);
        setError(parsed.success ? parsed.data.error : "El servidor rechazó el CSV.");
        return;
      }

      const parsed = scheduleImportResponseSchema.safeParse(data);
      if (!parsed.success) {
        setError("La respuesta del servidor no es válida.");
        return;
      }
      setResult(parsed.data);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
          Cronograma de obra
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="rounded-[12px] border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">Importar cronograma desde CSV</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">
              Cargá un archivo CSV con las tareas de la obra. El agente podrá auditar atrasos,
              calcular curva S real y reprogramar tareas. Columnas reconocidas: <code className="font-mono">name</code>,
              <code className="font-mono"> task_code</code>, <code className="font-mono">status</code>,
              <code className="font-mono"> start_date</code>, <code className="font-mono">due_date</code>,
              <code className="font-mono"> progress_pct</code>, <code className="font-mono">predecessor_code</code>.
              Fechas en formato <code className="font-mono">YYYY-MM-DD</code> o <code className="font-mono">DD/MM/YYYY</code>.
            </p>
          </div>
        </div>

        <details className="mt-4 rounded-[8px] border border-border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-[11.5px] font-medium text-foreground">
            Ejemplo de CSV
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre font-mono text-[10.5px] leading-relaxed text-muted-foreground">
{TEMPLATE_HINT}
          </pre>
        </details>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <fieldset className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="schedule-import-mode"
                checked={mode === "append"}
                onChange={() => setMode("append")}
                className="accent-primary"
              />
              Agregar a lo existente
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="schedule-import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="accent-primary"
              />
              Reemplazar cronograma
            </label>
          </fieldset>

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-[8px] bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {busy ? "Importando…" : "Subir CSV"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-[8px] border border-destructive/30 bg-destructive/[0.06] px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <p className="text-[12px] text-destructive">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-[8px] border border-[oklch(0.62_0.13_145)]/30 bg-[oklch(0.62_0.13_145)]/[0.06] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.55_0.16_150)]" />
              <p className="text-[12px] font-semibold text-foreground">
                {result.insertedCount} tarea{result.insertedCount === 1 ? "" : "s"} importada{result.insertedCount === 1 ? "" : "s"} ({result.mode === "replace" ? "reemplazo total" : "agregadas"})
              </p>
            </div>
            {result.warnings.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  {result.warnings.length} aviso{result.warnings.length === 1 ? "" : "s"} de parsing
                </summary>
                <ul className="mt-1 ml-4 list-disc text-[11px] text-muted-foreground">
                  {result.warnings.slice(0, 20).map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                  {result.warnings.length > 20 && <li>… y {result.warnings.length - 20} más</li>}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

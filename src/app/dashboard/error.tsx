"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
        <span className="text-xl">⚠</span>
      </div>
      <div>
        <h2 className="text-base font-semibold">Error en el panel</h2>
        <p className="mt-1 text-sm text-muted-foreground">Algo falló al cargar esta sección.</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard/chat"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ir al chat
        </Link>
      </div>
    </div>
  );
}

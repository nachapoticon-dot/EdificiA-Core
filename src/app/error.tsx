"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
        <span className="text-2xl">⚠</span>
      </div>
      <div>
        <h1 className="text-lg font-semibold">Algo salió mal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ocurrió un error inesperado. Podés intentar recargar.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Reintentar
      </button>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <span className="font-mono text-2xl font-bold text-muted-foreground">404</span>
      </div>
      <div>
        <h1 className="text-lg font-semibold">Página no encontrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">La ruta que buscás no existe.</p>
      </div>
      <Link
        href="/dashboard/chat"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Ir al inicio
      </Link>
    </div>
  );
}

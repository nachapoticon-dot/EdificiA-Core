export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ed-blueprint-bg flex min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-foreground text-background shadow-sm">
                <span className="font-display text-[20px] font-semibold italic leading-none">E</span>
              </div>
              <div>
                <p className="font-display text-[20px] font-medium leading-none text-foreground">EdificIA</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                  inteligencia para construir
                </p>
              </div>
            </div>

            <div className="mt-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                Gestión inteligente para constructoras
              </p>
              <h1 className="mt-4 max-w-lg font-display text-[46px] font-normal leading-[1.02] text-foreground">
                Una forma más clara de dirigir cada obra.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
                Revisá presupuestos, planos y legajos con asistencia inteligente,
                manteniendo cada decisión técnica ordenada, trazable y lista para compartir.
              </p>
            </div>

            <div className="mt-10 max-w-md border-y border-border/80 py-4">
              <div className="grid grid-cols-3 divide-x divide-border/80">
                <Signal text="Obras en contexto" />
                <Signal text="Legajos a mano" />
                <Signal text="Asistente técnico" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[420px]">
          <div className="mb-6 text-center lg:hidden">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-[8px] bg-foreground text-background shadow-sm">
              <span className="font-display text-[20px] font-semibold italic leading-none">E</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-medium text-foreground">
              EdificIA
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestión inteligente para constructoras
            </p>
          </div>

          <div className="rounded-[10px] border border-border bg-card/90 p-1 shadow-lg backdrop-blur">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

function Signal({ text }: { text: string }) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <div className="mb-2 h-1 w-8 rounded-full bg-primary/70" />
      <p className="text-[13px] font-medium leading-tight text-foreground">
        {text}
      </p>
    </div>
  );
}

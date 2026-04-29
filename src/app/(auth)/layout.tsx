export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Edificia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plataforma de IA para la construcción
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

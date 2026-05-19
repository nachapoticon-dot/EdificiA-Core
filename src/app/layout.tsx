import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeInitScript } from "@/components/theme/ThemeInitScript";

export const metadata: Metadata = {
  title: "EdificIA",
  description: "Plataforma empresarial de automatización de procesos para la construcción",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

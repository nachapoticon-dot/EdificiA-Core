import type { NextConfig } from "next";

// CORS is handled dynamically by src/middleware.ts (supports multiple origins correctly).
const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  // pdf-parse v2 dynamically requires pdfjs-dist and its worker; bundling them
  // with Turbopack/webpack breaks the runtime path resolution → silent failures
  // that fall back to byte-count estimation. Keep them as runtime-resolved.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

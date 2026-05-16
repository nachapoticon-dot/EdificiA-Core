"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearPersistedToken } from "@/lib/insforge/client";

/**
 * Patches window.fetch once per session to intercept 401 responses from /api/*.
 * On 401, clears the local token and redirects to /login.
 */
export function AuthWatcher() {
  const router = useRouter();

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url ?? "";
        if (url.startsWith("/api/")) {
          clearPersistedToken();
          router.push("/login");
        }
      }
      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  return null;
}

// Standardized API error responses.
// Usage: return apiError("Mensaje", 400)
// Never expose stack traces or internal details in production.

export function apiError(
  message: string,
  status: number,
  opts?: { code?: string; suggestion?: string },
): Response {
  return Response.json(
    {
      error: message,
      ...(opts?.code ? { code: opts.code } : {}),
      ...(opts?.suggestion ? { suggestion: opts.suggestion } : {}),
    },
    { status },
  );
}

export function apiBadRequest(message: string, suggestion?: string) {
  return apiError(message, 400, { code: "BAD_REQUEST", suggestion });
}

export function apiUnauthorized(message = "No autorizado.") {
  return apiError(message, 401, { code: "UNAUTHORIZED" });
}

export function apiForbidden(message = "Acceso denegado.") {
  return apiError(message, 403, { code: "FORBIDDEN" });
}

export function apiNotFound(resource = "Recurso") {
  return apiError(`${resource} no encontrado.`, 404, { code: "NOT_FOUND" });
}

export function apiTooLarge(message: string, suggestion?: string) {
  return apiError(message, 413, { code: "PAYLOAD_TOO_LARGE", suggestion });
}

export function apiRateLimited(message = "Límite de solicitudes alcanzado. Intentá más tarde.") {
  return apiError(message, 429, { code: "RATE_LIMITED" });
}

export function apiInternal(context?: string) {
  const msg = process.env.NODE_ENV === "production"
    ? "Error interno del servidor."
    : `Error interno${context ? `: ${context}` : ""}.`;
  return apiError(msg, 500, { code: "INTERNAL_ERROR" });
}

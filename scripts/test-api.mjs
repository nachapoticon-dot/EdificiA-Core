const BASE_URL = "https://***INSFORGE_URL_REDACTED***";
const SERVICE_KEY = "***INSFORGE_SERVICE_KEY_REDACTED***";

// Probe root and common patterns
const paths = [
  "/",
  "/health",
  "/api",
  "/database",
  "/database/v1",
  "/database/rest/v1",
  "/auth/v1/health",
  "/api/v1",
];

for (const path of paths) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
  });
  const text = await res.text();
  console.log(`${path} → ${res.status}: ${text.slice(0, 120).replace(/\n/g, " ")}`);
}

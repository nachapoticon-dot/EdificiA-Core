import { createClient } from "@insforge/sdk";

const BASE_URL    = "https://***INSFORGE_URL_REDACTED***";
const SERVICE_KEY = "***INSFORGE_SERVICE_KEY_REDACTED***";

const EMAIL = "pedroluisfuentesprieto@gmail.com";
const OTP   = "154327";

const client = createClient({ baseUrl: BASE_URL, anonKey: SERVICE_KEY, isServerMode: true });

console.log("Verificando email con OTP...");

// Intentar con distintos formatos que acepta el endpoint
const { data, error } = await client.auth.verifyEmail({ otp: OTP, email: EMAIL });

if (error) {
  console.error("✗ Error:", error.message);
  // Intentar formato alternativo via fetch directo
  const r = await fetch(`${BASE_URL}/api/auth/email/verify?client_type=mobile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ otp: OTP, email: EMAIL }),
  });
  const t = await r.text();
  console.log(`\nFetch directo → ${r.status}:`, t.slice(0, 400));
} else {
  console.log("✓ Email verificado!");
  console.log("  User:", data?.user?.id ?? data);

  // Probar login
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email: EMAIL, password: "123456",
  });
  if (loginErr) {
    console.error("✗ Login:", loginErr.message);
  } else {
    console.log("✓ Login exitoso! User ID:", loginData?.user?.id);
  }
}

/**
 * Seed de demo: crea el usuario admin.
 * Uso: node scripts/seed-demo.mjs [email] [password]
 *
 * Ejemplo: node scripts/seed-demo.mjs pedro@tuempresa.com 123456
 *
 * IMPORTANTE: InsForge requiere verificación de email.
 * Después de correr este script, revisá el inbox del email que pusiste
 * y hacé click en el link de verificación antes de intentar login.
 */
import { createClient } from "@insforge/sdk";

const BASE_URL    = "https://***INSFORGE_URL_REDACTED***";
const SERVICE_KEY = "***INSFORGE_SERVICE_KEY_REDACTED***";

const email    = process.argv[2] ?? "pedroluisfuentesprieto@gmail.com";
const password = process.argv[3] ?? "123456";
const name     = "Admin Demo";

if (password.length < 6) {
  console.error("✗ La contraseña debe tener al menos 6 caracteres.");
  process.exit(1);
}

const admin = createClient({ baseUrl: BASE_URL, anonKey: SERVICE_KEY, isServerMode: true });

console.log(`Creando usuario: ${email}...`);

const { data, error } = await admin.auth.signUp({
  email,
  password,
  name,
  autoConfirm: true,
});

if (error) {
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("already") || msg.includes("exists")) {
    console.log("El usuario ya existe. Intentá iniciar sesión directamente.");
    console.log("Si da error de verificación, revisá tu inbox.");
  } else {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }
} else {
  console.log("✓ Usuario creado:", data?.user?.id ?? "(ID pendiente)");
  console.log("\n⚠ PASO NECESARIO:");
  console.log(`  Revisá el inbox de ${email}`);
  console.log("  Hacé click en el link de verificación que te mandó InsForge.");
  console.log("  Después de eso, ya podés iniciar sesión.\n");
}

console.log("Credenciales:");
console.log(`  URL:      http://localhost:3000/login`);
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);

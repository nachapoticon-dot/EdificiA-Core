/**
 * Seed de demo: crea el usuario admin.
 * Uso: node scripts/seed-demo.mjs [email] [password]
 *
 * Requiere variables de entorno (cargá desde .env.local):
 *   NEXT_PUBLIC_INSFORGE_URL
 *   INSFORGE_SERVICE_ROLE_KEY
 *
 * Ejemplo:
 *   node --env-file=.env.local scripts/seed-demo.mjs pedro@tuempresa.com MiPassword123
 */
import { createClient } from "@insforge/sdk";

const BASE_URL    = process.env.NEXT_PUBLIC_INSFORGE_URL;
const SERVICE_KEY = process.env.INSFORGE_SERVICE_ROLE_KEY;

if (!BASE_URL || !SERVICE_KEY) {
  console.error("✗ Faltan variables de entorno. Corré con: node --env-file=.env.local scripts/seed-demo.mjs");
  process.exit(1);
}

const email    = process.argv[2] ?? "admin@tuempresa.com";
const password = process.argv[3] ?? "cambiar-esto";
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
  } else {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }
} else {
  console.log("✓ Usuario creado:", data?.user?.id ?? "(ID pendiente)");
  console.log("\n⚠ PASO NECESARIO:");
  console.log(`  Revisá el inbox de ${email}`);
  console.log("  Hacé click en el link de verificación que te mandó InsForge.");
}

console.log("\nCredenciales:");
console.log(`  URL:      http://localhost:3000/login`);
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);

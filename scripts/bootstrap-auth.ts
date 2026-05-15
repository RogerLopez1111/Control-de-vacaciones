/**
 * Crea cuentas de Supabase Auth para todos los empleados activos
 * que aún no tengan una vinculada (auth_user_id IS NULL).
 *
 *   npm run auth:bootstrap                       # crea cuentas para los nuevos
 *   npm run auth:bootstrap -- --reset-passwords  # vuelve a poner la default a TODOS (uso de RRHH)
 *
 * Email sintético:  emp<id>@vacaciones.ecosistemas.ws  (no recibe correo)
 * Contraseña default:  ecosistemas + año de ingreso (ej. ecosistemas2024)
 *
 * El empleado debe cambiar la contraseña en su primer login. Ese flujo
 * actualiza employees.password_changed_at.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { syntheticEmailFor, defaultPasswordFor } from "../src/lib/auth-helpers.js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const RESET = process.argv.includes("--reset-passwords");

async function main() {
  const { data: employees, error } = await supa
    .from("employees")
    .select("id, nombre, apellido_paterno, hire_date, auth_user_id")
    .is("termination_date", null)
    .order("id");
  if (error) throw error;
  if (!employees?.length) { console.log("No hay empleados activos."); return; }

  console.log(`\n── Bootstrap auth (${employees.length} empleados activos) ──`);
  let created = 0, linked = 0, reset = 0, skipped = 0, failed = 0;

  for (const e of employees) {
    const email = syntheticEmailFor(e.id);
    const password = defaultPasswordFor(e.hire_date);
    const fullName = `${e.nombre} ${e.apellido_paterno ?? ""}`.trim();

    if (e.auth_user_id) {
      if (!RESET) { skipped++; continue; }
      // RESET mode: poner la contraseña default y limpiar password_changed_at
      const { error: pwErr } = await supa.auth.admin.updateUserById(e.auth_user_id, {
        password,
        user_metadata: { employee_id: e.id, full_name: fullName, password_default: true },
      });
      if (pwErr) { console.error(`✗ ${e.id} ${fullName}: ${pwErr.message}`); failed++; continue; }
      await supa.from("employees").update({ password_changed_at: null }).eq("id", e.id);
      reset++;
      continue;
    }

    // Crear cuenta nueva. `password_default: true` indica que aún usa la contraseña
    // inicial — el middleware fuerza el cambio antes de permitir cualquier otra acción.
    const { data: created_user, error: createErr } = await supa.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { employee_id: e.id, full_name: fullName, password_default: true },
    });
    if (createErr) {
      // Si ya existe (carrera, o un bootstrap previo a medias) intentar buscarlo y vincular
      console.error(`✗ ${e.id} ${fullName}: ${createErr.message}`);
      failed++;
      continue;
    }
    const { error: linkErr } = await supa
      .from("employees")
      .update({ auth_user_id: created_user.user!.id, password_changed_at: null })
      .eq("id", e.id);
    if (linkErr) { console.error(`✗ link ${e.id}: ${linkErr.message}`); failed++; continue; }
    created++;
    linked++;
  }

  console.log(`✓ creados: ${created}`);
  console.log(`✓ vinculados a employees: ${linked}`);
  if (RESET) console.log(`✓ contraseñas reseteadas: ${reset}`);
  if (skipped) console.log(`· ya existían (omitidos): ${skipped}`);
  if (failed)  console.log(`✗ fallaron: ${failed}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

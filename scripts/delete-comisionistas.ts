/**
 * Borra de Supabase los empleados marcados como comisionistas en el ERP
 * (departamento 9 o puesto 26), junto con sus cuentas de auth.users.
 *
 * Ejecutar UNA VEZ después de actualizar el filtro en sqlserver.ts —
 * limpia los registros que se importaron antes de que existiera el filtro.
 *
 *   npx tsx scripts/delete-comisionistas.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  // 1) Identificar comisionistas
  const { data: comis, error: qErr } = await supa
    .from("employees")
    .select("id, nombre, apellido_paterno, auth_user_id")
    .or("departamento_id.eq.9,puesto_id.eq.26");
  if (qErr) throw qErr;
  if (!comis?.length) { console.log("No hay comisionistas que borrar."); return; }
  console.log(`Encontrados ${comis.length} comisionistas a eliminar.`);

  const ids = comis.map((c) => c.id);

  // 2) Limpiar referencias FK que vendrían de manager_employee_id
  //    (otros empleados que reportaban a algún comisionista — no rompan FK).
  const { error: clearMgrErr } = await supa
    .from("employees")
    .update({ manager_employee_id: null })
    .in("manager_employee_id", ids);
  if (clearMgrErr) console.warn("✗ limpiando manager_employee_id:", clearMgrErr.message);
  else console.log("✓ limpiados manager_employee_id que apuntaban a comisionistas");

  // 3) Borrar vacation_adjustments y vacation_requests si existieran
  for (const tbl of ["vacation_adjustments", "vacation_requests"] as const) {
    const { error, count } = await supa.from(tbl).delete({ count: "exact" }).in("employee_id", ids);
    if (error) console.warn(`✗ ${tbl}:`, error.message);
    else if (count) console.log(`✓ ${tbl}: ${count} filas borradas`);
  }

  // 4) Borrar las filas en employees
  const { error: delEmpErr, count: empCount } = await supa
    .from("employees")
    .delete({ count: "exact" })
    .in("id", ids);
  if (delEmpErr) { console.error("✗ delete employees:", delEmpErr.message); return; }
  console.log(`✓ employees borrados: ${empCount}`);

  // 5) Borrar sus cuentas de auth.users
  let authDeleted = 0, authFailed = 0;
  for (const c of comis) {
    if (!c.auth_user_id) continue;
    const { error } = await supa.auth.admin.deleteUser(c.auth_user_id);
    if (error) { console.warn(`✗ auth ${c.auth_user_id}: ${error.message}`); authFailed++; }
    else authDeleted++;
  }
  console.log(`✓ auth.users borrados: ${authDeleted}${authFailed ? ` (${authFailed} fallaron)` : ""}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

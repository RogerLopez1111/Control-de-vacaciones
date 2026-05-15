/**
 * Quick lookup: find an employee by name fragment.
 *   npx tsx scripts/find-employee.ts <fragment>
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const fragment = process.argv[2] ?? "alfredo";

async function main() {
  const { data, error } = await supa
    .from("employees")
    .select("id, codigo_alterno, nombre, apellido_paterno, apellido_materno, email, branch_id, hire_date")
    .or(
      `nombre.ilike.%${fragment}%,apellido_paterno.ilike.%${fragment}%,apellido_materno.ilike.%${fragment}%,email.ilike.%${fragment}%`
    );
  if (error) { console.error(error.message); return; }
  if (!data?.length) { console.log(`Sin coincidencias para "${fragment}"`); return; }
  console.log(`\nCoincidencias para "${fragment}":`);
  for (const e of data) {
    const name = [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(" ");
    console.log(`  id=${e.id}  ${name}  <${e.email ?? "sin email"}>  sucursal=${e.branch_id}  ingreso=${e.hire_date}`);
  }
}

main().catch(console.error);

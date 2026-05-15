/**
 * Marks an employee as admin (sets is_admin=true).
 *   npx tsx scripts/set-admin.ts <employee_id>
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const id = Number(process.argv[2]);
  if (!id) { console.error("usage: set-admin.ts <employee_id>"); process.exit(1); }
  const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await s
    .from("employees")
    .update({ is_admin: true })
    .eq("id", id)
    .select("id, nombre, apellido_paterno, apellido_materno, email, is_admin");
  if (error) { console.error(error.message); return; }
  if (!data?.length) { console.log(`No se encontró empleado con id=${id}`); return; }
  console.log("✓ admin asignado:", data[0]);
}
main();

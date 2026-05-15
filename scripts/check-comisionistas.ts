import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Distribución por departamento_id y puesto_id
  const { data: emps } = await s
    .from("employees")
    .select("id, codigo_alterno, nombre, apellido_paterno, apellido_materno, departamento_id, puesto_id")
    .is("termination_date", null);

  const byDept = new Map<number, number>();
  const byPuesto = new Map<number, number>();
  for (const e of emps ?? []) {
    if (e.departamento_id != null) byDept.set(e.departamento_id, (byDept.get(e.departamento_id) ?? 0) + 1);
    if (e.puesto_id != null)       byPuesto.set(e.puesto_id, (byPuesto.get(e.puesto_id) ?? 0) + 1);
  }

  console.log("\nDistribución por departamento_id:");
  for (const [k, v] of [...byDept.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

  console.log("\nDistribución por puesto_id:");
  for (const [k, v] of [...byPuesto.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

  // Listar comisionistas (depto 9 o puesto 26)
  const comis = (emps ?? []).filter((e) => e.departamento_id === 9 || e.puesto_id === 26);
  console.log(`\nComisionistas (depto=9 o puesto=26): ${comis.length}`);
  for (const e of comis) {
    console.log(`  id=${e.id} cod=${e.codigo_alterno} ${e.nombre} ${e.apellido_paterno ?? ""} ${e.apellido_materno ?? ""}  depto=${e.departamento_id} puesto=${e.puesto_id}`);
  }
}
main();

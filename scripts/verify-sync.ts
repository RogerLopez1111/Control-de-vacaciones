/**
 * Quick verification of what was synced. Read-only.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  const { count: branchTotal } = await supa.from("branches").select("*", { count: "exact", head: true });
  const { count: branchActiva } = await supa.from("branches").select("*", { count: "exact", head: true }).eq("activa", true);

  const { count: empTotal } = await supa.from("employees").select("*", { count: "exact", head: true });
  const { count: empActivos } = await supa.from("employees").select("*", { count: "exact", head: true }).is("termination_date", null);

  const { count: empSinReporta } = await supa.from("employees").select("*", { count: "exact", head: true }).is("manager_employee_id", null);
  const { count: empConReporta } = await supa.from("employees").select("*", { count: "exact", head: true }).not("manager_employee_id", "is", null);

  console.log("\n── Resumen Supabase ──");
  console.log(`branches:   total=${branchTotal}, activas=${branchActiva}`);
  console.log(`employees:  total=${empTotal}, activos (sin termination_date)=${empActivos}`);
  console.log(`            con manager=${empConReporta}, sin manager=${empSinReporta}`);

  // Muestra de sucursales
  const { data: branches } = await supa.from("branches").select("id, nombre, activa").order("id");
  console.log("\nSucursales:");
  for (const b of branches ?? []) {
    console.log(`  ${b.id.toString().padStart(4)} ${b.activa ? "✓" : "✗"} ${b.nombre}`);
  }

  // Muestra: ¿cuántos activos por sucursal?
  console.log("\nEmpleados activos por sucursal:");
  for (const b of branches ?? []) {
    const { count } = await supa
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("branch_id", b.id)
      .is("termination_date", null);
    if ((count ?? 0) > 0) console.log(`  ${b.nombre}: ${count}`);
  }
}

main().catch(console.error);

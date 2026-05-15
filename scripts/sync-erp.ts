/**
 * sync-erp.ts — Ecosistemas Control de Vacaciones
 * Mirrors [ECO_2020].[dbo].[Sucursal] + [dbo].[Empleado] into Supabase.
 *
 *   npm run sync:erp                          # full sync
 *   npm run sync:erp -- --since=2026-05-14    # delta from a date (Fecha_Ult_Modif)
 *
 * Run on a machine inside the office network (Windows Task Scheduler nightly).
 * Uses the Supabase service-role key, so it bypasses RLS.
 *
 * Pattern matches the existing CRM sync agent in PRUEBA-CRM-GEMINI-CODE.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  getSucursalesRaw,
  getEmpleadosRaw,
  normalizeErpRow,
  closePool,
} from "../src/lib/erp/sqlserver.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getCliArg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const CHUNK = 200;

// ---------------------------------------------------------------------------
async function syncSucursales() {
  const rows = await getSucursalesRaw();
  if (!rows.length) { console.warn("⚠  No sucursales returned from SQL Server"); return; }

  const payload = rows.map(normalizeErpRow).map((s) => ({
    id: s.Sc_Cve_Sucursal,
    nombre: s.Sc_Descripcion,
    activa: (s.Es_Cve_Estado ?? "AC").trim() === "AC",
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("branches").upsert(payload, { onConflict: "id" });
  if (error) { console.error("✗ branches:", error.message); return; }
  console.log(`✓ branches upserted: ${payload.length}`);
}

// ---------------------------------------------------------------------------
async function syncEmpleados(since: string | null) {
  const rows = await getEmpleadosRaw(since ?? undefined);
  if (!rows.length) { console.warn("⚠  No empleados returned from SQL Server"); return; }

  // Pass 1 — upsert without manager_employee_id (avoid self-FK violations).
  const normalized = rows.map(normalizeErpRow);
  const payload = normalized
    .filter((e) => e.Em_Fecha_Ingreso) // hire_date is required
    .map((e) => ({
      id: e.Em_Cve_Empleado,
      codigo_alterno: e.Em_Codigo_Alterno,
      nombre: e.Em_Nombre,
      apellido_paterno: e.Em_Apellido_Paterno,
      apellido_materno: e.Em_Apellido_Materno,
      email: ((e.Em_Email ?? e.Em_Email_2) ?? "").toLowerCase().trim() || null,
      branch_id: e.Sc_Cve_Sucursal,
      hire_date: (e.Em_Fecha_Ingreso as string).slice(0, 10),  // ISO → date
      termination_date: e.Em_Fecha_Baja ? (e.Em_Fecha_Baja as string).slice(0, 10) : null,
      departamento_id: e.De_Cve_Departamento_Empleado,
      puesto_id: e.Pe_Cve_Puesto_Empleado,
      synced_at: new Date().toISOString(),
    }));

  let upserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabase.from("employees").upsert(chunk, { onConflict: "id" });
    if (error) console.error(`✗ employees chunk ${i}–${i + chunk.length}:`, error.message);
    else upserted += chunk.length;
  }
  console.log(`✓ employees upserted: ${upserted} / ${payload.length}${since ? ` (delta desde ${since})` : ""}`);

  // Nota: ya no sincronizamos `Em_Reporta` → `manager_employee_id`.
  // La jerarquía de aprobación se maneja desde el panel de admin via áreas
  // y triggers (ver migraciones 007/008). Mantener el sync aquí pisaría las
  // asignaciones manuales de RRHH cada noche.
}

// ---------------------------------------------------------------------------
async function main() {
  const since = getCliArg("since");
  console.log(`\n── ERP → Supabase sync  ${new Date().toLocaleString()} ──`);
  await syncSucursales();
  await syncEmpleados(since);
  console.log("── done ──\n");
  await closePool();
}

main().catch(async (err) => {
  console.error("Sync failed:", err);
  await closePool();
  process.exit(1);
});

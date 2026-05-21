import { createSupabaseAdminClient } from "./supabase/admin";
import { computeCarryoverPlan } from "./saldo";
import { lastAnniversary, yearsOfServiceAt } from "./lft-entitlement";

/**
 * Ventana (en días) después de un aniversario durante la cual se procesa el
 * arrastre. Lo suficientemente generosa para cubrir empleados que no entran
 * todos los días a la plataforma, pero corta para no recalcular saldo todo
 * el año.
 */
export const CARRYOVER_WINDOW_DAYS = 30;

/**
 * Determina si el empleado está "vencido" para procesar arrastre — es decir,
 * si su último aniversario cae dentro de los últimos `windowDays` días.
 *
 * Si el empleado no ha cumplido su primer año, no aplica.
 */
export function isWithinPostAnniversaryWindow(
  hireDate: Date,
  asOf: Date,
  windowDays = CARRYOVER_WINDOW_DAYS,
): boolean {
  if (yearsOfServiceAt(hireDate, asOf) === 0) return false;
  const lastAnn = lastAnniversary(hireDate, asOf);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor((asOf.getTime() - lastAnn.getTime()) / msPerDay);
  return daysSince >= 0 && daysSince <= windowDays;
}

type Plan = ReturnType<typeof computeCarryoverPlan>;

interface ExistingCarryoverRow {
  id: string;
  period_start: string;
  delta_days: number;
}

/**
 * Para uno o más empleados, asegura que existan en `vacation_adjustments`
 * las filas `kind='carryover'` correspondientes a los periodos cerrados.
 *
 * - INSERT si falta una fila y el sobrante es ≠ 0.
 * - UPDATE si la fila existe pero el `delta_days` cambió (p.ej. se modificó
 *   retroactivamente una solicitud pasada).
 * - DELETE si la fila existe pero el sobrante recalculado dio 0 (limpia ruido).
 *
 * Es idempotente: correrla varias veces sobre los mismos datos no produce
 * cambios después de la primera pasada.
 *
 * Se ejecuta con el admin client (bypass RLS) porque el cliente del empleado
 * no tiene permiso de escritura sobre `vacation_adjustments`.
 */
export async function ensureCarryoverAdjustments(
  employees: ReadonlyArray<{ id: number; hire_date: string }>,
  asOf: Date = new Date(),
): Promise<void> {
  if (employees.length === 0) return;

  const admin = createSupabaseAdminClient();
  const employeeIds = employees.map((e) => e.id);

  // Cargamos en batch las solicitudes y ajustes (solo manuales, para no
  // contaminar el cálculo con los propios carryovers).
  const [{ data: requests, error: reqErr }, { data: manualAdj, error: adjErr }, { data: existing, error: exErr }] = await Promise.all([
    admin
      .from("vacation_requests")
      .select("employee_id, start_date, end_date, business_days, status")
      .in("employee_id", employeeIds),
    admin
      .from("vacation_adjustments")
      .select("employee_id, period_start, delta_days")
      .in("employee_id", employeeIds)
      .eq("kind", "manual"),
    admin
      .from("vacation_adjustments")
      .select("id, employee_id, period_start, delta_days")
      .in("employee_id", employeeIds)
      .eq("kind", "carryover"),
  ]);
  if (reqErr || adjErr || exErr) {
    console.error("[carryover] fallo cargando datos:", reqErr ?? adjErr ?? exErr);
    return;
  }

  const reqByEmp = new Map<number, typeof requests>();
  for (const r of requests ?? []) {
    const list = reqByEmp.get(r.employee_id);
    if (list) list.push(r); else reqByEmp.set(r.employee_id, [r]);
  }
  const manualByEmp = new Map<number, typeof manualAdj>();
  for (const a of manualAdj ?? []) {
    const list = manualByEmp.get(a.employee_id);
    if (list) list.push(a); else manualByEmp.set(a.employee_id, [a]);
  }
  const existingByEmp = new Map<number, ExistingCarryoverRow[]>();
  for (const e of existing ?? []) {
    const list = existingByEmp.get(e.employee_id);
    if (list) list.push(e); else existingByEmp.set(e.employee_id, [e]);
  }

  const toInsert: { employee_id: number; period_start: string; delta_days: number; reason: string; kind: "carryover" }[] = [];
  const toUpdate: { id: string; delta_days: number; reason: string }[] = [];
  const toDelete: string[] = [];

  for (const emp of employees) {
    const hireDate = parseLocalDate(emp.hire_date);
    const plan: Plan = computeCarryoverPlan(
      hireDate,
      asOf,
      reqByEmp.get(emp.id) ?? [],
      manualByEmp.get(emp.id) ?? [],
    );
    const existingForEmp = new Map<string, ExistingCarryoverRow>();
    for (const row of existingByEmp.get(emp.id) ?? []) {
      existingForEmp.set(row.period_start, row);
    }

    const seen = new Set<string>();
    for (const entry of plan) {
      seen.add(entry.period_start);
      const reason = `Arrastre del periodo ${entry.source_period_start} → ${entry.source_period_end}`;
      const cur = existingForEmp.get(entry.period_start);
      if (cur == null) {
        if (entry.delta_days !== 0) {
          toInsert.push({
            employee_id: emp.id,
            period_start: entry.period_start,
            delta_days: entry.delta_days,
            reason,
            kind: "carryover",
          });
        }
      } else if (cur.delta_days !== entry.delta_days) {
        if (entry.delta_days === 0) {
          toDelete.push(cur.id);
        } else {
          toUpdate.push({ id: cur.id, delta_days: entry.delta_days, reason });
        }
      }
    }

    // Fila huérfana: existía un carryover para un periodo que ya no aparece
    // en el plan (p.ej. la hire_date se editó). La eliminamos.
    for (const row of existingByEmp.get(emp.id) ?? []) {
      if (!seen.has(row.period_start)) toDelete.push(row.id);
    }
  }

  // Aplicamos los cambios. Ignoramos errores individuales pero los registramos.
  if (toInsert.length > 0) {
    const { error } = await admin.from("vacation_adjustments").insert(toInsert);
    if (error) console.error("[carryover] insert falló:", error);
  }
  for (const u of toUpdate) {
    const { error } = await admin
      .from("vacation_adjustments")
      .update({ delta_days: u.delta_days, reason: u.reason })
      .eq("id", u.id);
    if (error) console.error("[carryover] update falló:", error);
  }
  if (toDelete.length > 0) {
    const { error } = await admin.from("vacation_adjustments").delete().in("id", toDelete);
    if (error) console.error("[carryover] delete falló:", error);
  }
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

import { entitlementForCurrentYear, lastAnniversary, lftDaysForYear, nextAnniversary, yearsOfServiceAt } from "./lft-entitlement";

export interface SaldoVacaciones {
  /** Años CUMPLIDOS de servicio (antigüedad real al `asOf`). 0 antes del primer aniversario. */
  yearsCompleted: number;
  /** Días totales a los que tiene derecho en este periodo anual (LFT). */
  entitlement: number;
  /** Suma de ajustes manuales (RRHH) dentro del periodo en curso (puede ser negativa). */
  adjustments: number;
  /** Días ya aprobados (o tomados) dentro del periodo en curso. */
  taken: number;
  /** Días pendientes de aprobación dentro del periodo en curso. */
  pending: number;
  /** Días disponibles = entitlement + adjustments - taken - pending. */
  available: number;
  /** Inicio del periodo en curso (último aniversario o fecha de ingreso). */
  periodStart: Date;
  /** Fin del periodo en curso (próximo aniversario). */
  periodEnd: Date;
}

/**
 * Calcula el saldo de vacaciones de un empleado al `asOf`, considerando
 * el periodo anual en curso (entre aniversarios).
 *
 * `requests` debe contener todas las solicitudes del empleado; se filtra aquí
 * por estatus y por traslape con el periodo.
 */
export function calcularSaldo(
  hireDate: Date,
  asOf: Date,
  requests: ReadonlyArray<{
    start_date: string;
    end_date: string;
    business_days: number;
    status: "pendiente" | "aprobada" | "rechazada" | "cancelada";
  }>,
  adjustments: ReadonlyArray<{
    period_start: string;
    delta_days: number;
  }> = []
): SaldoVacaciones {
  const periodStart = lastAnniversary(hireDate, asOf);
  const periodEnd = nextAnniversary(hireDate, asOf);
  const entitlement = entitlementForCurrentYear(hireDate, asOf);
  const periodStartIso = isoDate(periodStart);

  let taken = 0;
  let pending = 0;
  for (const r of requests) {
    if (r.status === "rechazada" || r.status === "cancelada") continue;
    const start = new Date(r.start_date);
    if (start < periodStart || start >= periodEnd) continue; // fuera del periodo
    if (r.status === "aprobada") taken += r.business_days;
    else if (r.status === "pendiente") pending += r.business_days;
  }

  let adjustmentsSum = 0;
  for (const a of adjustments) {
    if (a.period_start === periodStartIso) adjustmentsSum += a.delta_days;
  }

  return {
    yearsCompleted: yearsOfServiceAt(hireDate, asOf),
    entitlement,
    adjustments: adjustmentsSum,
    taken,
    pending,
    available: entitlement + adjustmentsSum - taken - pending,
    periodStart,
    periodEnd,
  };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface CarryoverEntry {
  /**
   * Aniversario en el que se "deposita" el arrastre — coincide con el
   * `period_start` del periodo que recibe los días.
   */
  period_start: string;
  /** Sobrante del periodo inmediatamente anterior. Puede ser 0 o negativo. */
  delta_days: number;
  /** Inicio del periodo que cerró y donó sus días (para la razón en UI). */
  source_period_start: string;
  /** Cierre del periodo que donó sus días (= `period_start`). */
  source_period_end: string;
}

/**
 * Plan de arrastres para TODOS los periodos cerrados del empleado.
 * Devuelve una entrada por cada aniversario ya cumplido — el sobrante de un
 * periodo se transfiere íntegro al periodo que arranca en ese aniversario.
 *
 * Es función pura: el caller decide si persistir el plan o no.
 *
 * Convención: el carryover INCLUYE en su cálculo a otros ajustes manuales
 * ya capturados para el periodo de origen, además del arrastre que entró
 * desde el periodo previo. Así una corrida de N periodos arroja un saldo
 * acumulado correcto.
 */
export function computeCarryoverPlan(
  hireDate: Date,
  asOf: Date,
  requests: ReadonlyArray<{
    start_date: string;
    end_date: string;
    business_days: number;
    status: "pendiente" | "aprobada" | "rechazada" | "cancelada";
  }>,
  manualAdjustments: ReadonlyArray<{
    period_start: string;
    delta_days: number;
  }> = []
): CarryoverEntry[] {
  const plan: CarryoverEntry[] = [];
  if (asOf < hireDate) return plan;

  const closedYears = yearsOfServiceAt(hireDate, asOf);
  if (closedYears < 1) return plan;

  let carryoverIn = 0;
  for (let i = 0; i < closedYears; i++) {
    const periodStart = addYears(hireDate, i);
    const periodEnd = addYears(hireDate, i + 1);
    const periodStartIso = isoDate(periodStart);
    const periodEndIso = isoDate(periodEnd);

    // i = 0 → primer año de servicio (entitlement = 0).
    const entitlement = lftDaysForYear(i);

    let taken = 0;
    for (const r of requests) {
      if (r.status === "rechazada" || r.status === "cancelada") continue;
      if (r.start_date >= periodStartIso && r.start_date < periodEndIso) {
        taken += r.business_days;
      }
    }

    let manual = 0;
    for (const a of manualAdjustments) {
      if (a.period_start === periodStartIso) manual += a.delta_days;
    }

    const remaining = entitlement + manual + carryoverIn - taken;

    plan.push({
      period_start: periodEndIso,
      delta_days: remaining,
      source_period_start: periodStartIso,
      source_period_end: periodEndIso,
    });

    carryoverIn = remaining;
  }

  return plan;
}

function addYears(d: Date, years: number): Date {
  return new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
}

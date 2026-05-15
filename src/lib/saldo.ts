import { currentYearOfService, entitlementForCurrentYear, lastAnniversary, nextAnniversary } from "./lft-entitlement";

export interface SaldoVacaciones {
  /** Año de servicio en curso (1 = primer año, 2 = segundo, ...). */
  yearOfService: number;
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
    yearOfService: currentYearOfService(hireDate, asOf),
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

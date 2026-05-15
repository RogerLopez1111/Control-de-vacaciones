/**
 * Días de vacaciones según la Ley Federal del Trabajo (México) —
 * reforma de enero 2023 (Art. 76 LFT).
 *
 *   Año 1   → 12 días
 *   Año 2   → 14
 *   Año 3   → 16
 *   Año 4   → 18
 *   Año 5   → 20
 *   Año 6-10  → 22
 *   Año 11-15 → 24
 *   Año 16-20 → 26
 *   Año 21-25 → 28
 *   Año 26-30 → 30
 *   Año 31-35 → 32   (+2 días por cada bloque adicional de 5 años)
 */
export function lftDaysForYear(yearOfService: number): number {
  if (yearOfService < 1) return 0;
  if (yearOfService === 1) return 12;
  if (yearOfService === 2) return 14;
  if (yearOfService === 3) return 16;
  if (yearOfService === 4) return 18;
  if (yearOfService === 5) return 20;
  // From year 6 onward: +2 días por cada bloque de 5 años de servicio.
  // yrs 6-10 → +1 bloque (22), 11-15 → +2 (24), 16-20 → +3 (26), ...
  const extraBlocks = Math.floor((yearOfService - 6) / 5) + 1;
  return 20 + extraBlocks * 2;
}

/**
 * Años completos de servicio al `asOf` desde `hireDate`.
 * Devuelve 0 si aún no se cumple el primer aniversario.
 */
export function yearsOfServiceAt(hireDate: Date, asOf: Date): number {
  let years = asOf.getFullYear() - hireDate.getFullYear();
  const anniversaryThisYear = new Date(asOf.getFullYear(), hireDate.getMonth(), hireDate.getDate());
  if (asOf < anniversaryThisYear) years -= 1;
  return Math.max(0, years);
}

/**
 * Año de servicio en curso al `asOf` (años completos + 1, mínimo 1 si ya ingresó).
 * Ej.: hireDate 2024-05-15, asOf 2026-05-15 → 3er año (completó 2, va por el 3ro).
 * Si todavía no llega al primer aniversario, devuelve 1 (el año 1 está en curso).
 */
export function currentYearOfService(hireDate: Date, asOf: Date): number {
  if (asOf < hireDate) return 0;
  return yearsOfServiceAt(hireDate, asOf) + 1;
}

/**
 * Total de días de vacaciones a los que el empleado tiene derecho en el periodo
 * anual en curso (entre el último aniversario y el siguiente).
 */
export function entitlementForCurrentYear(hireDate: Date, asOf: Date): number {
  const y = currentYearOfService(hireDate, asOf);
  return lftDaysForYear(y);
}

/**
 * Fecha del aniversario más reciente antes (o igual a) `asOf`.
 * Usada para delimitar el periodo donde se cuentan días tomados.
 */
export function lastAnniversary(hireDate: Date, asOf: Date): Date {
  const candidate = new Date(asOf.getFullYear(), hireDate.getMonth(), hireDate.getDate());
  if (candidate > asOf) candidate.setFullYear(candidate.getFullYear() - 1);
  return candidate < hireDate ? hireDate : candidate;
}

/** Próximo aniversario después de `asOf`. */
export function nextAnniversary(hireDate: Date, asOf: Date): Date {
  const last = lastAnniversary(hireDate, asOf);
  const next = new Date(last);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

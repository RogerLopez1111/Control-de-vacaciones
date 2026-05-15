/**
 * Días de vacaciones según el Art. 76 LFT (México) — reforma 2023.
 *
 * El derecho a vacaciones se devenga DESPUÉS de cumplir un año completo de
 * servicio. Durante el primer año (de la fecha de ingreso al primer
 * aniversario) el empleado tiene 0 días de vacaciones.
 *
 * Tabla por años de servicio CUMPLIDOS:
 *   0 años  → 0  días (primer año en curso, aún no cumple)
 *   1 año   → 12
 *   2       → 14
 *   3       → 16
 *   4       → 18
 *   5       → 20
 *   6-10    → 22
 *   11-15   → 24
 *   16-20   → 26
 *   21-25   → 28
 *   26-30   → 30
 *   31-35   → 32   (+2 días por cada bloque de 5 años subsecuentes)
 */
export function lftDaysForYear(yearsCompleted: number): number {
  if (yearsCompleted < 1) return 0;
  if (yearsCompleted === 1) return 12;
  if (yearsCompleted === 2) return 14;
  if (yearsCompleted === 3) return 16;
  if (yearsCompleted === 4) return 18;
  if (yearsCompleted === 5) return 20;
  // 6-10 cumplidos → +1 bloque (22), 11-15 → +2 (24), 16-20 → +3 (26), ...
  const extraBlocks = Math.floor((yearsCompleted - 6) / 5) + 1;
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
 * Año de servicio en curso (1 = primer año, antes del primer aniversario).
 * Sirve solo para mostrar en UI ("vas en tu Nº año"); NO para calcular días.
 */
export function currentYearOfService(hireDate: Date, asOf: Date): number {
  if (asOf < hireDate) return 0;
  return yearsOfServiceAt(hireDate, asOf) + 1;
}

/**
 * Total de días de vacaciones a los que el empleado tiene derecho en el
 * periodo anual en curso. Se basa en años CUMPLIDOS (no en el año en curso),
 * por lo que durante el primer año el resultado es 0.
 */
export function entitlementForCurrentYear(hireDate: Date, asOf: Date): number {
  return lftDaysForYear(yearsOfServiceAt(hireDate, asOf));
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

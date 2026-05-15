/**
 * Auth helpers — el sistema usa "número de empleado" como identidad pública,
 * pero Supabase Auth requiere correo. Mapeamos cada empleado a un correo
 * sintético en el dominio interno de vacaciones.
 *
 *   employeeId 408 → emp408@vacaciones.ecosistemas.ws
 *
 * Nadie recibe correo en estos buzones (Supabase no verifica). El dominio
 * "vacaciones.ecosistemas.ws" es ficticio pero válido en sintaxis.
 */
export const SYNTHETIC_EMAIL_DOMAIN = "vacaciones.ecosistemas.ws";

export function syntheticEmailFor(employeeId: number | string): string {
  return `emp${employeeId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * Contraseña inicial: `ecosistemas` + año de ingreso (4 dígitos).
 * Ej. hire_date 2024-02-17 → "ecosistemas2024"
 */
export function defaultPasswordFor(hireDateIso: string): string {
  const year = hireDateIso.slice(0, 4);
  return `ecosistemas${year}`;
}

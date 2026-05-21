/**
 * Formato de fechas seguro a zona horaria.
 *
 * `new Date("2026-05-26")` (ISO date-only) lo interpreta JavaScript como
 * UTC medianoche; en México (UTC-6) eso se ve como 25 mayo a las 18:00
 * locales y `toLocaleDateString` imprime un día antes. Este helper parsea
 * los strings YYYY-MM-DD como medianoche LOCAL para evitar el desfase.
 *
 * Timestamps completos (`YYYY-MM-DDTHH:mm:ssZ`) son absolutos y se parsean
 * normalmente — ahí no hay ambigüedad.
 */
export function formatDateMX(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = parseLocalIfDateOnly(iso);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/** Versión "larga": día numérico + mes completo + año. Útil en documentos. */
export function formatDateMXLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = parseLocalIfDateOnly(iso);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

function parseLocalIfDateOnly(iso: string): Date {
  if (iso.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

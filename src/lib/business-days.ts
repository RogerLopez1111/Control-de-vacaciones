/**
 * Cuenta los días hábiles entre dos fechas (inclusivo), excluyendo
 * sábados, domingos, y cualquier fecha presente en `holidays`.
 *
 * `holidays` debe contener fechas en formato 'YYYY-MM-DD' (igual al date de Postgres).
 */
export function countBusinessDays(
  start: Date,
  end: Date,
  holidays: ReadonlySet<string> = new Set()
): number {
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= stop) {
    const dow = cursor.getDay(); // 0 = dom, 6 = sáb
    const iso = toISO(cursor);
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

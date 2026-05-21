/**
 * Cuenta los días hábiles entre dos fechas INCLUSIVAS (start y end cuentan
 * si son hábiles), excluyendo sábados, domingos, y fechas en `holidays`.
 *
 * Acepta strings `YYYY-MM-DD` directamente y los parsea como medianoche
 * LOCAL (no UTC) para no desplazarse un día por zona horaria.
 *
 * `holidays` debe contener fechas en formato 'YYYY-MM-DD' (mismo formato
 * que la columna `date` de Postgres).
 */
export function countBusinessDays(
  startIso: string,
  endIso: string,
  holidays: ReadonlySet<string> = new Set()
): number {
  if (!startIso || !endIso) return 0;
  if (endIso < startIso) return 0;
  let count = 0;
  const cursor = parseLocalDate(startIso);
  const stop = parseLocalDate(endIso);
  while (cursor <= stop) {
    const dow = cursor.getDay(); // 0 = dom, 6 = sáb
    if (dow !== 0 && dow !== 6 && !holidays.has(toIso(cursor))) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

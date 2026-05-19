import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface RequestWithEmployee {
  id: string;
  start_date: string;
  end_date: string;
  status: "pendiente" | "aprobada";
  employee:
    | { id: number; nombre: string; apellido_paterno: string | null }
    | { id: number; nombre: string; apellido_paterno: string | null }[]
    | null;
}

interface Bar {
  requestId: string;
  employeeId: number;
  fullName: string;
  initials: string;
  status: "pendiente" | "aprobada";
  startCol: number;     // 1..7 (lunes=1)
  endCol: number;       // 1..7 inclusive
  lane: number;         // 0-indexed
  isStart: boolean;     // true si la solicitud arranca en esta semana
  isEnd: boolean;       // true si termina en esta semana
}

interface Week {
  days: { date: Date; inCurrentMonth: boolean; iso: string; isToday: boolean }[];
  bars: Bar[];
  laneCount: number;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { month: monthParam } = await searchParams;
  const today = new Date();
  const { year, month } = parseMonth(monthParam, today);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const todayIso = isoDate(today);

  // RLS filtra automáticamente lo que el usuario tiene derecho a ver.
  const { data: requests } = await supabase
    .from("vacation_requests")
    .select(`
      id, start_date, end_date, status,
      employee:employees!vacation_requests_employee_id_fkey ( id, nombre, apellido_paterno )
    `)
    .in("status", ["pendiente", "aprobada"])
    .lt("start_date", isoDate(monthEnd))
    .gte("end_date", isoDate(monthStart));

  const weeks = buildWeeks(year, month, todayIso, (requests ?? []) as RequestWithEmployee[]);
  const monthLabel = monthStart.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-brand-gray hover:text-brand-navy">← Dashboard</Link>
        <div className="flex items-center gap-3">
          <Link href={`/calendario?month=${prev}`} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">←</Link>
          <h1 className="text-xl font-semibold text-brand-navy capitalize tabular-nums w-56 text-center">
            {monthLabel}
          </h1>
          <Link href={`/calendario?month=${next}`} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">→</Link>
        </div>
        <Link href="/calendario" className="text-sm text-brand-gray hover:text-brand-navy">Hoy</Link>
      </div>

      <div className="border border-neutral-200 bg-white">
        {/* Encabezado de días de la semana */}
        <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-100">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-xs font-medium text-brand-navy text-center">
              {d}
            </div>
          ))}
        </div>

        {/* Semanas */}
        {weeks.map((w, wi) => {
          const minRowHeight = 32 + Math.max(0, w.laneCount) * 22 + 6; // header del día + carriles + colchón
          return (
            <div
              key={wi}
              className="grid grid-cols-7"
              style={{
                gridTemplateRows: `auto${w.laneCount > 0 ? ` repeat(${w.laneCount}, 22px)` : ""}`,
                minHeight: `${minRowHeight}px`,
              }}
            >
              {/* Celdas-fondo de cada día (ocupan todas las filas de la semana) */}
              {w.days.map((d, di) => (
                <div
                  key={`bg-${di}`}
                  className={`border-r border-b border-neutral-100 ${
                    d.inCurrentMonth ? "" : "bg-neutral-50"
                  } ${d.isToday ? "ring-2 ring-inset ring-brand-red" : ""}`}
                  style={{ gridColumn: di + 1, gridRow: `1 / ${w.laneCount + 2}` }}
                >
                  <div className={`px-1.5 py-1 text-xs tabular-nums ${
                    d.isToday ? "font-bold text-brand-red" : d.inCurrentMonth ? "text-brand-navy" : "text-neutral-400"
                  }`}>
                    {d.date.getDate()}
                  </div>
                </div>
              ))}

              {/* Barras de solicitudes (encima de los fondos) */}
              {w.bars.map((b, bi) => (
                <div
                  key={`bar-${b.requestId}-${b.lane}-${bi}`}
                  title={`${b.fullName} · ${b.status === "aprobada" ? "aprobada" : "pendiente"}`}
                  className={`relative z-10 mx-0.5 my-px h-[20px] flex items-center px-1.5 text-[11px] font-medium truncate ${
                    b.status === "aprobada"
                      ? "bg-brand-navy text-white"
                      : "border border-brand-red bg-brand-red-tint text-brand-red"
                  } ${b.isStart ? "rounded-l-sm" : ""} ${b.isEnd ? "rounded-r-sm" : ""}`}
                  style={{
                    gridColumn: `${b.startCol} / ${b.endCol + 1}`,
                    gridRow: b.lane + 2, // +1 por header de día, +1 por 1-indexed
                  }}
                >
                  <span className="truncate">{b.fullName}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-brand-gray">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-5 bg-brand-navy"></span> aprobada
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-5 border border-brand-red bg-brand-red-tint"></span> pendiente
        </span>
        <span className="ml-auto">Pasa el cursor sobre una barra para ver el nombre completo y estatus.</span>
      </div>
    </main>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function parseMonth(param: string | undefined, today: Date): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  return { year: today.getFullYear(), month: today.getMonth() };
}

function shiftMonth(y: number, m: number, delta: number): string {
  const d = new Date(y, m + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes = 1, ..., Domingo = 7. */
function dowMondayBased(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/** Inicio de la semana (lunes) que contiene `d`, a medianoche local. */
function mondayOf(d: Date): Date {
  const offset = dowMondayBased(d) - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function getInitials(nombre: string, apellido: string | null): string {
  const a = (nombre.trim()[0] ?? "").toUpperCase();
  const b = ((apellido ?? "").trim()[0] ?? "").toUpperCase();
  return (a + b) || "??";
}

function buildWeeks(
  year: number,
  month: number,
  todayIso: string,
  requests: RequestWithEmployee[]
): Week[] {
  const gridStart = mondayOf(new Date(year, month, 1));
  const weeks: Week[] = [];
  for (let w = 0; w < 6; w++) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(gridStart, w * 7 + i);
      return {
        date,
        inCurrentMonth: date.getMonth() === month,
        iso: isoDate(date),
        isToday: isoDate(date) === todayIso,
      };
    });
    weeks.push({ days, bars: [], laneCount: 0 });
  }

  // Segmenta cada solicitud por semana visible
  for (const r of requests) {
    const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee;
    if (!emp) continue;
    const fullName = `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim();
    const initials = getInitials(emp.nombre, emp.apellido_paterno);
    const reqStart = parseIsoDateLocal(r.start_date);
    const reqEnd = parseIsoDateLocal(r.end_date);

    for (const week of weeks) {
      const weekStart = week.days[0].date;
      const weekEnd = week.days[6].date;
      const segStart = reqStart > weekStart ? reqStart : weekStart;
      const segEnd = reqEnd < weekEnd ? reqEnd : weekEnd;
      if (segStart > segEnd) continue; // sin solapamiento

      week.bars.push({
        requestId: r.id,
        employeeId: emp.id,
        fullName,
        initials,
        status: r.status,
        startCol: dowMondayBased(segStart),
        endCol: dowMondayBased(segEnd),
        lane: 0, // se asigna después
        isStart: isoDate(segStart) === r.start_date,
        isEnd: isoDate(segEnd) === r.end_date,
      });
    }
  }

  // Asignación de carriles (greedy interval scheduling por semana)
  for (const week of weeks) {
    week.bars.sort((a, b) =>
      a.startCol - b.startCol ||
      (b.endCol - b.startCol) - (a.endCol - a.startCol) ||
      a.fullName.localeCompare(b.fullName)
    );
    const lanes: Bar[][] = [];
    for (const bar of week.bars) {
      let placed = false;
      for (let li = 0; li < lanes.length; li++) {
        const conflict = lanes[li].some((x) => !(x.endCol < bar.startCol || x.startCol > bar.endCol));
        if (!conflict) {
          lanes[li].push(bar);
          bar.lane = li;
          placed = true;
          break;
        }
      }
      if (!placed) {
        bar.lane = lanes.length;
        lanes.push([bar]);
      }
    }
    week.laneCount = lanes.length;
  }

  return weeks;
}

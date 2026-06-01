import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface RequestWithEmployee {
  id: string;
  start_date: string;
  end_date: string;
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
  startCol: number;     // 1..7 (lunes=1)
  endCol: number;       // 1..7 inclusive
  lane: number;         // 0-indexed
  isStart: boolean;
  isEnd: boolean;
  isPreview: boolean;   // solicitud pendiente en modo vista previa
}

interface Week {
  days: { date: Date; inCurrentMonth: boolean; iso: string; isToday: boolean }[];
  bars: Bar[];
  laneCount: number;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; preview?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { month: monthParam, preview: previewId } = await searchParams;
  const today = new Date();
  const { year, month } = parseMonth(monthParam, today);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const todayIso = isoDate(today);

  const admin = createSupabaseAdminClient();

  // Vacaciones aprobadas del mes
  const { data: requests } = await admin
    .from("vacation_requests")
    .select(`
      id, start_date, end_date,
      employee:employees!vacation_requests_employee_id_fkey ( id, nombre, apellido_paterno )
    `)
    .eq("status", "aprobada")
    .lt("start_date", isoDate(monthEnd))
    .gte("end_date", isoDate(monthStart));

  // Solicitud pendiente en vista previa (si viene ?preview=)
  let previewRequest: RequestWithEmployee | null = null;
  let previewEmpName = "";
  if (previewId) {
    const { data } = await admin
      .from("vacation_requests")
      .select(`
        id, start_date, end_date,
        employee:employees!vacation_requests_employee_id_fkey ( id, nombre, apellido_paterno )
      `)
      .eq("id", previewId)
      .single();
    if (data) {
      previewRequest = data as RequestWithEmployee;
      const emp = Array.isArray(previewRequest.employee)
        ? previewRequest.employee[0]
        : previewRequest.employee;
      if (emp) previewEmpName = `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim();
    }
  }

  const weeks = buildWeeks(
    year, month, todayIso,
    (requests ?? []) as RequestWithEmployee[],
    previewRequest ? [previewRequest] : [],
  );
  const monthLabel = monthStart.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  // Los enlaces de navegación preservan ?preview= para que la barra siga visible al cambiar mes
  const ps = previewId ? `&preview=${previewId}` : "";
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <main className="mx-auto max-w-6xl">
      {/* Barra de navegación */}
      <div className="bg-brand-navy flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm text-white/60 hover:text-white">← Dashboard</Link>
        <div className="flex items-center gap-0">
          <Link
            href={`/calendario?month=${prev}${ps}`}
            className="px-4 py-1.5 text-white border border-white/20 hover:bg-white/10 text-sm font-medium"
          >
            ‹
          </Link>
          <h1 className="text-sm font-semibold text-white capitalize tabular-nums px-6 border-x border-white/20 py-1.5 w-52 text-center tracking-wide">
            {monthLabel}
          </h1>
          <Link
            href={`/calendario?month=${next}${ps}`}
            className="px-4 py-1.5 text-white border border-white/20 hover:bg-white/10 text-sm font-medium"
          >
            ›
          </Link>
        </div>
        <Link
          href={previewId ? `/calendario?preview=${previewId}` : "/calendario"}
          className="text-sm text-white/60 hover:text-white"
        >
          Hoy
        </Link>
      </div>

      {/* Banner de vista previa */}
      {previewRequest && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-amber-900">
            <strong>Vista previa (pendiente):</strong>{" "}
            {previewEmpName} ·{" "}
            {fmtDate(previewRequest.start_date)} – {fmtDate(previewRequest.end_date)}
            {" "}· Las barras rayadas indican los días solicitados.
          </p>
          <Link
            href={`/calendario?month=${currentMonthStr}`}
            className="text-xs text-amber-700 hover:text-amber-900 font-medium ml-4 shrink-0"
          >
            × Cerrar
          </Link>
        </div>
      )}

      <div className="border border-neutral-200 border-t-0 bg-white">
        {/* Encabezado días de la semana */}
        <div className="grid grid-cols-7 bg-brand-navy/90">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-white/80 text-center tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {/* Semanas */}
        {weeks.map((w, wi) => {
          const minRowHeight = 36 + Math.max(0, w.laneCount) * 24 + 6;
          return (
            <div
              key={wi}
              className="grid grid-cols-7"
              style={{
                gridTemplateRows: `auto${w.laneCount > 0 ? ` repeat(${w.laneCount}, 24px)` : ""}`,
                minHeight: `${minRowHeight}px`,
              }}
            >
              {w.days.map((d, di) => (
                <div
                  key={`bg-${di}`}
                  className={`border-r border-b border-neutral-100 ${d.inCurrentMonth ? "bg-white" : "bg-neutral-50"}`}
                  style={{ gridColumn: di + 1, gridRow: `1 / ${w.laneCount + 2}` }}
                >
                  <div className="px-2 pt-1.5 pb-0.5 flex justify-end">
                    <span className={`text-xs tabular-nums inline-flex items-center justify-center w-6 h-6 font-medium
                      ${d.isToday
                        ? "bg-brand-red text-white font-bold rounded-full"
                        : d.inCurrentMonth
                          ? "text-brand-navy"
                          : "text-neutral-300"
                      }`}
                    >
                      {d.date.getDate()}
                    </span>
                  </div>
                </div>
              ))}

              {w.bars.map((b, bi) => {
                const color = BAR_COLORS[b.employeeId % BAR_COLORS.length];
                return (
                  <div
                    key={`bar-${b.requestId}-${b.lane}-${bi}`}
                    title={b.isPreview ? `${b.fullName} (pendiente)` : b.fullName}
                    className="relative z-10 mx-px my-0.5 h-[22px] flex items-center px-2 text-[11px] font-medium truncate text-white"
                    style={{
                      gridColumn: `${b.startCol} / ${b.endCol + 1}`,
                      gridRow: b.lane + 2,
                      backgroundColor: color,
                      backgroundImage: b.isPreview
                        ? `repeating-linear-gradient(-45deg, transparent 0px, transparent 4px, rgba(255,255,255,0.28) 4px, rgba(255,255,255,0.28) 8px)`
                        : undefined,
                      borderLeft: b.isStart
                        ? `3px ${b.isPreview ? "dashed" : "solid"} ${dimColor(color)}`
                        : "none",
                      outline: b.isPreview ? `1.5px dashed ${dimColor(color)}` : undefined,
                      outlineOffset: b.isPreview ? "-1px" : undefined,
                      opacity: b.isPreview ? 0.82 : 0.92,
                    }}
                  >
                    <span className="truncate">
                      {b.isStart ? (b.isPreview ? `${b.fullName} (pendiente)` : b.fullName) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-brand-gray px-4 pt-3 pb-4">
        {previewRequest
          ? "Barras sólidas = aprobadas · Barras rayadas = pendiente de autorización."
          : "Solo vacaciones aprobadas. Pasa el cursor sobre una barra para ver el nombre completo."}
      </p>
    </main>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

const BAR_COLORS = [
  "#141456", // brand-navy
  "#B70B0F", // brand-red
  "#1a6b3c", // green
  "#7c3d8c", // purple
  "#c4700a", // amber
  "#0e6e8c", // teal
  "#7a3b1e", // brown
  "#3d5a8a", // steel blue
];

function dimColor(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

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
  requests: RequestWithEmployee[],
  previewRequests: RequestWithEmployee[] = [],
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

  function pushBars(list: RequestWithEmployee[], isPreview: boolean) {
    for (const r of list) {
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
        if (segStart > segEnd) continue;

        week.bars.push({
          requestId: r.id,
          employeeId: emp.id,
          fullName,
          initials,
          startCol: dowMondayBased(segStart),
          endCol: dowMondayBased(segEnd),
          lane: 0,
          isStart: isoDate(segStart) === r.start_date,
          isEnd: isoDate(segEnd) === r.end_date,
          isPreview,
        });
      }
    }
  }

  pushBars(requests, false);
  pushBars(previewRequests, true);

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

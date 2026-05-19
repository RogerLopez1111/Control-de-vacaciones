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

interface DayCellEntry {
  requestId: string;
  employeeId: number;
  fullName: string;
  initials: string;
  status: "pendiente" | "aprobada";
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
  const monthEnd = new Date(year, month + 1, 1); // exclusive

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

  const cellsByDay = buildCellMap((requests ?? []) as RequestWithEmployee[]);
  const gridDays = buildMonthGrid(year, month);
  const monthLabel = monthStart.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const prev = prevMonthString(year, month);
  const next = nextMonthString(year, month);
  const todayIso = isoDate(today);

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

      <div className="grid grid-cols-7 border border-neutral-200 bg-white">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-neutral-200 bg-neutral-100 px-2 py-1.5 text-xs font-medium text-brand-navy text-center">
            {d}
          </div>
        ))}
        {gridDays.map((d, idx) => {
          const iso = isoDate(d.date);
          const entries = cellsByDay.get(iso) ?? [];
          const isToday = iso === todayIso;
          const inMonth = d.inCurrentMonth;
          return (
            <div
              key={idx}
              className={`min-h-[110px] border-b border-r border-neutral-100 p-1.5 ${
                inMonth ? "" : "bg-neutral-50 text-neutral-400"
              } ${isToday ? "border-2 border-brand-red" : ""}`}
            >
              <div className={`text-xs ${isToday ? "font-bold text-brand-red" : inMonth ? "text-brand-navy" : ""} tabular-nums`}>
                {d.date.getDate()}
              </div>
              {entries.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {entries.slice(0, 8).map((e) => (
                    <span
                      key={`${e.requestId}-${e.employeeId}`}
                      title={`${e.fullName} · ${e.status === "aprobada" ? "aprobada" : "pendiente"}`}
                      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[10px] font-semibold tabular-nums ${
                        e.status === "aprobada"
                          ? "bg-brand-navy text-white"
                          : "border border-brand-red text-brand-red bg-brand-red-tint"
                      }`}
                    >
                      {e.initials}
                    </span>
                  ))}
                  {entries.length > 8 && (
                    <span className="text-[10px] text-brand-gray">+{entries.length - 8}</span>
                  )}
                </div>
              )}
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
        <span className="ml-auto">Pasa el cursor sobre las iniciales para ver el nombre completo.</span>
      </div>
    </main>
  );
}

// ---------- helpers ---------------------------------------------------------

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function parseMonth(param: string | undefined, today: Date): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  return { year: today.getFullYear(), month: today.getMonth() };
}

function prevMonthString(y: number, m: number): string {
  const d = new Date(y, m - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonthString(y: number, m: number): string {
  const d = new Date(y, m + 1, 1);
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

function buildMonthGrid(year: number, month: number): { date: Date; inCurrentMonth: boolean }[] {
  const first = new Date(year, month, 1);
  // Lunes = 0 en la cuadrícula. getDay(): dom=0, lun=1, ... sáb=6
  const dowMondayBased = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - dowMondayBased);
  const cells: { date: Date; inCurrentMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({ date: d, inCurrentMonth: d.getMonth() === month });
  }
  return cells;
}

function getInitials(nombre: string, apellido: string | null): string {
  const a = (nombre.trim()[0] ?? "").toUpperCase();
  const b = ((apellido ?? "").trim()[0] ?? "").toUpperCase();
  return (a + b) || "??";
}

function buildCellMap(requests: RequestWithEmployee[]): Map<string, DayCellEntry[]> {
  const map = new Map<string, DayCellEntry[]>();
  for (const r of requests) {
    const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee;
    if (!emp) continue;
    const fullName = `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim();
    const initials = getInitials(emp.nombre, emp.apellido_paterno);
    const start = parseIsoDateLocal(r.start_date);
    const end = parseIsoDateLocal(r.end_date);
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = isoDate(cursor);
      const entry: DayCellEntry = {
        requestId: r.id,
        employeeId: emp.id,
        fullName,
        initials,
        status: r.status,
      };
      const list = map.get(iso);
      if (list) list.push(entry); else map.set(iso, [entry]);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}

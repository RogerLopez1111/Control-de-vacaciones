import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calcularSaldo, type SaldoVacaciones } from "@/lib/saldo";

interface EmpleadoRow {
  id: number;
  nombre: string;
  apellido_paterno: string | null;
  branch_id: number | null;
  hire_date: string;
  is_admin: boolean;
  area_id: string | null;
}

interface BranchRow { id: number; nombre: string }
interface AreaRow { id: string; nombre: string; display_order: number }
interface RequestRow {
  employee_id: number;
  start_date: string;
  end_date: string;
  business_days: number;
  status: "pendiente" | "aprobada" | "rechazada" | "cancelada";
}
interface AdjustmentRow {
  employee_id: number;
  period_start: string;
  delta_days: number;
}

interface ComputedRow {
  e: EmpleadoRow;
  saldo: SaldoVacaciones;
  branch: string;
}

const COL_COUNT = 11;

export default async function AdminEmpleadosPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: employees }, { data: branches }, { data: areas }, { data: requests }, { data: adjustments }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, nombre, apellido_paterno, branch_id, hire_date, is_admin, area_id")
      .is("termination_date", null)
      .order("apellido_paterno"),
    supabase.from("branches").select("id, nombre"),
    supabase.from("areas").select("id, nombre, display_order").order("display_order"),
    supabase.from("vacation_requests").select("employee_id, start_date, end_date, business_days, status"),
    supabase.from("vacation_adjustments").select("employee_id, period_start, delta_days"),
  ]);

  const branchById = new Map<number, string>();
  for (const b of (branches ?? []) as BranchRow[]) branchById.set(b.id, b.nombre);

  const reqByEmployee = groupBy<RequestRow, number>((requests ?? []) as RequestRow[], (r) => r.employee_id);
  const adjByEmployee = groupBy<AdjustmentRow, number>((adjustments ?? []) as AdjustmentRow[], (a) => a.employee_id);

  const asOf = new Date();
  const computed: ComputedRow[] = ((employees ?? []) as EmpleadoRow[]).map((e) => {
    const saldo = calcularSaldo(new Date(e.hire_date), asOf, reqByEmployee.get(e.id) ?? [], adjByEmployee.get(e.id) ?? []);
    return { e, saldo, branch: e.branch_id ? branchById.get(e.branch_id) ?? "—" : "—" };
  });

  // Agrupar por área (área null = "Sin área asignada", siempre al final).
  const rowsByArea = new Map<string | null, ComputedRow[]>();
  for (const r of computed) {
    const key = r.e.area_id;
    const list = rowsByArea.get(key);
    if (list) list.push(r); else rowsByArea.set(key, [r]);
  }

  const orderedAreas = (areas ?? []) as AreaRow[];
  const sections: { label: string; sublabel?: string; rows: ComputedRow[] }[] = [];
  for (const a of orderedAreas) {
    const rows = rowsByArea.get(a.id);
    if (!rows?.length) continue;
    sections.push({ label: a.nombre, rows });
  }
  const sinArea = rowsByArea.get(null);
  if (sinArea?.length) sections.push({ label: "Sin área asignada", sublabel: "asígnale un área desde el detalle", rows: sinArea });

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy">Empleados</h1>
        <span className="text-sm text-brand-gray">{computed.length} empleados activos · {sections.length} áreas</span>
      </div>

      <div className="overflow-x-auto border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-brand-navy">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Sucursal</th>
              <th className="px-3 py-2">Ingreso</th>
              <th className="px-3 py-2 text-right">Antigüedad</th>
              <th className="px-3 py-2 text-right">Derecho</th>
              <th className="px-3 py-2 text-right">Ajustes</th>
              <th className="px-3 py-2 text-right">Tomados</th>
              <th className="px-3 py-2 text-right">Pendientes</th>
              <th className="px-3 py-2 text-right">Disponibles</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <SectionGroup key={s.label} label={s.label} sublabel={s.sublabel} rows={s.rows} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function SectionGroup({ label, sublabel, rows }: { label: string; sublabel?: string; rows: ComputedRow[] }) {
  return (
    <>
      <tr className="bg-brand-navy-tint border-t-2 border-brand-navy">
        <td colSpan={COL_COUNT} className="px-3 py-2 text-brand-navy">
          <span className="font-semibold">{label}</span>
          <span className="ml-2 text-xs text-brand-gray">
            {rows.length} {rows.length === 1 ? "empleado" : "empleados"}
            {sublabel ? ` · ${sublabel}` : ""}
          </span>
        </td>
      </tr>
      {rows.map(({ e, saldo, branch }) => (
        <tr key={e.id} className="border-t border-neutral-100 hover:bg-neutral-50">
          <td className="px-3 py-2 tabular-nums text-brand-gray">{e.id}</td>
          <td className="px-3 py-2">
            {e.nombre} {e.apellido_paterno ?? ""}
            {e.is_admin && <span className="ml-2 rounded-full bg-brand-navy-tint text-brand-navy text-xs px-2 py-0.5">admin</span>}
          </td>
          <td className="px-3 py-2 text-brand-gray">{branch}</td>
          <td className="px-3 py-2 tabular-nums text-brand-gray">{e.hire_date}</td>
          <td className="px-3 py-2 text-right tabular-nums">{saldo.yearsCompleted}</td>
          <td className="px-3 py-2 text-right tabular-nums">{saldo.entitlement}</td>
          <td className={`px-3 py-2 text-right tabular-nums ${saldo.adjustments !== 0 ? "font-medium" : "text-brand-gray"}`}>
            {saldo.adjustments > 0 ? `+${saldo.adjustments}` : saldo.adjustments}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">{saldo.taken}</td>
          <td className="px-3 py-2 text-right tabular-nums">{saldo.pending}</td>
          <td className="px-3 py-2 text-right tabular-nums font-semibold text-brand-navy">{saldo.available}</td>
          <td className="px-3 py-2 text-right">
            <Link href={`/admin/empleados/${e.id}`} className="text-brand-red hover:underline">Ver</Link>
          </td>
        </tr>
      ))}
    </>
  );
}

function groupBy<T, K>(arr: ReadonlyArray<T>, key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of arr) {
    const k = key(x);
    const cur = m.get(k);
    if (cur) cur.push(x); else m.set(k, [x]);
  }
  return m;
}

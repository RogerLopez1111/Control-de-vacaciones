import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calcularSaldo } from "@/lib/saldo";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empleado } = await supabase
    .from("employees")
    .select("id, nombre, apellido_paterno, apellido_materno, hire_date, is_admin, manager_employee_id, branch_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!empleado) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Tu correo ({user.email}) no está vinculado a un empleado en el sistema.
          Comunícate con Recursos Humanos.
        </div>
      </main>
    );
  }

  const [{ data: solicitudes }, { data: ajustes }, { count: reportesCount }] = await Promise.all([
    supabase
      .from("vacation_requests")
      .select("id, start_date, end_date, business_days, status, requested_at, decision_comment")
      .eq("employee_id", empleado.id)
      .order("requested_at", { ascending: false }),
    supabase
      .from("vacation_adjustments")
      .select("id, period_start, delta_days, reason, adjusted_at")
      .eq("employee_id", empleado.id)
      .order("adjusted_at", { ascending: false }),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("manager_employee_id", empleado.id),
  ]);

  const hireDate = new Date(empleado.hire_date);
  const asOf = new Date();
  const saldo = calcularSaldo(hireDate, asOf, solicitudes ?? [], ajustes ?? []);
  const todayIso = asOf.toISOString().slice(0, 10);
  const periodStartIso = saldo.periodStart.toISOString().slice(0, 10);
  const ajustesPeriodo = (ajustes ?? []).filter((a) => a.period_start === periodStartIso);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
        <img
          src="https://cdn.shopify.com/s/files/1/0771/6975/4358/files/logo-footer_fc28a06e-0691-4e47-83e3-d3888c3202bb.png?v=1759271820"
          alt="Ecosistemas"
          className="h-8"
        />
        <span className="text-sm font-medium text-brand-navy">Control de Vacaciones</span>
      </div>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">
            Hola, {empleado.nombre}
          </h1>
          <p className="text-sm text-brand-gray">
            Antigüedad: <strong>{saldo.yearsCompleted} año{saldo.yearsCompleted === 1 ? "" : "s"}</strong> · Periodo:{" "}
            {fmt(saldo.periodStart)} → {fmt(saldo.periodEnd)}
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/solicitar" className="rounded-md bg-brand-red px-3 py-2 text-white hover:opacity-90">Solicitar vacaciones</Link>
          <Link href="/calendario" className="rounded-md border border-brand-navy text-brand-navy px-3 py-2 hover:bg-brand-navy-tint">Calendario</Link>
          {(reportesCount && reportesCount > 0) || empleado.is_admin ? (
            <Link href="/aprobaciones" className="rounded-md border border-brand-navy text-brand-navy px-3 py-2 hover:bg-brand-navy-tint">Aprobaciones</Link>
          ) : null}
          {empleado.is_admin && (
            <Link href="/admin/empleados" className="rounded-md border border-brand-navy text-brand-navy px-3 py-2 hover:bg-brand-navy-tint">Empleados</Link>
          )}
        </nav>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Derecho" value={saldo.entitlement} />
        <Stat label="Ajustes" value={saldo.adjustments} signed />
        <Stat label="Tomados" value={saldo.taken} />
        <Stat label="Pendientes" value={saldo.pending} />
        <Stat label="Disponibles" value={saldo.available} highlight />
      </section>

      {ajustesPeriodo.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-brand-navy mb-2">Ajustes de RRHH (este periodo)</h2>
          <ul className="border border-neutral-200 bg-white divide-y divide-neutral-100">
            {ajustesPeriodo.map((a) => (
              <li key={a.id} className="px-3 py-2 text-sm flex items-baseline gap-3">
                <span className={`tabular-nums font-medium ${a.delta_days > 0 ? "text-green-700" : "text-brand-red"}`}>
                  {a.delta_days > 0 ? `+${a.delta_days}` : a.delta_days}
                </span>
                <span className="flex-1">{a.reason}</span>
                <span className="text-xs text-brand-gray">{fmtISO(a.adjusted_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium text-brand-navy mb-2">Tus solicitudes</h2>
        <div className="overflow-x-auto border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left text-neutral-700">
              <tr>
                <th className="px-3 py-2">Desde</th>
                <th className="px-3 py-2">Hasta</th>
                <th className="px-3 py-2">Días</th>
                <th className="px-3 py-2">Estatus</th>
                <th className="px-3 py-2">Solicitada</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(solicitudes ?? []).length === 0 ? (
                <tr><td className="px-3 py-6 text-center text-neutral-500" colSpan={6}>Aún no has solicitado vacaciones.</td></tr>
              ) : (solicitudes!.map((s) => {
                const isEditable = s.start_date > todayIso && (s.status === "pendiente" || s.status === "aprobada");
                return (
                  <tr key={s.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{fmtISO(s.start_date)}</td>
                    <td className="px-3 py-2">{fmtISO(s.end_date)}</td>
                    <td className="px-3 py-2">{s.business_days}</td>
                    <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2 text-neutral-500">{fmtISO(s.requested_at)}</td>
                    <td className="px-3 py-2 text-right space-x-3">
                      {s.status === "aprobada" && (
                        <Link href={`/comprobante/${s.id}`} className="text-brand-navy hover:underline text-xs">
                          Comprobante
                        </Link>
                      )}
                      {isEditable && (
                        <Link href={`/solicitar/editar/${s.id}`} className="text-brand-red hover:underline text-xs">
                          Modificar
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, highlight, signed }: { label: string; value: number; highlight?: boolean; signed?: boolean }) {
  const display = signed && value > 0 ? `+${value}` : value;
  return (
    <div className={`border p-4 ${highlight ? "border-brand-navy bg-brand-navy text-white" : "border-neutral-200 bg-white"}`}>
      <div className={`text-xs ${highlight ? "text-neutral-300" : "text-brand-gray"}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{display}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendiente: "bg-amber-100 text-amber-900",
    aprobada: "bg-green-100 text-green-900",
    rechazada: "bg-brand-red-tint text-brand-red",
    cancelada: "bg-neutral-200 text-neutral-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[status] ?? ""}`}>{status}</span>;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtISO(iso: string): string {
  return fmt(new Date(iso));
}

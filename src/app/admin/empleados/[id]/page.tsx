import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calcularSaldo } from "@/lib/saldo";
import { ensureCarryoverAdjustments, isWithinPostAnniversaryWindow } from "@/lib/carryover";
import { formatDateMX } from "@/lib/format";
import { AjusteForm } from "./ajuste-form";
import { RoleToggle } from "./role-toggle";
import { AreaPicker } from "./area-picker";
import { NotificationEmailForm } from "./notification-email-form";
import { PasswordResetForm } from "./password-reset-form";

export default async function EmpleadoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: caller } = user
    ? await supabase.from("employees").select("id").eq("auth_user_id", user.id).single()
    : { data: null };

  const { data: e } = await supabase.from("employees")
    .select("id, codigo_alterno, nombre, apellido_paterno, apellido_materno, email, notification_email, branch_id, hire_date, is_admin, auth_user_id, password_changed_at, area_id, manager_employee_id")
    .eq("id", id)
    .single();

  if (!e) notFound();

  const asOf = new Date();
  if (isWithinPostAnniversaryWindow(new Date(e.hire_date), asOf)) {
    await ensureCarryoverAdjustments([{ id: e.id, hire_date: e.hire_date }], asOf);
  }

  const [{ data: requests }, { data: adjustments }, { data: branches }, { data: areas }] = await Promise.all([
    supabase.from("vacation_requests")
      .select("id, start_date, end_date, business_days, status, requested_at, decision_comment")
      .eq("employee_id", id)
      .order("requested_at", { ascending: false }),
    supabase.from("vacation_adjustments")
      .select("id, period_start, delta_days, reason, adjusted_at, adjusted_by_employee_id, kind")
      .eq("employee_id", id)
      .order("adjusted_at", { ascending: false }),
    supabase.from("branches").select("id, nombre"),
    supabase.from("areas").select("id, nombre").order("display_order"),
  ]);

  const branch = (branches ?? []).find((b) => b.id === e.branch_id)?.nombre ?? "—";
  const saldo = calcularSaldo(new Date(e.hire_date), asOf, requests ?? [], adjustments ?? []);
  const periodStartIso = saldo.periodStart.toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <Link href="/admin/empleados" className="text-sm text-brand-gray hover:text-brand-navy">← Volver a empleados</Link>

      <header>
        <h1 className="text-2xl font-semibold text-brand-navy">
          {e.nombre} {e.apellido_paterno} {e.apellido_materno}
          {e.is_admin && <span className="ml-2 align-middle rounded-full bg-brand-navy-tint text-brand-navy text-xs px-2 py-0.5">admin</span>}
        </h1>
        <p className="text-sm text-brand-gray mt-1">
          ID <span className="tabular-nums">{e.id}</span> · Código <span className="tabular-nums">{e.codigo_alterno ?? "—"}</span> · {branch} · Ingreso {e.hire_date}
        </p>
        <p className="text-xs text-brand-gray mt-0.5">
          {e.email ?? "sin correo"} · {e.password_changed_at ? "ya cambió contraseña" : <span className="text-brand-red">contraseña default</span>}
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Antigüedad" value={saldo.yearsCompleted} />
        <Stat label="Derecho" value={saldo.entitlement} />
        <Stat label="Ajustes" value={saldo.adjustments} signed />
        <Stat label="Tomados / Pend." value={`${saldo.taken} / ${saldo.pending}`} />
        <Stat label="Disponibles" value={saldo.available} highlight />
      </section>
      <p className="text-xs text-brand-gray">
        Periodo en curso: {fmt(saldo.periodStart)} → {fmt(saldo.periodEnd)}
      </p>

      <section>
        <h2 className="text-lg font-semibold text-brand-navy mb-2">Área y permisos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AreaPicker employeeId={id} currentAreaId={e.area_id} areas={areas ?? []} />
          <RoleToggle employeeId={id} isAdmin={!!e.is_admin} isSelf={caller?.id === id} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-brand-navy mb-2">Correo corporativo de notificaciones</h2>
        <NotificationEmailForm
          employeeId={id}
          currentNotificationEmail={e.notification_email}
          fallbackEmail={e.email}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-brand-navy mb-2">Contraseña</h2>
        <PasswordResetForm
          employeeId={id}
          hasAuthAccount={!!e.auth_user_id}
          hireYear={e.hire_date.slice(0, 4)}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-brand-navy mb-2">Ajustar saldo del periodo</h2>
        <AjusteForm employeeId={id} periodStart={periodStartIso} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-brand-navy mb-2">Historial de ajustes</h2>
        {(adjustments ?? []).length === 0 ? (
          <p className="text-sm text-brand-gray">Sin ajustes registrados.</p>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left text-brand-navy">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Periodo</th>
                  <th className="px-3 py-2 text-right">Δ Días</th>
                  <th className="px-3 py-2">Razón</th>
                </tr>
              </thead>
              <tbody>
                {(adjustments ?? []).map((a) => (
                  <tr key={a.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 text-brand-gray">{fmtISO(a.adjusted_at)}</td>
                    <td className="px-3 py-2 text-brand-gray tabular-nums">{a.period_start}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${a.delta_days > 0 ? "text-green-700" : "text-brand-red"}`}>
                      {a.delta_days > 0 ? `+${a.delta_days}` : a.delta_days}
                    </td>
                    <td className="px-3 py-2">
                      {a.reason}
                      {a.kind === "carryover" && (
                        <span className="ml-2 align-middle rounded-full bg-neutral-200 text-brand-gray text-xs px-2 py-0.5">
                          automático
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-brand-navy mb-2">Solicitudes</h2>
        {(requests ?? []).length === 0 ? (
          <p className="text-sm text-brand-gray">No ha solicitado vacaciones.</p>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left text-brand-navy">
                <tr>
                  <th className="px-3 py-2">Desde</th>
                  <th className="px-3 py-2">Hasta</th>
                  <th className="px-3 py-2 text-right">Días</th>
                  <th className="px-3 py-2">Estatus</th>
                  <th className="px-3 py-2">Solicitada</th>
                </tr>
              </thead>
              <tbody>
                {(requests ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 tabular-nums">{r.start_date}</td>
                    <td className="px-3 py-2 tabular-nums">{r.end_date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.business_days}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-brand-gray">{fmtISO(r.requested_at)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "aprobada" && (
                        <Link href={`/comprobante/${r.id}`} className="text-brand-navy hover:underline text-xs">
                          Comprobante
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, highlight, signed }: { label: string; value: number | string; highlight?: boolean; signed?: boolean }) {
  const display = signed && typeof value === "number" && value > 0 ? `+${value}` : value;
  return (
    <div className={`border p-3 ${highlight ? "border-brand-navy bg-brand-navy text-white" : "border-neutral-200 bg-white"}`}>
      <div className={`text-xs ${highlight ? "text-neutral-300" : "text-brand-gray"}`}>{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{display}</div>
    </div>
  );
}

function fmt(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
const fmtISO = formatDateMX;

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AprobacionRow } from "./aprobacion-row";
import { DecididaRow } from "./decidida-row";

type Tab = "pendientes" | "decididas" | "mi-area";

export default async function AprobacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("id, is_admin")
    .eq("auth_user_id", user.id)
    .single();
  if (!me) redirect("/");

  // Áreas de las que soy watcher
  const { data: watchedAreas } = await supabase
    .from("areas")
    .select("id")
    .eq("watcher_employee_id", me.id);
  const watchedAreaIds = new Set((watchedAreas ?? []).map((a) => a.id));
  const isWatcher = watchedAreaIds.size > 0;

  // Elegir tab activo; "mi-area" solo si el usuario es watcher
  const tab: Tab =
    tabParam === "decididas" ? "decididas"
    : tabParam === "mi-area" && isWatcher ? "mi-area"
    : "pendientes";

  const selectCommon = `
    id, start_date, end_date, business_days, employee_comment, requested_at, status,
    decided_at, decision_comment,
    supervisor_comment, supervisor_comment_by_employee_id,
    employee:employees!vacation_requests_employee_id_fkey ( id, nombre, apellido_paterno, manager_employee_id, area_id ),
    decided_by:employees!vacation_requests_decided_by_employee_id_fkey ( id, nombre, apellido_paterno ),
    supervisor_comment_by:employees!vacation_requests_supervisor_comment_by_employee_id_fkey ( nombre, apellido_paterno )
  `;

  let pendientes: PendingShape[] = [];
  let decididas: DecidedShape[] = [];
  let miArea: PendingShape[] = [];

  if (tab === "pendientes") {
    const { data } = await supabase
      .from("vacation_requests")
      .select(selectCommon)
      .eq("status", "pendiente")
      .order("requested_at", { ascending: true });
    pendientes = (data ?? []) as unknown as PendingShape[];
  } else if (tab === "decididas") {
    const { data } = await supabase
      .from("vacation_requests")
      .select(selectCommon)
      .in("status", ["aprobada", "rechazada"])
      .order("decided_at", { ascending: false });
    decididas = (data ?? []) as unknown as DecidedShape[];
  } else if (tab === "mi-area" && isWatcher) {
    // Empleados que pertenecen a mis áreas observadas
    const { data: watchedEmps } = await supabase
      .from("employees")
      .select("id")
      .in("area_id", [...watchedAreaIds]);
    const watchedEmpIds = (watchedEmps ?? []).map((e) => e.id);
    if (watchedEmpIds.length > 0) {
      const { data } = await supabase
        .from("vacation_requests")
        .select(selectCommon)
        .eq("status", "pendiente")
        .in("employee_id", watchedEmpIds)
        .order("requested_at", { ascending: true });
      miArea = (data ?? []) as unknown as PendingShape[];
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">← Volver</Link>
      <h1 className="text-2xl font-semibold text-brand-navy">Solicitudes</h1>

      <div className="flex gap-1 border-b border-neutral-200">
        <TabLink href="/aprobaciones?tab=pendientes" active={tab === "pendientes"}>Pendientes</TabLink>
        {isWatcher && (
          <TabLink href="/aprobaciones?tab=mi-area" active={tab === "mi-area"}>Mi área</TabLink>
        )}
        <TabLink href="/aprobaciones?tab=decididas" active={tab === "decididas"}>Decididas</TabLink>
      </div>

      {tab === "pendientes" ? (
        pendientes.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay solicitudes pendientes.</p>
        ) : (
          <div className="space-y-3">
            {pendientes.map((r) => (
              <AprobacionRow
                key={r.id}
                request={r}
                canApprove={canCallerApprove(r, me)}
                isWatcher={isCallerWatcher(r, watchedAreaIds)}
              />
            ))}
          </div>
        )
      ) : tab === "mi-area" ? (
        miArea.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay solicitudes pendientes en tu área.</p>
        ) : (
          <div className="space-y-3">
            {miArea.map((r) => (
              <AprobacionRow
                key={r.id}
                request={r}
                canApprove={false}
                isWatcher={true}
              />
            ))}
          </div>
        )
      ) : decididas.length === 0 ? (
        <p className="text-sm text-neutral-500">Aún no hay solicitudes decididas en tu ámbito.</p>
      ) : (
        <div className="space-y-3">
          {decididas.map((r) => (
            <DecididaRow key={r.id} request={r} />
          ))}
        </div>
      )}
    </main>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        active
          ? "border-brand-red text-brand-navy font-semibold"
          : "border-transparent text-brand-gray hover:text-brand-navy"
      }`}
    >
      {children}
    </Link>
  );
}

interface PendingShape {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  employee_comment: string | null;
  requested_at: string;
  status: "pendiente";
  decided_at: null;
  decision_comment: null;
  supervisor_comment: string | null;
  supervisor_comment_by_employee_id: number | null;
  employee:
    | { id: number; nombre: string; apellido_paterno: string | null; manager_employee_id: number | null; area_id: string | null }
    | { id: number; nombre: string; apellido_paterno: string | null; manager_employee_id: number | null; area_id: string | null }[]
    | null;
  decided_by: null;
  supervisor_comment_by:
    | { nombre: string; apellido_paterno: string | null }
    | { nombre: string; apellido_paterno: string | null }[]
    | null;
}

interface DecidedShape {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  employee_comment: string | null;
  requested_at: string;
  status: "aprobada" | "rechazada";
  decided_at: string | null;
  decision_comment: string | null;
  employee:
    | { id: number; nombre: string; apellido_paterno: string | null; manager_employee_id: number | null }
    | { id: number; nombre: string; apellido_paterno: string | null; manager_employee_id: number | null }[]
    | null;
  decided_by:
    | { id: number; nombre: string; apellido_paterno: string | null }
    | { id: number; nombre: string; apellido_paterno: string | null }[]
    | null;
}

function canCallerApprove(r: PendingShape, me: { id: number; is_admin: boolean | null }): boolean {
  if (me.is_admin) return true;
  const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee;
  return !!emp && emp.manager_employee_id === me.id;
}

function isCallerWatcher(r: PendingShape, watchedAreaIds: Set<string>): boolean {
  const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee;
  return !!emp?.area_id && watchedAreaIds.has(emp.area_id);
}

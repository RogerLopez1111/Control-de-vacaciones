import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupervisorPicker } from "./supervisor-picker";
import { WatcherPicker } from "./watcher-picker";

interface AreaRow {
  id: string;
  nombre: string;
  supervisor_employee_id: number | null;
  watcher_employee_id: number | null;
  parent_area_id: string | null;
  display_order: number;
}
interface EmpleadoLite {
  id: number;
  nombre: string;
  apellido_paterno: string | null;
  area_id: string | null;
}

export default async function OrganigramaPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: areas }, { data: employees }] = await Promise.all([
    supabase.from("areas").select("id, nombre, supervisor_employee_id, watcher_employee_id, parent_area_id, display_order").order("display_order"),
    supabase.from("employees").select("id, nombre, apellido_paterno, area_id").is("termination_date", null).order("apellido_paterno"),
  ]);

  const allAreas = (areas ?? []) as AreaRow[];
  const allEmps = (employees ?? []) as EmpleadoLite[];

  const empById = new Map<number, EmpleadoLite>();
  for (const e of allEmps) empById.set(e.id, e);

  const membersByArea = new Map<string, EmpleadoLite[]>();
  for (const e of allEmps) {
    if (!e.area_id) continue;
    const list = membersByArea.get(e.area_id) ?? [];
    list.push(e);
    membersByArea.set(e.area_id, list);
  }

  const unassigned = allEmps.filter((e) => !e.area_id);
  const areaById = new Map<string, AreaRow>();
  for (const a of allAreas) areaById.set(a.id, a);

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy">Organigrama</h1>
        <span className="text-sm text-brand-gray">{allAreas.length} áreas · {allEmps.length} empleados</span>
      </div>

      <p className="text-sm text-brand-gray">
        El supervisor de cada área aprueba las solicitudes de vacaciones de sus miembros.
        Cambia un supervisor y se actualizan automáticamente todos los empleados de esa área.
        Para asignar un empleado a un área, ve a <Link href="/admin/empleados" className="text-brand-red hover:underline">Empleados</Link> y abre su detalle.
      </p>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allAreas.map((a) => {
          const supervisor = a.supervisor_employee_id ? empById.get(a.supervisor_employee_id) : null;
          const members = membersByArea.get(a.id) ?? [];
          const parent = a.parent_area_id ? areaById.get(a.parent_area_id) : null;
          return (
            <div key={a.id} className="border border-neutral-200 bg-white p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-brand-navy">{a.nombre}</h2>
                  {parent && <p className="text-xs text-brand-gray">bajo {parent.nombre}</p>}
                </div>
                <span className="text-xs text-brand-gray">{members.length} miembro{members.length === 1 ? "" : "s"}</span>
              </div>

              <div>
                <p className="text-xs text-brand-gray mb-1">Supervisor (aprueba)</p>
                <SupervisorPicker
                  areaId={a.id}
                  currentSupervisorId={a.supervisor_employee_id}
                  empleados={allEmps}
                />
                {supervisor && (
                  <p className="text-xs text-brand-gray mt-1">
                    Aprueba a {members.filter((m) => m.id !== supervisor.id).length} empleado{members.length === 2 ? "" : "s"} de esta área.
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-brand-gray mb-1">Observador (solo lectura + notificación)</p>
                <WatcherPicker
                  areaId={a.id}
                  currentWatcherId={a.watcher_employee_id}
                  empleados={allEmps}
                />
              </div>

              {members.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-brand-navy hover:underline">Ver miembros</summary>
                  <ul className="mt-2 divide-y divide-neutral-100">
                    {members.map((m) => (
                      <li key={m.id} className="py-1 flex items-center justify-between">
                        <span>{m.nombre} {m.apellido_paterno ?? ""}</span>
                        {m.id === a.supervisor_employee_id && (
                          <span className="rounded-full bg-brand-navy-tint text-brand-navy text-xs px-2 py-0.5">supervisor</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </section>

      {unassigned.length > 0 && (
        <section className="border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Sin área asignada</h2>
          <p className="text-sm text-amber-900 mt-0.5">
            {unassigned.length} empleado{unassigned.length === 1 ? "" : "s"} no tiene{unassigned.length === 1 ? "" : "n"} área. Sus solicitudes solo las puede aprobar el admin.
          </p>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {unassigned.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/empleados/${e.id}`} className="text-brand-red hover:underline">
                  {e.nombre} {e.apellido_paterno ?? ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

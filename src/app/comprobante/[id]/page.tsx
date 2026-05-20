import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { yearsOfServiceAt } from "@/lib/lft-entitlement";
import { PrintButton } from "./print-button";

interface RequestData {
  id: string;
  status: "pendiente" | "aprobada" | "rechazada" | "cancelada";
  start_date: string;
  end_date: string;
  business_days: number;
  employee_comment: string | null;
  decision_comment: string | null;
  decided_at: string | null;
  decided_by_employee_id: number | null;
  employee_id: number;
  employee:
    | { id: number; codigo_alterno: string | null; nombre: string; apellido_paterno: string | null; apellido_materno: string | null; hire_date: string; branch_id: number | null; area_id: string | null }
    | { id: number; codigo_alterno: string | null; nombre: string; apellido_paterno: string | null; apellido_materno: string | null; hire_date: string; branch_id: number | null; area_id: string | null }[]
    | null;
}

export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: req } = await supabase
    .from("vacation_requests")
    .select(`
      id, status, start_date, end_date, business_days,
      employee_comment, decision_comment, decided_at, decided_by_employee_id, employee_id,
      employee:employees!vacation_requests_employee_id_fkey (
        id, codigo_alterno, nombre, apellido_paterno, apellido_materno,
        hire_date, branch_id, area_id
      )
    `)
    .eq("id", id)
    .single<RequestData>();

  if (!req) notFound();
  if (req.status !== "aprobada") {
    // Solo solicitudes aprobadas tienen comprobante.
    return (
      <main className="mx-auto max-w-xl p-6">
        <p className="text-sm text-brand-red">
          Esta solicitud no está aprobada (estatus: <strong>{req.status}</strong>). El comprobante solo se genera para vacaciones autorizadas.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand-gray hover:text-brand-navy">← Volver</Link>
      </main>
    );
  }

  const emp = Array.isArray(req.employee) ? req.employee[0] : req.employee;
  if (!emp) notFound();

  // Datos accesorios (sucursal, área, nombre de quien autorizó)
  const [{ data: branch }, { data: area }, { data: decider }] = await Promise.all([
    emp.branch_id ? supabase.from("branches").select("nombre").eq("id", emp.branch_id).single() : Promise.resolve({ data: null }),
    emp.area_id ? supabase.from("areas").select("nombre").eq("id", emp.area_id).single() : Promise.resolve({ data: null }),
    req.decided_by_employee_id ? supabase.from("employees").select("nombre, apellido_paterno, apellido_materno").eq("id", req.decided_by_employee_id).single() : Promise.resolve({ data: null }),
  ]);

  const empleadoNombre = [emp.nombre, emp.apellido_paterno, emp.apellido_materno].filter(Boolean).join(" ");
  const aprobadoPor = decider
    ? [decider.nombre, decider.apellido_paterno, decider.apellido_materno].filter(Boolean).join(" ")
    : "—";
  const antiguedad = yearsOfServiceAt(new Date(emp.hire_date), new Date(req.decided_at ?? new Date()));
  const folio = req.id.slice(0, 8).toUpperCase();

  return (
    <main className="mx-auto max-w-3xl p-6 print:p-0">
      {/* Acciones (no se imprimen) */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/" className="text-sm text-brand-gray hover:text-brand-navy">← Volver</Link>
        <PrintButton />
      </div>

      {/* Documento */}
      <article className="bg-white p-6 print:p-0 border border-neutral-200 print:border-0 text-[12px] leading-snug text-brand-navy">
        <header className="flex items-start justify-between border-b border-brand-navy pb-2 mb-3">
          <img
            src="https://cdn.shopify.com/s/files/1/0771/6975/4358/files/logo-footer_fc28a06e-0691-4e47-83e3-d3888c3202bb.png?v=1759271820"
            alt="Ecosistemas"
            className="h-10"
          />
          <div className="text-right text-[10px] text-brand-gray">
            <div>Folio: <strong className="font-mono text-brand-navy">{folio}</strong></div>
            <div>Emitido: {fmtDate(new Date())}</div>
          </div>
        </header>

        <h1 className="text-center text-base font-bold uppercase tracking-wide mb-3">
          Autorización de Vacaciones
        </h1>

        <section className="mb-3">
          <h2 className="text-[10px] uppercase tracking-wide text-brand-gray border-b border-neutral-200 pb-0.5 mb-1.5">Empleado</h2>
          <table className="w-full">
            <tbody>
              <Row label="Nombre" value={empleadoNombre} />
              <Row label="No. de empleado" value={emp.codigo_alterno ?? String(emp.id)} />
              <Row label="Sucursal" value={branch?.nombre ?? "—"} />
              <Row label="Área" value={area?.nombre ?? "—"} />
              <Row label="Fecha de ingreso" value={fmtIso(emp.hire_date)} />
              <Row label="Antigüedad" value={`${antiguedad} año${antiguedad === 1 ? "" : "s"} cumplidos`} />
            </tbody>
          </table>
        </section>

        <section className="mb-3">
          <h2 className="text-[10px] uppercase tracking-wide text-brand-gray border-b border-neutral-200 pb-0.5 mb-1.5">Periodo autorizado</h2>
          <table className="w-full">
            <tbody>
              <Row label="Desde" value={fmtIso(req.start_date)} />
              <Row label="Hasta" value={fmtIso(req.end_date)} />
              <Row label="Total de días hábiles" value={String(req.business_days)} />
            </tbody>
          </table>
        </section>

        {(req.employee_comment || req.decision_comment) && (
          <section className="mb-3">
            <h2 className="text-[10px] uppercase tracking-wide text-brand-gray border-b border-neutral-200 pb-0.5 mb-1.5">Observaciones</h2>
            {req.employee_comment && (
              <p className="mb-1"><span className="text-brand-gray">Empleado:</span> {req.employee_comment}</p>
            )}
            {req.decision_comment && (
              <p><span className="text-brand-gray">Autorización:</span> {req.decision_comment}</p>
            )}
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-[10px] uppercase tracking-wide text-brand-gray border-b border-neutral-200 pb-0.5 mb-1.5">Autorización</h2>
          <p>Autorizado el <strong>{fmtIso(req.decided_at ?? "")}</strong> por <strong>{aprobadoPor}</strong>.</p>
        </section>

        {/* Firmas */}
        <section className="grid grid-cols-2 gap-8 mt-10">
          <div className="text-center">
            <div className="border-t border-brand-navy pt-1.5">
              <p className="text-[10px] text-brand-gray uppercase tracking-wide">Empleado</p>
              <p className="font-medium mt-0.5">{empleadoNombre}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-brand-navy pt-1.5">
              <p className="text-[10px] text-brand-gray uppercase tracking-wide">Autorizó</p>
              <p className="font-medium mt-0.5">{aprobadoPor}</p>
            </div>
          </div>
        </section>

        <footer className="mt-6 pt-2 border-t border-neutral-200 text-[9px] text-brand-gray text-center">
          Fundamento legal: Artículo 76 de la Ley Federal del Trabajo · Documento generado por el Sistema de Control de Vacaciones de Ecosistemas.
        </footer>
      </article>

      <style>{`
        @page { size: Letter; margin: 10mm 12mm; }
        @media print {
          html, body { background: white; }
        }
      `}</style>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-1 pr-4 text-brand-gray w-44 align-top">{label}</td>
      <td className="py-1 font-medium">{value}</td>
    </tr>
  );
}

function fmtIso(iso: string): string {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

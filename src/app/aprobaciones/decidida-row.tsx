import Link from "next/link";

interface DecidedRequest {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  employee_comment: string | null;
  status: "aprobada" | "rechazada";
  decided_at: string | null;
  decision_comment: string | null;
  employee:
    | { id: number; nombre: string; apellido_paterno: string | null }
    | { id: number; nombre: string; apellido_paterno: string | null }[]
    | null;
  decided_by:
    | { id: number; nombre: string; apellido_paterno: string | null }
    | { id: number; nombre: string; apellido_paterno: string | null }[]
    | null;
}

export function DecididaRow({ request }: { request: DecidedRequest }) {
  const emp = Array.isArray(request.employee) ? request.employee[0] : request.employee;
  const decider = Array.isArray(request.decided_by) ? request.decided_by[0] : request.decided_by;
  const empName = emp ? `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim() : "—";
  const deciderName = decider ? `${decider.nombre} ${decider.apellido_paterno ?? ""}`.trim() : "—";
  const approved = request.status === "aprobada";

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{empName}</h3>
        <span
          className={`rounded-full text-xs px-2 py-0.5 ${
            approved ? "bg-green-100 text-green-900" : "bg-brand-red-tint text-brand-red"
          }`}
        >
          {request.status}
        </span>
      </div>
      <p className="text-sm text-neutral-700 mt-1">
        {fmtISO(request.start_date)} → {fmtISO(request.end_date)} ·{" "}
        <strong>{request.business_days}</strong> días hábiles
      </p>
      <p className="text-xs text-brand-gray mt-1">
        {approved ? "Aprobada" : "Rechazada"} el {request.decided_at ? fmtISO(request.decided_at) : "—"} por {deciderName}
      </p>
      {request.employee_comment && (
        <p className="mt-2 text-sm text-neutral-600 italic">
          <span className="text-brand-gray">Empleado: </span>
          &ldquo;{request.employee_comment}&rdquo;
        </p>
      )}
      {request.decision_comment && (
        <p className="mt-1 text-sm text-neutral-600 italic">
          <span className="text-brand-gray">Autorización: </span>
          &ldquo;{request.decision_comment}&rdquo;
        </p>
      )}
      {approved && (
        <div className="mt-3">
          <Link
            href={`/comprobante/${request.id}`}
            className="inline-block rounded-md border border-brand-navy text-brand-navy text-xs px-3 py-1.5 hover:bg-brand-navy-tint"
          >
            Generar comprobante
          </Link>
        </div>
      )}
    </div>
  );
}

function fmtISO(iso: string): string {
  return new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

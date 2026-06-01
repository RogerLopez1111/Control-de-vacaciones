"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideVacationRequest, saveSupervisorComment } from "./actions";
import { formatDateMX } from "@/lib/format";

interface RequestRow {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  employee_comment: string | null;
  requested_at: string;
  supervisor_comment: string | null;
  supervisor_comment_by:
    | { nombre: string; apellido_paterno: string | null }
    | { nombre: string; apellido_paterno: string | null }[]
    | null;
  employee:
    | { id: number; nombre: string; apellido_paterno: string | null }
    | { id: number; nombre: string; apellido_paterno: string | null }[]
    | null;
}

export function AprobacionRow({
  request,
  canApprove,
  isWatcher,
}: {
  request: RequestRow;
  canApprove: boolean;
  isWatcher: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [supervisorDraft, setSupervisorDraft] = useState(request.supervisor_comment ?? "");
  const [pending, startTransition] = useTransition();
  const [supPending, startSupTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supError, setSupError] = useState<string | null>(null);
  const [supSaved, setSupSaved] = useState(false);

  const emp = Array.isArray(request.employee) ? request.employee[0] : request.employee;
  const empName = emp ? `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim() : "—";

  const supBy = Array.isArray(request.supervisor_comment_by)
    ? request.supervisor_comment_by[0]
    : request.supervisor_comment_by;
  const supByName = supBy ? `${supBy.nombre} ${supBy.apellido_paterno ?? ""}`.trim() : null;

  function decide(status: "aprobada" | "rechazada") {
    setError(null);
    const printWindow = status === "aprobada" ? window.open("about:blank", "_blank") : null;
    startTransition(async () => {
      const r = await decideVacationRequest({
        requestId: request.id,
        status,
        comment: comment.trim() || null,
      });
      if (!r.ok) {
        printWindow?.close();
        setError(r.error ?? "Error al guardar la decisión.");
        return;
      }
      if (printWindow) printWindow.location.href = `/comprobante/${request.id}?autoprint=1`;
      router.refresh();
    });
  }

  function saveComment() {
    setSupError(null);
    setSupSaved(false);
    startSupTransition(async () => {
      const r = await saveSupervisorComment({ requestId: request.id, comment: supervisorDraft });
      if (!r.ok) { setSupError(r.error ?? "Error al guardar el comentario."); return; }
      setSupSaved(true);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-md border p-4 space-y-3 ${canApprove ? "border-neutral-200 bg-white" : "border-brand-navy bg-brand-navy-tint"}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{empName}</h3>
        <div className="flex items-center gap-2">
          {!canApprove && (
            <span className="rounded-full bg-brand-navy-tint text-brand-navy text-xs px-2 py-0.5 border border-brand-navy/20">
              solo observador
            </span>
          )}
          <span className="text-xs text-neutral-500">
            solicitada {formatDateMX(request.requested_at)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-neutral-700">
          {formatDateMX(request.start_date)} → {formatDateMX(request.end_date)} ·{" "}
          <strong>{request.business_days}</strong> días hábiles
        </p>
        <a
          href={`/calendario?month=${request.start_date.slice(0, 7)}&preview=${request.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs border border-brand-navy text-brand-navy px-2 py-0.5 hover:bg-brand-navy hover:text-white shrink-0"
        >
          Ver en calendario
        </a>
      </div>

      {request.employee_comment && (
        <p className="text-sm text-neutral-600 italic">&ldquo;{request.employee_comment}&rdquo;</p>
      )}

      {/* Comentario del supervisor visible para el aprobador */}
      {canApprove && request.supervisor_comment && (
        <div className="rounded-md border border-brand-navy/30 bg-brand-navy-tint px-3 py-2 text-sm">
          <span className="font-medium text-brand-navy">
            {supByName ?? "Supervisor"}:
          </span>{" "}
          <span className="text-neutral-800">{request.supervisor_comment}</span>
        </div>
      )}

      {/* Área de comentario para el watcher */}
      {isWatcher && !canApprove && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-brand-navy">Tu comentario para el aprobador</label>
          <textarea
            rows={2}
            value={supervisorDraft}
            onChange={(e) => { setSupervisorDraft(e.target.value); setSupSaved(false); }}
            placeholder="Escribe aquí tu observación o recomendación…"
            className="w-full rounded-md border border-brand-navy/40 bg-white px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={supPending}
              onClick={saveComment}
              className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {supPending ? "Guardando…" : "Guardar comentario"}
            </button>
            {supSaved && <span className="text-xs text-green-700">Guardado</span>}
            {supError && <span className="text-xs text-brand-red">{supError}</span>}
          </div>
        </div>
      )}

      {canApprove ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input
            type="text"
            placeholder="Comentario para el empleado (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => decide("aprobada")}
              className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {pending ? "..." : "Aprobar"}
            </button>
            <button
              disabled={pending}
              onClick={() => decide("rechazada")}
              className="rounded-md bg-brand-red px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "..." : "Rechazar"}
            </button>
          </div>
        </div>
      ) : !isWatcher ? (
        <p className="text-xs text-brand-gray">
          Recibes esta solicitud solo a título informativo. La aprobación la hace el supervisor del área o el administrador.
        </p>
      ) : null}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

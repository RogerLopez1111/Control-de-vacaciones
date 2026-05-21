"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideVacationRequest } from "./actions";
import { formatDateMX } from "@/lib/format";

interface RequestRow {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  employee_comment: string | null;
  requested_at: string;
  employee:
    | { id: number; nombre: string; apellido_paterno: string | null }
    | { id: number; nombre: string; apellido_paterno: string | null }[]
    | null;
}

export function AprobacionRow({
  request,
  canApprove,
}: {
  request: RequestRow;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const emp = Array.isArray(request.employee) ? request.employee[0] : request.employee;
  const empName = emp ? `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim() : "—";

  function decide(status: "aprobada" | "rechazada") {
    setError(null);
    // Pre-abre una pestaña antes del await: los navegadores solo permiten
    // window.open desde un gesto de usuario directo. Si la aprobación falla
    // o la decisión fue "rechazada", la cerramos.
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
      if (printWindow) {
        printWindow.location.href = `/comprobante/${request.id}?autoprint=1`;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{empName}</h3>
        <div className="flex items-center gap-2">
          {!canApprove && (
            <span className="rounded-full bg-brand-navy-tint text-brand-navy text-xs px-2 py-0.5">
              solo observador
            </span>
          )}
          <span className="text-xs text-neutral-500">
            solicitada {formatDateMX(request.requested_at)}
          </span>
        </div>
      </div>
      <p className="text-sm text-neutral-700 mt-1">
        {formatDateMX(request.start_date)} → {formatDateMX(request.end_date)} ·{" "}
        <strong>{request.business_days}</strong> días hábiles
      </p>
      {request.employee_comment && (
        <p className="mt-2 text-sm text-neutral-600 italic">&ldquo;{request.employee_comment}&rdquo;</p>
      )}

      {canApprove ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
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
      ) : (
        <p className="mt-3 text-xs text-brand-gray">
          Recibes esta solicitud solo a título informativo. La aprobación la hace el supervisor del área o el administrador.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}


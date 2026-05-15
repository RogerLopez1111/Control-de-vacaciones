"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface RequestRow {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  employee_comment: string | null;
  requested_at: string;
  employee: {
    id: number;
    nombre: string;
    apellido_paterno: string | null;
  } | { id: number; nombre: string; apellido_paterno: string | null }[] | null;
}

export function AprobacionRow({
  request,
  approverId,
}: {
  request: RequestRow;
  approverId: number;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emp = Array.isArray(request.employee) ? request.employee[0] : request.employee;
  const empName = emp ? `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim() : "—";

  async function decide(status: "aprobada" | "rechazada") {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("vacation_requests")
      .update({
        status,
        decided_at: new Date().toISOString(),
        decided_by_employee_id: approverId,
        decision_comment: comment || null,
      })
      .eq("id", request.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{empName}</h3>
        <span className="text-xs text-neutral-500">
          solicitada {new Date(request.requested_at).toLocaleDateString("es-MX")}
        </span>
      </div>
      <p className="text-sm text-neutral-700 mt-1">
        {fmtISO(request.start_date)} → {fmtISO(request.end_date)} ·{" "}
        <strong>{request.business_days}</strong> días hábiles
      </p>
      {request.employee_comment && (
        <p className="mt-2 text-sm text-neutral-600 italic">&ldquo;{request.employee_comment}&rdquo;</p>
      )}

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
            disabled={busy}
            onClick={() => decide("aprobada")}
            className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            Aprobar
          </button>
          <button
            disabled={busy}
            onClick={() => decide("rechazada")}
            className="rounded-md bg-brand-red px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function fmtISO(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

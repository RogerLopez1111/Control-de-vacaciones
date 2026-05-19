"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { countBusinessDays } from "@/lib/business-days";
import { submitVacationRequest, updateVacationRequest } from "./actions";

export interface InitialRequest {
  requestId: string;
  startDate: string;
  endDate: string;
  comment: string;
}

export function SolicitarForm({
  holidays,
  initial,
}: {
  holidays: string[];
  initial?: InitialRequest;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const businessDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return countBusinessDays(new Date(startDate), new Date(endDate), holidaySet);
  }, [startDate, endDate, holidaySet]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!startDate || !endDate) return;
    if (new Date(endDate) < new Date(startDate)) {
      setError("La fecha final debe ser igual o posterior a la inicial.");
      return;
    }
    if (businessDays <= 0) {
      setError("El rango seleccionado no incluye días hábiles.");
      return;
    }

    startTransition(async () => {
      const payload = {
        start_date: startDate,
        end_date: endDate,
        business_days: businessDays,
        employee_comment: comment.trim() || null,
      };
      const result = editing
        ? await updateVacationRequest({ request_id: initial!.requestId, ...payload })
        : await submitVacationRequest(payload);
      if (!result.ok) {
        setError(result.error ?? "Error al guardar la solicitud.");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-neutral-200 bg-white p-5">
      {editing && (
        <p className="rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm p-2">
          Estás modificando una solicitud existente. Si estaba aprobada, volverá a quedar pendiente y tu supervisor tendrá que autorizarla de nuevo.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-neutral-700">Desde</span>
          <input
            type="date"
            required
            min={todayIso}
            value={startDate}
            onChange={(e) => {
              const v = e.target.value;
              setStartDate(v);
              if (v && (!endDate || endDate < v)) setEndDate(v);
            }}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-700">Hasta</span>
          <input
            type="date"
            required
            min={startDate || todayIso}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-md bg-neutral-100 p-3 text-sm">
        Días hábiles solicitados: <strong>{businessDays}</strong>
        <span className="text-neutral-500">
          {" "}(se excluyen sábados, domingos y feriados). Para un solo día, deja la misma fecha en &ldquo;Desde&rdquo; y &ldquo;Hasta&rdquo;.
        </span>
      </div>

      <label className="block">
        <span className="text-sm text-neutral-700">Comentario (opcional)</span>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </label>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || businessDays <= 0}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando..." : editing ? "Guardar cambios" : "Enviar solicitud"}
        </button>
      </div>
    </form>
  );
}

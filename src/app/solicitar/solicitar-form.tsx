"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { countBusinessDays } from "@/lib/business-days";

export function SolicitarForm({
  employeeId,
  holidays,
}: {
  employeeId: number;
  holidays: string[];
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const businessDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return countBusinessDays(new Date(startDate), new Date(endDate), holidaySet);
  }, [startDate, endDate, holidaySet]);

  async function handleSubmit(e: React.FormEvent) {
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

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("vacation_requests").insert({
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate,
      business_days: businessDays,
      employee_comment: comment || null,
    });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-neutral-200 bg-white p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-neutral-700">Desde</span>
          <input
            type="date"
            required
            min={todayIso}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
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
        <span className="text-neutral-500"> (se excluyen sábados, domingos y feriados)</span>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || businessDays <= 0}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Enviando..." : "Enviar solicitud"}
        </button>
      </div>
    </form>
  );
}

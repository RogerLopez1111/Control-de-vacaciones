"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AjusteForm({ employeeId, periodStart }: { employeeId: number; periodStart: string }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) {
      setError("Captura un número entero distinto de cero (puede ser negativo).");
      return;
    }
    if (!reason.trim()) {
      setError("La razón es obligatoria.");
      return;
    }

    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setError("Sesión expirada."); return; }
    const { data: me } = await supabase.from("employees").select("id").eq("auth_user_id", user.id).single();
    if (!me) { setBusy(false); setError("No se encontró tu registro de empleado."); return; }

    const { error: insErr } = await supabase.from("vacation_adjustments").insert({
      employee_id: employeeId,
      period_start: periodStart,
      delta_days: n,
      reason: reason.trim(),
      adjusted_by_employee_id: me.id,
    });
    setBusy(false);
    if (insErr) { setError(insErr.message); return; }
    setDelta(""); setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-neutral-200 bg-white p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm text-neutral-700">Días (±)</span>
          <input
            type="number"
            step="1"
            required
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="ej. 3 o -2"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red tabular-nums"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm text-neutral-700">Razón</span>
          <input
            type="text"
            required
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ej. Bono por antigüedad, días tomados fuera del sistema, etc."
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </label>
      </div>
      <p className="text-xs text-brand-gray">Aplica al periodo en curso (inicia {periodStart}).</p>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Guardando..." : "Guardar ajuste"}
      </button>
    </form>
  );
}

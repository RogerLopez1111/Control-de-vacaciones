"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AreaOption { id: string; nombre: string }

export function AreaPicker({
  employeeId,
  currentAreaId,
  areas,
}: {
  employeeId: number;
  currentAreaId: string | null;
  areas: AreaOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(currentAreaId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const target = selected === "" ? null : selected;
    if (target === currentAreaId) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("assign_employee_to_area", {
      target_employee_id: employeeId,
      target_area_id: target,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    router.refresh();
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 space-y-2">
      <h3 className="font-medium text-brand-navy">Área</h3>
      <p className="text-sm text-brand-gray">
        El supervisor del área aprueba las solicitudes de vacaciones de este empleado.
      </p>
      <div className="flex items-center gap-2 pt-1">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        >
          <option value="">— Sin asignar —</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={busy || selected === (currentAreaId ?? "")}
          className="rounded-md bg-brand-red px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "..." : "Guardar"}
        </button>
      </div>
      {error && <p className="text-sm text-brand-red">{error}</p>}
    </div>
  );
}

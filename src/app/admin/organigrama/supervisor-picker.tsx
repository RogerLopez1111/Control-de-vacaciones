"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface EmpleadoLite {
  id: number;
  nombre: string;
  apellido_paterno: string | null;
}

export function SupervisorPicker({
  areaId,
  currentSupervisorId,
  empleados,
}: {
  areaId: string;
  currentSupervisorId: number | null;
  empleados: EmpleadoLite[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(currentSupervisorId?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const newId = selected === "" ? null : Number(selected);
    if (newId === currentSupervisorId) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("areas")
      .update({ supervisor_employee_id: newId })
      .eq("id", areaId);
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      >
        <option value="">— Sin asignar —</option>
        {empleados.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre} {e.apellido_paterno ?? ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={busy || selected === (currentSupervisorId?.toString() ?? "")}
        className="rounded-md bg-brand-red px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "..." : "Guardar"}
      </button>
      {error && <p className="text-xs text-brand-red ml-2">{error}</p>}
    </div>
  );
}

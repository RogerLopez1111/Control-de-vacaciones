"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function RoleToggle({
  employeeId,
  isAdmin,
  isSelf,
}: {
  employeeId: number;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    if (isSelf && isAdmin) {
      setError("No puedes quitarte tu propio rol de administrador.");
      return;
    }
    const next = !isAdmin;
    const verb = next ? "convertir en administrador" : "quitar el rol de administrador";
    if (!confirm(`¿Seguro que quieres ${verb} a este empleado?`)) return;

    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("set_employee_admin", {
      target_employee_id: employeeId,
      new_is_admin: next,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    router.refresh();
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 flex items-center justify-between gap-4">
      <div>
        <h3 className="font-medium text-brand-navy">Rol de administrador</h3>
        <p className="text-sm text-brand-gray mt-0.5">
          {isAdmin
            ? "Puede ver a todos los empleados, aprobar solicitudes y aplicar ajustes."
            : "Empleado normal — solo gestiona sus propias vacaciones."}
        </p>
        {error && <p className="text-sm text-brand-red mt-2">{error}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy || (isSelf && isAdmin)}
        className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          isAdmin
            ? "border border-brand-red text-brand-red hover:bg-brand-red-tint"
            : "bg-brand-red text-white hover:opacity-90"
        }`}
        title={isSelf && isAdmin ? "No puedes quitarte tu propio rol" : ""}
      >
        {busy ? "Guardando..." : isAdmin ? "Quitar admin" : "Hacer admin"}
      </button>
    </div>
  );
}

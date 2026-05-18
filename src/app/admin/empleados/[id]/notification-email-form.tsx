"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function NotificationEmailForm({
  employeeId,
  currentNotificationEmail,
  fallbackEmail,
}: {
  employeeId: number;
  currentNotificationEmail: string | null;
  fallbackEmail: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentNotificationEmail ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const trimmed = value.trim();
    if (trimmed && !trimmed.includes("@")) {
      setError("Correo inválido.");
      return;
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcErr } = await supabase.rpc("set_employee_notification_email", {
        target_employee_id: employeeId,
        new_email: trimmed || null,
      });
      if (rpcErr) { setError(rpcErr.message); return; }
      setSuccess(true);
      router.refresh();
    });
  }

  const effective = value.trim() || fallbackEmail;

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-neutral-200 bg-white p-4 space-y-2">
      <h3 className="font-medium text-brand-navy">Correo para notificaciones</h3>
      <p className="text-sm text-brand-gray">
        Aquí llegan los correos del sistema (solicitudes de vacaciones que aprueba u observa).
        Si lo dejas vacío, usaremos el correo del ERP ({fallbackEmail ?? "ninguno"}).
      </p>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={fallbackEmail ?? "correo@ecosistemas.ws"}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-red px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "..." : "Guardar"}
        </button>
      </div>
      <p className="text-xs text-brand-gray">
        Notificaciones efectivamente irán a:{" "}
        <code className="font-mono">{effective ?? "(ninguno — no se enviará correo)"}</code>
      </p>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      {success && <p className="text-sm text-green-700">Guardado.</p>}
    </form>
  );
}

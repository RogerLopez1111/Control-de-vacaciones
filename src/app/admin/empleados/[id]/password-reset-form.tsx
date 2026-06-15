"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetEmployeePassword } from "./actions";

export function PasswordResetForm({
  employeeId,
  hasAuthAccount,
  hireYear,
}: {
  employeeId: number;
  hasAuthAccount: boolean;
  hireYear: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleReset() {
    setResult(null);
    startTransition(async () => {
      const r = await resetEmployeePassword(employeeId);
      if (r.ok) {
        setResult({ ok: true, message: `Contraseña restablecida a "ecosistemas${hireYear}".` });
        setConfirmed(false);
        router.refresh();
      } else {
        setResult({ ok: false, message: r.error });
      }
    });
  }

  if (!hasAuthAccount) {
    return (
      <p className="text-sm text-brand-gray">
        El empleado no tiene cuenta de autenticación vinculada. Ejecuta el script{" "}
        <code className="text-xs bg-neutral-100 px-1 py-0.5 rounded">bootstrap-auth</code> para crearla.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-600">
        Restaura la contraseña al valor por defecto:{" "}
        <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
          ecosistemas{hireYear}
        </code>
      </p>

      {!confirmed ? (
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="rounded-md border border-brand-red text-brand-red px-3 py-1.5 text-sm hover:bg-brand-red hover:text-white transition-colors"
        >
          Restaurar contraseña
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={handleReset}
            className="rounded-md bg-brand-red px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Restableciendo…" : "Confirmar restauración"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmed(false)}
            className="text-sm text-brand-gray hover:text-brand-navy"
          >
            Cancelar
          </button>
        </div>
      )}

      {result && (
        <p className={`text-sm ${result.ok ? "text-green-700" : "text-brand-red"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

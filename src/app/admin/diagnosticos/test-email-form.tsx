"use client";

import { useState, useTransition } from "react";
import { sendTestEmail, type TestEmailResult } from "./actions";

export function TestEmailForm() {
  const [to, setTo] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TestEmailResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await sendTestEmail(to.trim() || undefined);
      setResult(r);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
      <label className="block">
        <span className="text-sm text-neutral-700">Destinatario (opcional)</span>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Si lo dejas vacío, llega a tu correo de empleado"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Enviar correo de prueba"}
      </button>

      {result && (
        <div className={`rounded-md border p-3 text-sm ${result.ok ? "border-green-300 bg-green-50 text-green-900" : "border-brand-red bg-brand-red-tint text-brand-red"}`}>
          <p className="font-medium">
            {result.ok ? "✓ Envío exitoso" : "✗ Falló"}
            {result.recipient && <> · destino: <code className="font-mono">{result.recipient}</code></>}
          </p>
          {result.message && <p className="mt-1">{result.message}</p>}
          {result.error && <p className="mt-1">{result.error}</p>}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-brand-gray">Configuración detectada</summary>
            <ul className="mt-1 text-xs font-mono">
              {Object.entries(result.envSummary).map(([k, v]) => (
                <li key={k}>{v ? "✓" : "✗"} {k}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-brand-gray">SMTP configurado: {result.smtpConfigured ? "sí" : "no"}</p>
          </details>
        </div>
      )}
    </form>
  );
}

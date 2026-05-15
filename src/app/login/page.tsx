"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syntheticEmailFor } from "@/lib/auth-helpers";

export default function LoginPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const id = employeeId.trim().replace(/^0+/, ""); // permitir "0408" o "408"
    if (!/^\d+$/.test(id)) {
      setError("Tu número de empleado debe ser numérico.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: syntheticEmailFor(id),
      password,
    });
    setBusy(false);
    if (error) {
      setError(traducirError(error.message));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <img
          src="https://cdn.shopify.com/s/files/1/0771/6975/4358/files/logo-footer_fc28a06e-0691-4e47-83e3-d3888c3202bb.png?v=1759271820"
          alt="Ecosistemas"
          className="h-10 mb-6"
        />
        <h1 className="text-2xl font-semibold text-brand-navy mb-1">Control de Vacaciones</h1>
        <p className="text-sm text-brand-gray mb-6">Acceso para empleados</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm text-neutral-700">Número de empleado</span>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="username"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="ej. 408"
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-700">Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-brand-red text-white py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Entrando..." : "Iniciar sesión"}
          </button>
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <p className="text-xs text-brand-gray pt-2">
            Si es tu primera vez, tu contraseña inicial es <code className="font-mono">ecosistemas</code> + tu año de ingreso (ej. <code className="font-mono">ecosistemas2024</code>). Te pediremos cambiarla al entrar.
          </p>
        </form>
      </div>
    </main>
  );
}

function traducirError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Número de empleado o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg))       return "Cuenta no activada. Contacta a Recursos Humanos.";
  return msg;
}

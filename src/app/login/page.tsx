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
    <main className="min-h-screen bg-brand-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-neutral-200 border-t-4 border-t-brand-red">
        <div className="p-8 pb-6 border-b border-neutral-100">
          <img
            src="https://cdn.shopify.com/s/files/1/0771/6975/4358/files/logo-footer_fc28a06e-0691-4e47-83e3-d3888c3202bb.png?v=1759271820"
            alt="Ecosistemas"
            className="h-9 mb-4"
          />
          <h1 className="text-lg font-semibold text-brand-navy leading-tight">Control de Vacaciones</h1>
          <p className="text-xs text-brand-gray mt-0.5">Ingresa tus datos para continuar</p>
        </div>
        <div className="p-8 pt-6">

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-brand-navy uppercase tracking-wide">Número de empleado</span>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="username"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="ej. 408"
              className="mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-brand-navy uppercase tracking-wide">Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-red text-white py-2.5 text-sm font-semibold tracking-wide hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Entrando..." : "Iniciar sesión"}
          </button>
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <p className="text-xs text-brand-gray pt-1">
            Primera vez: contraseña <code className="font-mono">ecosistemas</code> + año de ingreso (ej. <code className="font-mono">ecosistemas2024</code>).
          </p>
        </form>
        </div>
      </div>
      <p className="absolute bottom-4 text-xs text-white/40">Ecosistemas · Soluciones Innovadoras</p>
    </main>
  );
}

function traducirError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Número de empleado o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg))       return "Cuenta no activada. Contacta a Recursos Humanos.";
  return msg;
}

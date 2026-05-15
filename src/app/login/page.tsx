"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
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

        {status === "sent" ? (
          <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900">
            Revisa tu correo. Te enviamos un enlace para iniciar sesión.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm text-neutral-700">Correo corporativo</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@ecosistemas.com"
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </label>
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-brand-red text-white py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "Enviando..." : "Enviar enlace de acceso"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}

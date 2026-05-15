"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function CambiarContrasenaForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (/^ecosistemas\d{4}$/.test(password)) {
      setError("No puedes reutilizar la contraseña por defecto. Elige una nueva.");
      return;
    }

    setBusy(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Cambiar contraseña + bajar el flag password_default en user_metadata.
    const { data: { user }, error: updErr } = await supabase.auth.updateUser({
      password,
      data: { ...{}, password_default: false },
    });
    if (updErr || !user) {
      setBusy(false);
      setError(updErr?.message ?? "No se pudo actualizar la contraseña.");
      return;
    }

    // 2) Marcar password_changed_at en employees (no bloquea el flujo si falla).
    await supabase
      .from("employees")
      .update({ password_changed_at: new Date().toISOString() })
      .eq("auth_user_id", user.id);

    // Forzar refresh del JWT para que el middleware vea el nuevo flag.
    await supabase.auth.refreshSession();

    setBusy(false);
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="text-sm text-neutral-700">Nueva contraseña</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-700">Confírmala</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </label>
      <ul className="text-xs text-brand-gray list-disc pl-5 space-y-0.5">
        <li>Mínimo 8 caracteres.</li>
        <li>No uses la contraseña por defecto.</li>
        <li>Combina mayúsculas, números y símbolos para mayor seguridad.</li>
      </ul>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-brand-red text-white py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

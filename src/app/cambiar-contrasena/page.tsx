import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CambiarContrasenaForm } from "./cambiar-contrasena-form";

export default async function CambiarContrasenaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-md p-6">
      <img
        src="https://cdn.shopify.com/s/files/1/0771/6975/4358/files/logo-footer_fc28a06e-0691-4e47-83e3-d3888c3202bb.png?v=1759271820"
        alt="Ecosistemas"
        className="h-10 mb-6"
      />
      <h1 className="text-2xl font-semibold text-brand-navy">Cambia tu contraseña</h1>
      <p className="text-sm text-brand-gray mt-1 mb-5">
        Es tu primer ingreso. Por seguridad, define una contraseña personal antes de continuar.
      </p>
      <CambiarContrasenaForm />
    </main>
  );
}

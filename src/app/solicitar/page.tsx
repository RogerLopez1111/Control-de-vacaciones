import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SolicitarForm } from "./solicitar-form";

export default async function SolicitarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empleado } = await supabase
    .from("employees")
    .select("id, nombre, hire_date")
    .eq("auth_user_id", user.id)
    .single();

  if (!empleado) redirect("/");

  const { data: holidays } = await supabase
    .from("holidays")
    .select("date");

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">← Volver</Link>
      <h1 className="text-2xl font-semibold">Solicitar vacaciones</h1>
      <SolicitarForm holidays={(holidays ?? []).map((h) => h.date)} />
    </main>
  );
}

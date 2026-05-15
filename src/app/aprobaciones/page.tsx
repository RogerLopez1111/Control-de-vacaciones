import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AprobacionRow } from "./aprobacion-row";

export default async function AprobacionesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("id, is_admin")
    .eq("auth_user_id", user.id)
    .single();
  if (!me) redirect("/");

  // RLS already restricts what we see; we just ask for pending requests.
  const { data: pendientes } = await supabase
    .from("vacation_requests")
    .select(`
      id, start_date, end_date, business_days, employee_comment, requested_at,
      employee:employees!vacation_requests_employee_id_fkey ( id, nombre, apellido_paterno, branch_id )
    `)
    .eq("status", "pendiente")
    .order("requested_at", { ascending: true });

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">← Volver</Link>
      <h1 className="text-2xl font-semibold">Aprobaciones pendientes</h1>

      {(pendientes ?? []).length === 0 ? (
        <p className="text-sm text-neutral-500">No hay solicitudes pendientes.</p>
      ) : (
        <div className="space-y-3">
          {pendientes!.map((r) => (
            <AprobacionRow key={r.id} request={r} approverId={me.id} />
          ))}
        </div>
      )}
    </main>
  );
}

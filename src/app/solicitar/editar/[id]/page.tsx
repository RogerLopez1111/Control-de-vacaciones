import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SolicitarForm } from "../../solicitar-form";

export default async function EditarSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empleado } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!empleado) redirect("/");

  // RLS asegura que solo veas solicitudes que te corresponden.
  const { data: req } = await supabase
    .from("vacation_requests")
    .select("id, employee_id, start_date, end_date, employee_comment, status")
    .eq("id", id)
    .single();
  if (!req) notFound();

  // Solo el dueño puede editar; y solo si la solicitud aún no inició y no está
  // rechazada/cancelada (la RPC lo valida también).
  if (req.employee_id !== empleado.id) redirect("/");
  const todayIso = new Date().toISOString().slice(0, 10);
  if (req.start_date <= todayIso || (req.status !== "pendiente" && req.status !== "aprobada")) {
    redirect("/");
  }

  const { data: holidays } = await supabase.from("holidays").select("date");

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">← Volver</Link>
      <h1 className="text-2xl font-semibold">Modificar solicitud</h1>
      <SolicitarForm
        holidays={(holidays ?? []).map((h) => h.date)}
        initial={{
          requestId: req.id,
          startDate: req.start_date,
          endDate: req.end_date,
          comment: req.employee_comment ?? "",
        }}
      />
    </main>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .single();
  if (!me?.is_admin) redirect("/");

  return (
    <div>
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center gap-4 text-sm">
          <Link href="/" className="text-brand-gray hover:text-brand-navy">← Dashboard</Link>
          <span className="text-neutral-300">|</span>
          <span className="font-semibold text-brand-navy">Admin</span>
          <Link href="/admin/empleados" className="text-brand-gray hover:text-brand-navy">Empleados</Link>
          <Link href="/admin/organigrama" className="text-brand-gray hover:text-brand-navy">Organigrama</Link>
          <Link href="/admin/diagnosticos" className="text-brand-gray hover:text-brand-navy">Diagnósticos</Link>
        </div>
      </div>
      {children}
    </div>
  );
}

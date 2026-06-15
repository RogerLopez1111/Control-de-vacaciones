"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultPasswordFor } from "@/lib/auth-helpers";

export async function resetEmployeePassword(
  employeeId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };
  const { data: caller } = await supabase.from("employees").select("is_admin").eq("auth_user_id", user.id).single();
  if (!caller?.is_admin) return { ok: false, error: "Sin permisos de administrador." };

  // Fetch target employee
  const { data: emp } = await supabase.from("employees")
    .select("auth_user_id, hire_date")
    .eq("id", employeeId)
    .single();

  if (!emp) return { ok: false, error: "Empleado no encontrado." };
  if (!emp.auth_user_id) return { ok: false, error: "El empleado no tiene cuenta de autenticación vinculada." };

  const newPassword = defaultPasswordFor(emp.hire_date);

  const adminClient = createSupabaseAdminClient();

  const { error: authError } = await adminClient.auth.admin.updateUserById(emp.auth_user_id, {
    password: newPassword,
  });

  if (authError) return { ok: false, error: authError.message };

  // Clear password_changed_at so the badge reflects the reset
  await adminClient.from("employees")
    .update({ password_changed_at: null })
    .eq("id", employeeId);

  return { ok: true };
}

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendVacationRequestNotification } from "@/lib/email/notifier";

export interface SubmitVacationRequestInput {
  start_date: string;       // YYYY-MM-DD
  end_date: string;
  business_days: number;
  employee_comment: string | null;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

export async function submitVacationRequest(input: SubmitVacationRequestInput): Promise<SubmitResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: empleado, error: empErr } = await supabase
    .from("employees")
    .select("id, nombre, apellido_paterno, manager_employee_id, area_id")
    .eq("auth_user_id", user.id)
    .single();
  if (empErr || !empleado) return { ok: false, error: "No se encontró tu registro de empleado." };
  const empleadoForEmail = empleado;

  // El insert va con la sesión del usuario para que RLS valide
  // (employee_id = auth_employee_id(), empleado activo, etc.).
  const { error: insertErr } = await supabase.from("vacation_requests").insert({
    employee_id: empleado.id,
    start_date: input.start_date,
    end_date: input.end_date,
    business_days: input.business_days,
    employee_comment: input.employee_comment,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  // Notificación por correo — best-effort, no rompe el flujo si falla.
  // Usamos el service role para conseguir los emails reales del supervisor
  // y del/los admins (RLS podría ocultar empleados al que solicita).
  try {
    const admin = createSupabaseAdminClient();
    const recipientIds: number[] = [];
    if (empleado.manager_employee_id) recipientIds.push(empleado.manager_employee_id);

    // Observador del área (si existe)
    if (empleadoForEmail.area_id) {
      const { data: area } = await admin
        .from("areas")
        .select("watcher_employee_id")
        .eq("id", empleadoForEmail.area_id)
        .single();
      if (area?.watcher_employee_id && !recipientIds.includes(area.watcher_employee_id)) {
        recipientIds.push(area.watcher_employee_id);
      }
    }

    const { data: admins } = await admin
      .from("employees")
      .select("id, email")
      .eq("is_admin", true)
      .is("termination_date", null);
    for (const a of admins ?? []) {
      if (!recipientIds.includes(a.id)) recipientIds.push(a.id);
    }

    let emails: string[] = [];
    if (recipientIds.length > 0) {
      // Preferimos notification_email (corporativo, RRHH-controlado) sobre
      // email (personal, sincronizado del ERP).
      const { data: rows } = await admin
        .from("employees")
        .select("notification_email, email")
        .in("id", recipientIds);
      emails = (rows ?? [])
        .map((r) => r.notification_email ?? r.email ?? "")
        .filter((e) => !!e);
    }

    const employeeName = [empleado.nombre, empleado.apellido_paterno].filter(Boolean).join(" ");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    await sendVacationRequestNotification({
      to: emails,
      employeeName,
      startDate: input.start_date,
      endDate: input.end_date,
      businessDays: input.business_days,
      employeeComment: input.employee_comment,
      approvalUrl: `${baseUrl}/aprobaciones`,
    });
  } catch (err) {
    console.error("[solicitar] notificación falló:", err);
  }

  return { ok: true };
}

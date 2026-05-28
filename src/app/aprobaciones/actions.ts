"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface SaveSupervisorCommentInput {
  requestId: string;
  comment: string;
}

export async function saveSupervisorComment(
  input: SaveSupervisorCommentInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const admin = createSupabaseAdminClient();

  // Resolver el employee del caller.
  const { data: caller } = await admin
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!caller) return { ok: false, error: "No se encontró tu registro de empleado." };

  // Verificar que el caller es watcher del área del solicitante.
  const { data: req } = await admin
    .from("vacation_requests")
    .select("status, employee:employees!vacation_requests_employee_id_fkey ( area_id )")
    .eq("id", input.requestId)
    .single();
  if (!req) return { ok: false, error: "Solicitud no encontrada." };
  if (req.status !== "pendiente") return { ok: false, error: "Solo se puede comentar solicitudes pendientes." };

  const emp = Array.isArray(req.employee) ? req.employee[0] : req.employee;
  if (!emp?.area_id) return { ok: false, error: "El empleado no tiene área asignada." };

  const { data: area } = await admin
    .from("areas")
    .select("watcher_employee_id")
    .eq("id", emp.area_id)
    .single();
  if (!area || area.watcher_employee_id !== caller.id) {
    return { ok: false, error: "No tienes permiso para comentar esta solicitud." };
  }

  const { error } = await admin
    .from("vacation_requests")
    .update({
      supervisor_comment: input.comment.trim() || null,
      supervisor_comment_by_employee_id: input.comment.trim() ? caller.id : null,
    })
    .eq("id", input.requestId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
import { sendVacationDecisionNotification } from "@/lib/email/notifier";

export interface DecideInput {
  requestId: string;
  status: "aprobada" | "rechazada";
  comment: string | null;
}

export interface DecideResult {
  ok: boolean;
  error?: string;
}

export async function decideVacationRequest(input: DecideInput): Promise<DecideResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: caller, error: callerErr } = await supabase
    .from("employees")
    .select("id, nombre, apellido_paterno")
    .eq("auth_user_id", user.id)
    .single();
  if (callerErr || !caller) return { ok: false, error: "No se encontró tu registro de empleado." };

  // El UPDATE va con la sesión del usuario — RLS valida si puede aprobar
  // (supervisor del solicitante o admin). Watchers no podrán: la política
  // de UPDATE no los autoriza y Supabase devuelve "permission denied".
  const { error: updErr } = await supabase
    .from("vacation_requests")
    .update({
      status: input.status,
      decided_at: new Date().toISOString(),
      decided_by_employee_id: caller.id,
      decision_comment: input.comment,
    })
    .eq("id", input.requestId);
  if (updErr) return { ok: false, error: updErr.message };

  // Notificación al empleado solicitante — best-effort.
  try {
    const admin = createSupabaseAdminClient();
    const { data: req } = await admin
      .from("vacation_requests")
      .select(`
        start_date, end_date, business_days,
        employee:employees!vacation_requests_employee_id_fkey ( nombre, apellido_paterno, email, notification_email )
      `)
      .eq("id", input.requestId)
      .single();

    if (req) {
      const emp = Array.isArray(req.employee) ? req.employee[0] : req.employee;
      if (emp) {
        const to = emp.notification_email ?? emp.email ?? "";
        const employeeName = [emp.nombre, emp.apellido_paterno].filter(Boolean).join(" ");
        const decidedBy = [caller.nombre, caller.apellido_paterno].filter(Boolean).join(" ");
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
          ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

        await sendVacationDecisionNotification({
          to: to ? [to] : [],
          employeeName,
          decision: input.status,
          decidedBy,
          startDate: req.start_date,
          endDate: req.end_date,
          businessDays: req.business_days,
          decisionComment: input.comment,
          dashboardUrl: `${baseUrl}/`,
        });
      }
    }
  } catch (err) {
    console.error("[aprobaciones] notificación al empleado falló:", err);
  }

  return { ok: true };
}

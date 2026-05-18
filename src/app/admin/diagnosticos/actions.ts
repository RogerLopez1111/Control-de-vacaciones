"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface TestEmailResult {
  ok: boolean;
  recipient?: string;
  message?: string;
  error?: string;
  smtpConfigured: boolean;
  envSummary: {
    SMTP_HOST: boolean;
    SMTP_PORT: boolean;
    SMTP_USER: boolean;
    SMTP_PASS: boolean;
    SMTP_FROM: boolean;
    NEXT_PUBLIC_APP_URL: boolean;
  };
}

export async function sendTestEmail(overrideTo?: string): Promise<TestEmailResult> {
  const envSummary = {
    SMTP_HOST: !!process.env.SMTP_HOST,
    SMTP_PORT: !!process.env.SMTP_PORT,
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_PASS: !!process.env.SMTP_PASS,
    SMTP_FROM: !!process.env.SMTP_FROM,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
  };
  const smtpConfigured = envSummary.SMTP_HOST && envSummary.SMTP_PORT && envSummary.SMTP_USER && envSummary.SMTP_PASS;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado.", smtpConfigured, envSummary };

  const { data: me } = await supabase
    .from("employees")
    .select("id, nombre, email, notification_email, is_admin")
    .eq("auth_user_id", user.id)
    .single();
  if (!me?.is_admin) return { ok: false, error: "Solo admin puede correr este diagnóstico.", smtpConfigured, envSummary };

  const fallback = me.notification_email ?? me.email ?? "";
  const recipient = (overrideTo?.trim() || fallback).toLowerCase();
  if (!recipient || !recipient.includes("@")) {
    return {
      ok: false,
      error: `No hay correo destino válido. Tu notification_email = ${me.notification_email ?? "(vacío)"}, email = ${me.email ?? "(vacío)"}. Especifica uno manualmente.`,
      smtpConfigured,
      envSummary,
    };
  }

  if (!smtpConfigured) {
    return {
      ok: false,
      recipient,
      error: "SMTP no configurado en este entorno. Revisa que las env vars SMTP_* estén en Vercel y redeploya.",
      smtpConfigured,
      envSummary,
    };
  }

  // Importar dinámicamente para no fallar el build si nodemailer no estuviera presente
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });

  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER!,
      to: recipient,
      subject: "[Vacaciones] Correo de prueba",
      text: `Este es un correo de prueba enviado desde el panel de diagnósticos de Control de Vacaciones a las ${new Date().toLocaleString("es-MX")}.\n\nSi recibiste esto, el SMTP está bien configurado.`,
      html: `<p>Correo de prueba enviado desde el panel de diagnósticos de Control de Vacaciones a las <strong>${new Date().toLocaleString("es-MX")}</strong>.</p><p>Si recibiste esto, el SMTP está bien configurado.</p>`,
    });
    return {
      ok: true,
      recipient,
      message: `Enviado. Message ID: ${info.messageId ?? "(sin id)"}. Si no llega, revisa la carpeta de spam.`,
      smtpConfigured,
      envSummary,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, recipient, error: msg, smtpConfigured, envSummary };
  }
}

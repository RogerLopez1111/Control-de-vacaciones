/**
 * Notificaciones por correo via SMTP (nodemailer).
 *
 * Convención compartida con el CRM (PRUEBA-CRM-GEMINI-CODE):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *   Puerto 465 = TLS implícito; 587 = STARTTLS.
 *
 * El módulo no falla si las env vars no están: simplemente loguea y retorna.
 * Esto permite que la app funcione en local sin SMTP configurado.
 */
import nodemailer, { type Transporter } from "nodemailer";

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (cachedTransport) return cachedTransport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn("[email] SMTP no configurado — se omiten notificaciones");
    return null;
  }
  const port = Number(SMTP_PORT);
  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransport;
}

export interface VacationRequestEmailParams {
  to: string[];                     // emails reales (corporativos)
  employeeName: string;
  startDate: string;                // YYYY-MM-DD
  endDate: string;
  businessDays: number;
  employeeComment: string | null;
  approvalUrl: string;
}

export async function sendVacationRequestNotification(p: VacationRequestEmailParams): Promise<void> {
  const transport = getTransport();
  const recipients = [...new Set(p.to.filter((x) => x && x.includes("@")))];
  if (!transport || recipients.length === 0) {
    console.warn(`[email] saltando notificación (transport=${!!transport}, recipients=${recipients.length})`);
    return;
  }

  const subject = `[Vacaciones] ${p.employeeName} solicita ${p.businessDays} día${p.businessDays === 1 ? "" : "s"}`;
  const dateRange = p.startDate === p.endDate
    ? fmt(p.startDate)
    : `${fmt(p.startDate)} → ${fmt(p.endDate)}`;

  const text = [
    `${p.employeeName} solicitó vacaciones:`,
    ``,
    `  ${dateRange}`,
    `  ${p.businessDays} día${p.businessDays === 1 ? "" : "s"} hábil${p.businessDays === 1 ? "" : "es"}`,
    p.employeeComment ? `  Comentario: ${p.employeeComment}` : null,
    ``,
    `Revisa la solicitud: ${p.approvalUrl}`,
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; color: #141456; max-width: 480px;">
      <p style="font-size: 15px; margin: 0 0 12px;">
        <strong>${escapeHtml(p.employeeName)}</strong> solicitó vacaciones:
      </p>
      <table style="border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #686868;">Fechas</td><td>${escapeHtml(dateRange)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #686868;">Días hábiles</td><td><strong>${p.businessDays}</strong></td></tr>
        ${p.employeeComment ? `<tr><td style="padding: 4px 12px 4px 0; color: #686868; vertical-align: top;">Comentario</td><td>${escapeHtml(p.employeeComment)}</td></tr>` : ""}
      </table>
      <p style="margin: 18px 0 0;">
        <a href="${p.approvalUrl}" style="display: inline-block; background: #B70B0F; color: white; text-decoration: none; padding: 10px 18px; font-weight: 600;">Revisar solicitud</a>
      </p>
      <p style="font-size: 12px; color: #686868; margin-top: 24px;">Control de Vacaciones — Ecosistemas</p>
    </div>
  `;

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER!,
      to: recipients.join(", "),
      subject,
      text,
      html,
    });
    console.log(`[email] notificación enviada a ${recipients.length} destinatario(s)`);
  } catch (err) {
    console.error("[email] envío falló:", err);
    // No relanzamos: el correo es best-effort; la solicitud ya quedó guardada.
  }
}

function fmt(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

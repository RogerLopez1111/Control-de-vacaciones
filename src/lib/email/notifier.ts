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
import { formatDateMX } from "@/lib/format";

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

export interface VacationDecisionEmailParams {
  to: string[];                     // empleado solicitante
  employeeName: string;             // saludo
  decision: "aprobada" | "rechazada";
  decidedBy: string;                // quien aprobó/rechazó
  startDate: string;
  endDate: string;
  businessDays: number;
  decisionComment: string | null;
  dashboardUrl: string;
}

export async function sendVacationDecisionNotification(p: VacationDecisionEmailParams): Promise<void> {
  const transport = getTransport();
  const recipients = [...new Set(p.to.filter((x) => x && x.includes("@")))];
  if (!transport || recipients.length === 0) {
    console.warn(`[email] saltando notificación de decisión (transport=${!!transport}, recipients=${recipients.length})`);
    return;
  }

  const verb = p.decision === "aprobada" ? "aprobada" : "rechazada";
  const subject = `[Vacaciones] Tu solicitud fue ${verb}`;
  const dateRange = p.startDate === p.endDate
    ? fmt(p.startDate)
    : `${fmt(p.startDate)} → ${fmt(p.endDate)}`;

  const text = [
    `Hola ${p.employeeName},`,
    ``,
    `Tu solicitud de vacaciones (${dateRange}, ${p.businessDays} día${p.businessDays === 1 ? "" : "s"} hábil${p.businessDays === 1 ? "" : "es"}) fue ${verb} por ${p.decidedBy}.`,
    p.decisionComment ? `\nComentario: ${p.decisionComment}` : null,
    ``,
    `Ver detalles: ${p.dashboardUrl}`,
  ].filter(Boolean).join("\n");

  const accentColor = p.decision === "aprobada" ? "#15803d" : "#B70B0F";
  const html = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; color: #141456; max-width: 480px;">
      <p style="font-size: 15px; margin: 0 0 12px;">Hola <strong>${escapeHtml(p.employeeName)}</strong>,</p>
      <p style="font-size: 14px; margin: 0 0 12px;">
        Tu solicitud de vacaciones fue
        <strong style="color: ${accentColor};">${verb}</strong>
        por ${escapeHtml(p.decidedBy)}.
      </p>
      <table style="border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #686868;">Fechas</td><td>${escapeHtml(dateRange)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #686868;">Días hábiles</td><td><strong>${p.businessDays}</strong></td></tr>
        ${p.decisionComment ? `<tr><td style="padding: 4px 12px 4px 0; color: #686868; vertical-align: top;">Comentario</td><td>${escapeHtml(p.decisionComment)}</td></tr>` : ""}
      </table>
      <p style="margin: 18px 0 0;">
        <a href="${p.dashboardUrl}" style="display: inline-block; background: #141456; color: white; text-decoration: none; padding: 10px 18px; font-weight: 600;">Ver en el sistema</a>
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
    console.log(`[email] decisión enviada a ${recipients.length} destinatario(s)`);
  } catch (err) {
    console.error("[email] envío de decisión falló:", err);
  }
}

const fmt = formatDateMX;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

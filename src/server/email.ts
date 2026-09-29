import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, features, isProd } from "./env";
import { site } from "@/config/site";

/**
 * Transactional email over SMTP (any provider: SES, Postmark, Resend,
 * Brevo, Mailgun… all offer SMTP). Configure SMTP_URL + EMAIL_FROM.
 * Without it, emails are not sent: in development the message is printed
 * to the server log so flows can be tested; in production callers get
 * `EmailNotConfiguredError` and show that the feature isn't available.
 */
export class EmailNotConfiguredError extends Error {}

let transport: Transporter | null = null;

export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }) {
  if (!features.email) {
    if (isProd) throw new EmailNotConfiguredError("El envío de emails no está configurado (SMTP_URL y EMAIL_FROM)");
    console.info(`[email:dev] Para: ${msg.to}\n[email:dev] Asunto: ${msg.subject}\n${msg.text}`);
    return;
  }
  transport ??= nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({ from: env.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
}

/** Can the app send the given kind of email right now? */
export const emailAvailable = () => features.email || !isProd;

export function passwordResetEmail(link: string) {
  const subject = `Restablece tu contraseña de ${site.name}`;
  const text = `Hola,\n\nHemos recibido una solicitud para restablecer la contraseña de tu cuenta de ${site.name}.\nAbre este enlace (caduca en 1 hora):\n\n${link}\n\nSi no has sido tú, ignora este mensaje: tu contraseña no cambiará.`;
  const html = `<p>Hola,</p><p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de ${site.name}.</p><p><a href="${link}">Restablecer contraseña</a> (caduca en 1 hora)</p><p>Si no has sido tú, ignora este mensaje: tu contraseña no cambiará.</p>`;
  return { subject, text, html };
}

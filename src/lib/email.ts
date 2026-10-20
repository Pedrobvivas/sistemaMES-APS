import "server-only";
import nodemailer from "nodemailer";

type Email = { to: string; subject: string; text: string };

// Envia por SMTP quando configurado; senão mostra o e-mail no log do servidor
// (prático em desenvolvimento para pegar o link de redefinição de senha).
export async function sendEmail({ to, subject, text }: Email) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[e-mail] Para: ${to}\nAssunto: ${subject}\n\n${text}\n`);
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}

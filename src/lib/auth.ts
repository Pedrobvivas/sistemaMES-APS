import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Projeto Base",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Cadastro público fechado: usuários são criados por um admin
    // (tela Usuários) ou na configuração inicial (/configurar).
    disableSignUp: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Redefinição de senha",
        text: `Olá, ${user.name}.\n\nPara criar uma nova senha, acesse:\n${url}\n\nSe não foi você que pediu, ignore este e-mail.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // renova a cada dia de uso
  },
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // Deve ser o último plugin: grava os cookies em server actions.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

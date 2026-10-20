import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// Sessão do usuário atual (uma consulta por requisição, graças ao cache).
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// Use no topo de páginas e server actions que exigem login.
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/entrar");
  return session;
}

// Use em tudo que só administradores podem ver ou fazer.
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/painel");
  return session;
}

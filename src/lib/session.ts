import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { inicioDoPapel, normalizarPapel, pode, type Permissao } from "@/lib/papeis";

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
  if (session.user.role !== "admin") redirect(inicioDoPapel(session.user.role));
  return session;
}

// Exige uma permissão do perfil (src/lib/papeis.ts). Sem ela, volta para a tela inicial do perfil.
export async function exigirPermissao(permissao: Permissao) {
  const session = await requireSession();
  if (!pode(session.user.role, permissao)) redirect(inicioDoPapel(session.user.role));
  return { ...session, papel: normalizarPapel(session.user.role) };
}

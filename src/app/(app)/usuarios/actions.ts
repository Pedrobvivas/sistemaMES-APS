"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { papeis, type Papel } from "@/lib/papeis";
import { requireAdmin } from "@/lib/session";

const esquema = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  senha: z.string().min(8, "Mínimo de 8 caracteres."),
  papel: z.enum(papeis),
});

export type EstadoUsuario = {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "email" | "senha" | "papel" | "geral", string>>;
};

export async function criarUsuario(_: EstadoUsuario, formData: FormData): Promise<EstadoUsuario> {
  await requireAdmin();

  const dados = esquema.safeParse(Object.fromEntries(formData));
  if (!dados.success) {
    const e = dados.error.flatten().fieldErrors;
    return { erros: { nome: e.nome?.[0], email: e.email?.[0], senha: e.senha?.[0], papel: e.papel?.[0] } };
  }

  try {
    await auth.api.createUser({
      body: {
        name: dados.data.nome,
        email: dados.data.email,
        password: dados.data.senha,
        role: dados.data.papel,
      },
      headers: await headers(),
    });
  } catch (e) {
    console.error(e);
    return { erros: { geral: "Não foi possível criar. O e-mail já pode estar em uso." } };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function alterarPapel(userId: string, papel: Papel) {
  const { user } = await requireAdmin();
  if (!papeis.includes(papel)) return;
  if (user.id === userId) return; // ninguém tira o próprio acesso de admin
  await auth.api.setRole({ body: { userId, role: papel }, headers: await headers() });
  revalidatePath("/usuarios");
}

export async function removerUsuario(userId: string) {
  const { user } = await requireAdmin();
  if (user.id === userId) return; // ninguém remove a si mesmo
  await auth.api.removeUser({ body: { userId }, headers: await headers() });
  revalidatePath("/usuarios");
}

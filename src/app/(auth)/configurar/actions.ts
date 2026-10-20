"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { precisaConfigurar } from "@/lib/setup";

const esquema = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export type EstadoConfigurar = { erros?: Partial<Record<"nome" | "email" | "senha" | "geral", string>> };

// Cria o primeiro administrador. Só funciona enquanto não existe nenhum usuário.
export async function criarPrimeiroAdmin(_: EstadoConfigurar, formData: FormData): Promise<EstadoConfigurar> {
  if (!(await precisaConfigurar())) redirect("/entrar");

  const dados = esquema.safeParse(Object.fromEntries(formData));
  if (!dados.success) {
    const erros = dados.error.flatten().fieldErrors;
    return { erros: { nome: erros.nome?.[0], email: erros.email?.[0], senha: erros.senha?.[0] } };
  }

  try {
    await auth.api.createUser({
      body: {
        name: dados.data.nome,
        email: dados.data.email,
        password: dados.data.senha,
        role: "admin",
      },
    });
  } catch (e) {
    console.error(e);
    return { erros: { geral: "Não foi possível criar o administrador. Veja o log do servidor." } };
  }

  redirect("/entrar");
}

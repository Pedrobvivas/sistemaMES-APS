"use server";

// Ações do cadastro de clientes. Molde para qualquer cadastro novo:
// validar com zod → checar permissão → gravar → revalidar → redirecionar.
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clientes } from "@/db/schema";
import { exigirPermissao, requireAdmin } from "@/lib/session";

const opcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const esquema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do cliente."),
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido.")]).transform((v) => v || null),
  telefone: opcional,
  observacoes: opcional,
  status: z.enum(["ativo", "inativo"]),
});

type CampoCliente = keyof z.infer<typeof esquema>;
export type EstadoCliente = { erros?: Partial<Record<CampoCliente | "geral", string>> };

function lerErros(erro: z.ZodError): EstadoCliente {
  const campos = erro.flatten().fieldErrors as Record<string, string[] | undefined>;
  return { erros: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v?.[0]])) };
}

export async function salvarCliente(
  id: string | null,
  _: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  await exigirPermissao("ordens:editar");

  const dados = esquema.safeParse(Object.fromEntries(formData));
  if (!dados.success) return lerErros(dados.error);

  try {
    if (id) {
      await db.update(clientes).set(dados.data).where(eq(clientes.id, id));
    } else {
      await db.insert(clientes).values(dados.data);
    }
  } catch (e) {
    console.error(e);
    return { erros: { geral: "Não foi possível salvar. Tente novamente." } };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

// Excluir é restrito a administradores (exemplo de permissão por ação).
export async function excluirCliente(id: string) {
  await requireAdmin();
  await db.delete(clientes).where(eq(clientes.id, id));
  revalidatePath("/clientes");
  redirect("/clientes");
}

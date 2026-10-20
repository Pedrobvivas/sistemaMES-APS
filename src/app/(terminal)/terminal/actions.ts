"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/session";
import { registrarEvento } from "@/server/mes";

const esquema = z.object({
  operacaoId: z.string().uuid(),
  recursoId: z.string().uuid(),
  operadorId: z.string().uuid({ message: "Selecione o operador." }),
  tipo: z.enum(["inicio", "pausa", "retomada", "fim"]),
  motivoParadaId: z.string().uuid().nullable().optional(),
  quantidades: z.object({ boa: z.number().int().min(0), rejeitada: z.number().int().min(0) }).nullable().optional(),
  confirmarExcedente: z.boolean().optional(),
  chaveIdempotencia: z.string().min(8).max(100),
});

export type RespostaApontamento = { ok: true; mensagem: string } | { ok: false; erro: string };

export async function apontar(cmd: z.input<typeof esquema>): Promise<RespostaApontamento> {
  const { user } = await exigirPermissao("execucao:apontar");
  const v = esquema.safeParse(cmd);
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const r = await registrarEvento(v.data, user.id);
    if (!r.ok) return r;
    revalidatePath("/terminal");
    revalidatePath(`/terminal/${v.data.recursoId}`);
    revalidatePath("/painel");
    return { ok: true, mensagem: r.mensagem };
  } catch (e) {
    console.error(e);
    return { ok: false, erro: "Não foi possível registrar. Verifique a conexão e tente de novo; o mesmo toque não será duplicado." };
  }
}

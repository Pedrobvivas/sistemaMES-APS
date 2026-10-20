"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/session";
import { aprovar, arrastar, descartar, desafixarOperacoes, gerarProgramacao } from "@/server/aps/programacoes";

export type RespostaProgramacao = { ok: true; programacaoId?: string; mensagem?: string } | { ok: false; erro: string };

function atualizar() {
  revalidatePath("/programacao");
  revalidatePath("/painel");
  revalidatePath("/ordens");
}

export async function gerarAcao(): Promise<RespostaProgramacao> {
  const { user } = await exigirPermissao("programacao:editar");
  const r = await gerarProgramacao(user.id);
  if (r.ok) atualizar();
  return r;
}

const esquemaArraste = z.object({
  programacaoId: z.string().uuid(),
  operacaoId: z.string().uuid(),
  modo: z.enum(["ordem", "operacao"]),
  novoInicio: z.number().int().positive(),
  recursoId: z.string().uuid().nullable(),
});

// Arraste no Gantt (ou "Mover para…" no painel): gera uma nova versão sugerida.
export async function simularArraste(cmd: z.input<typeof esquemaArraste>): Promise<RespostaProgramacao> {
  const { user } = await exigirPermissao("programacao:editar");
  const v = esquemaArraste.safeParse(cmd);
  if (!v.success) return { ok: false, erro: "Dados do arraste inválidos." };
  const r = await arrastar(v.data, user.id);
  if (r.ok) atualizar();
  return r;
}

const esquemaDesafixar = z.object({
  programacaoId: z.string().uuid(),
  operacaoIds: z.array(z.string().uuid()).min(1),
  descricao: z.string().trim().min(1).max(200),
});

export async function desafixarAcao(cmd: z.input<typeof esquemaDesafixar>): Promise<RespostaProgramacao> {
  const { user } = await exigirPermissao("programacao:editar");
  const v = esquemaDesafixar.safeParse(cmd);
  if (!v.success) return { ok: false, erro: "Dados inválidos." };
  const r = await desafixarOperacoes(v.data, user.id);
  if (r.ok) atualizar();
  return r;
}

export async function aprovarAcao(programacaoId: string): Promise<RespostaProgramacao> {
  const { user } = await exigirPermissao("programacao:aprovar");
  if (!z.string().uuid().safeParse(programacaoId).success) return { ok: false, erro: "Programação inválida." };
  const r = await aprovar(programacaoId, user.id);
  if (r.ok) atualizar();
  return r.ok ? { ok: true, programacaoId, mensagem: "Programação aprovada. Ela passa a valer para o terminal e o painel." } : r;
}

export async function descartarAcao(programacaoId: string): Promise<RespostaProgramacao> {
  const { user } = await exigirPermissao("programacao:editar");
  if (!z.string().uuid().safeParse(programacaoId).success) return { ok: false, erro: "Programação inválida." };
  const r = await descartar(programacaoId, user.id);
  if (r.ok) atualizar();
  return r;
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { ordensProducao, produtos } from "@/db/schema";
import { errosZod, inteiro, mensagemErroBanco, textoOpcional, type EstadoForm } from "@/lib/formularios";
import { exigirPermissao } from "@/lib/session";
import { registrarAuditoria } from "@/server/auditoria";
import { camposEditaveis, cancelarOrdem, liberarOrdem, recalcularDuracoes } from "@/server/ordens";

// Erro de regra de negócio (mensagem pronta para o usuário).
class ErroRegra extends Error {}

const dataIso = (rotulo: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `Informe ${rotulo}.`);
const uuidOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().uuid().nullable());

const esquema = z
  .object({
    codigo: z.string().trim().min(1, "Informe o código da OP.").max(30),
    produtoId: z.string().uuid("Escolha o produto.").optional(),
    quantidade: inteiro("Quantidade", 1).optional(),
    prioridade: z.coerce.number().int().min(1).max(3),
    prazoEntrega: dataIso("a data de entrega"),
    inicioMaisCedo: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .pipe(dataIso("a data").nullable()),
    clienteId: uuidOpcional,
    pedidoVenda: textoOpcional,
    observacoes: textoOpcional,
  })
  .refine((d) => !d.inicioMaisCedo || d.inicioMaisCedo <= d.prazoEntrega, {
    message: "O início mais cedo não pode ser depois da entrega.",
    path: ["inicioMaisCedo"],
  });

export async function salvarOrdem(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { user } = await exigirPermissao("ordens:editar");
  const v = esquema.safeParse(Object.fromEntries(fd));
  if (!v.success) return errosZod(v.error);
  const d = v.data;
  let salvoId = id;
  try {
    if (!id) {
      if (!d.produtoId) return { erros: { produtoId: "Escolha o produto." } };
      if (!d.quantidade) return { erros: { quantidade: "Informe a quantidade." } };
      const [produto] = await db.select().from(produtos).where(eq(produtos.id, d.produtoId));
      if (!produto?.ativo) return { erros: { produtoId: "Produto inativo ou inexistente." } };
      [{ id: salvoId }] = await db
        .insert(ordensProducao)
        .values({ ...d, produtoId: d.produtoId, quantidade: d.quantidade, criadoPor: user.id })
        .returning({ id: ordensProducao.id });
    } else {
      await db.transaction(async (tx) => {
        const [atual] = await tx.select().from(ordensProducao).where(eq(ordensProducao.id, id)).for("update");
        if (!atual) throw new ErroRegra("OP não encontrada.");
        const pode = camposEditaveis(atual.status);
        if (!pode.demais) throw new ErroRegra("Esta OP não pode mais ser alterada.");
        const quantidade = pode.quantidade && d.quantidade ? d.quantidade : atual.quantidade;
        await tx
          .update(ordensProducao)
          .set({
            codigo: d.codigo,
            prioridade: d.prioridade,
            prazoEntrega: d.prazoEntrega,
            inicioMaisCedo: d.inicioMaisCedo,
            clienteId: d.clienteId,
            pedidoVenda: d.pedidoVenda,
            observacoes: d.observacoes,
            quantidade,
            ...(pode.produto && d.produtoId ? { produtoId: d.produtoId } : {}),
          })
          .where(eq(ordensProducao.id, id));
        if (atual.status === "liberada" && quantidade !== atual.quantidade) {
          await recalcularDuracoes(tx, id, atual.produtoId, quantidade);
        }
      });
    }
  } catch (e) {
    if (e instanceof ErroRegra) return { erros: { geral: e.message } };
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  await registrarAuditoria(db, { entidade: "ordem", entidadeId: salvoId, acao: id ? "editar" : "criar", resumo: `OP ${d.codigo} ${id ? "alterada" : "criada"}`, usuarioId: user.id });
  revalidatePath("/ordens");
  redirect(`/ordens/${salvoId}?salvo=1`);
}

export type EstadoAcaoOrdem = { erro?: string; ok?: string };

export async function liberar(id: string): Promise<EstadoAcaoOrdem> {
  const { user } = await exigirPermissao("ordens:editar");
  const r = await liberarOrdem(id, user.id);
  if (!r.ok) return { erro: r.erro };
  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
  return { ok: "OP liberada. Gere uma nova programação para que ela entre no Gantt." };
}

export async function cancelar(id: string, motivo: string): Promise<EstadoAcaoOrdem> {
  const { user } = await exigirPermissao("ordens:editar");
  const m = z.string().trim().min(3, "Informe o motivo do cancelamento.").safeParse(motivo);
  if (!m.success) return { erro: m.error.issues[0].message };
  const r = await cancelarOrdem(id, m.data, user.id);
  if (!r.ok) return { erro: r.erro };
  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
  return { ok: "OP cancelada." };
}

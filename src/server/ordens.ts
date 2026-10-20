import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { operacoesOrdem, ordemHistorico, ordensProducao, roteiroOperacoes } from "@/db/schema";
import { duracaoProcessamento, validarAcaoOrdem, type StatusOrdem } from "@/domain/ordens/status";
import { registrarAuditoria } from "@/server/auditoria";
import type { Resultado } from "@/server/aps/programacoes";

// Libera a OP: copia o roteiro atual do produto para a ordem (snapshot).
export async function liberarOrdem(ordemId: string, usuarioId: string): Promise<Resultado> {
  return db.transaction(async (tx) => {
    const [ordem] = await tx.select().from(ordensProducao).where(eq(ordensProducao.id, ordemId)).for("update");
    if (!ordem) return { ok: false as const, erro: "OP não encontrada." };
    const roteiro = await tx
      .select()
      .from(roteiroOperacoes)
      .where(eq(roteiroOperacoes.produtoId, ordem.produtoId))
      .orderBy(asc(roteiroOperacoes.sequencia));
    const v = validarAcaoOrdem(ordem.status, "liberar", { operacoesDoRoteiro: roteiro.length });
    if (!v.ok) return v;

    await tx.insert(operacoesOrdem).values(
      roteiro.map((r) => ({
        ordemId: ordem.id,
        sequencia: r.sequencia,
        nome: r.nome,
        grupoRecursoId: r.grupoRecursoId,
        setupMin: r.setupMin,
        processamentoMin: duracaoProcessamento(Number(r.tempoPorUnidadeMin), Number(r.tempoFixoMin), ordem.quantidade),
      })),
    );
    await tx.update(ordensProducao).set({ status: v.novoStatus, liberadaEm: new Date() }).where(eq(ordensProducao.id, ordem.id));
    await tx.insert(ordemHistorico).values({ ordemId: ordem.id, de: ordem.status, para: v.novoStatus, usuarioId });
    await registrarAuditoria(tx, {
      entidade: "ordem",
      entidadeId: ordem.id,
      acao: "liberar",
      resumo: `OP ${ordem.codigo} liberada com ${roteiro.length} operação(ões)`,
      usuarioId,
    });
    return { ok: true as const };
  });
}

export async function cancelarOrdem(ordemId: string, motivo: string, usuarioId: string): Promise<Resultado> {
  return db.transaction(async (tx) => {
    const [ordem] = await tx.select().from(ordensProducao).where(eq(ordensProducao.id, ordemId)).for("update");
    if (!ordem) return { ok: false as const, erro: "OP não encontrada." };
    const iniciadas = await tx
      .select({ id: operacoesOrdem.id })
      .from(operacoesOrdem)
      .where(and(eq(operacoesOrdem.ordemId, ordem.id), ne(operacoesOrdem.status, "pendente"), ne(operacoesOrdem.status, "cancelada")))
      .limit(1);
    const v = validarAcaoOrdem(ordem.status, "cancelar", { algumaIniciada: iniciadas.length > 0 });
    if (!v.ok) return v;
    await tx.update(operacoesOrdem).set({ status: "cancelada", fixadaInicio: null, fixadaRecursoId: null }).where(eq(operacoesOrdem.ordemId, ordem.id));
    await tx.update(ordensProducao).set({ status: v.novoStatus }).where(eq(ordensProducao.id, ordem.id));
    await tx.insert(ordemHistorico).values({ ordemId: ordem.id, de: ordem.status, para: v.novoStatus, usuarioId, motivo });
    await registrarAuditoria(tx, { entidade: "ordem", entidadeId: ordem.id, acao: "cancelar", resumo: `OP ${ordem.codigo} cancelada: ${motivo}`, usuarioId });
    return { ok: true as const };
  });
}

// Recalcula a duração das operações pendentes quando a quantidade de uma OP liberada muda.
export async function recalcularDuracoes(executor: Pick<typeof db, "select" | "update">, ordemId: string, produtoId: string, quantidade: number) {
  const roteiro = await executor.select().from(roteiroOperacoes).where(eq(roteiroOperacoes.produtoId, produtoId));
  const ops = await executor.select().from(operacoesOrdem).where(and(eq(operacoesOrdem.ordemId, ordemId), eq(operacoesOrdem.status, "pendente")));
  for (const op of ops) {
    const r = roteiro.find((x) => x.nome === op.nome);
    if (!r) continue; // operação removida do roteiro depois da liberação: mantém o tempo copiado
    await executor
      .update(operacoesOrdem)
      .set({ processamentoMin: duracaoProcessamento(Number(r.tempoPorUnidadeMin), Number(r.tempoFixoMin), quantidade) })
      .where(eq(operacoesOrdem.id, op.id));
  }
}

// Campos que podem mudar em cada status.
export function camposEditaveis(status: StatusOrdem) {
  switch (status) {
    case "rascunho":
      return { produto: true, quantidade: true, demais: true };
    case "liberada":
      return { produto: false, quantidade: true, demais: true };
    case "em_execucao":
      return { produto: false, quantidade: false, demais: true };
    default:
      return { produto: false, quantidade: false, demais: false };
  }
}

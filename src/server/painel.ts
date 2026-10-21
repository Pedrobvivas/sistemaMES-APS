import "server-only";
import { and, count, eq, gte, inArray, lte, sum } from "drizzle-orm";
import { db } from "@/db";
import { apontamentos, eventosExecucao, motivosParada, operacoesOrdem, ordensProducao, programacaoItens } from "@/db/schema";
import { trechosDeParada, type TipoEvento } from "@/domain/mes/execucao";
import { DIA, MINUTO, diaIsoLocal, fimDoDia, localParaInstante, somarDias } from "@/domain/tempo";
import { programacaoAprovada } from "@/server/aps/programacoes";
import { FUSO } from "@/server/aps/entrada";
import { situacaoRecursos } from "@/server/mes";

export const DIAS_PARETO = 7;

export async function carregarPainel() {
  const agora = Date.now();
  const hoje = diaIsoLocal(agora, FUSO);
  const inicioHoje = localParaInstante(hoje, 0, FUSO);
  const fimHoje = fimDoDia(hoje, FUSO);
  const inicioPareto = agora - DIAS_PARETO * DIA;

  const [porStatus, aprovada, ordensAtivas, recursosAgora] = await Promise.all([
    db.select({ status: ordensProducao.status, n: count() }).from(ordensProducao).groupBy(ordensProducao.status),
    programacaoAprovada(),
    db.select().from(ordensProducao).where(inArray(ordensProducao.status, ["liberada", "em_execucao"])),
    situacaoRecursos(),
  ]);
  const contagem = Object.fromEntries(porStatus.map((s) => [s.status, s.n])) as Record<string, number>;

  // OPs em atenção: atrasadas pela programação aprovada, sem programação, ou vencendo em 2 dias.
  const resumo = new Map((aprovada?.resumoOrdens ?? []).map((r) => [r.ordemId, r]));
  const limiteVencimento = somarDias(hoje, 2);
  const atencao = ordensAtivas
    .map((o) => {
      const r = resumo.get(o.id);
      const motivo = !r
        ? ("sem_programacao" as const)
        : !r.completa
          ? ("incompleta" as const)
          : r.atrasoMin > 0
            ? ("atrasada" as const)
            : o.prazoEntrega <= limiteVencimento
              ? ("vence_logo" as const)
              : null;
      return motivo ? { id: o.id, codigo: o.codigo, prazo: o.prazoEntrega, status: o.status, motivo, atrasoMin: r?.atrasoMin ?? 0, fimPrevisto: r?.fimPrevisto ?? null } : null;
    })
    .filter((x) => x !== null)
    .sort((a, b) => {
      const peso = { atrasada: 0, incompleta: 1, sem_programacao: 2, vence_logo: 3 };
      return peso[a.motivo] - peso[b.motivo] || b.atrasoMin - a.atrasoMin || a.prazo.localeCompare(b.prazo);
    });

  // Planejado × realizado de hoje (operações que a programação aprovada previa terminar hoje).
  const planejadasHoje = aprovada
    ? await db
        .select({ status: operacoesOrdem.status })
        .from(programacaoItens)
        .innerJoin(operacoesOrdem, eq(operacoesOrdem.id, programacaoItens.operacaoId))
        .where(and(eq(programacaoItens.programacaoId, aprovada.id), gte(programacaoItens.fim, new Date(inicioHoje)), lte(programacaoItens.fim, new Date(fimHoje))))
    : [];
  const [concluidasHoje] = await db
    .select({ n: count() })
    .from(operacoesOrdem)
    .where(and(gte(operacoesOrdem.fimReal, new Date(inicioHoje)), lte(operacoesOrdem.fimReal, new Date(fimHoje))));
  const [quantidadesHoje] = await db
    .select({ boa: sum(apontamentos.quantidadeBoa), rejeitada: sum(apontamentos.quantidadeRejeitada) })
    .from(apontamentos)
    .where(and(gte(apontamentos.ocorridoEm, new Date(inicioHoje)), lte(apontamentos.ocorridoEm, new Date(fimHoje))));

  const { pareto, totalMin: totalParadas } = await paradasPorMotivo(inicioPareto, agora);

  return {
    agora,
    contagem,
    aprovada: aprovada ? { id: aprovada.id, numero: aprovada.numero, decididoEm: aprovada.decididoEm, metricas: aprovada.metricas } : null,
    atencao,
    hoje: {
      planejadas: planejadasHoje.length,
      planejadasConcluidas: planejadasHoje.filter((p) => p.status === "concluida").length,
      concluidas: concluidasHoje.n,
      quantidadeBoa: Number(quantidadesHoje.boa ?? 0),
      quantidadeRejeitada: Number(quantidadesHoje.rejeitada ?? 0),
    },
    pareto,
    totalParadasMin: totalParadas,
    recursos: recursosAgora,
  };
}

// Paradas por motivo numa janela: trechos "Pausar → Retomar/Finalizar" apontados no terminal,
// recortados na janela (uma parada ainda aberta conta até o fim da janela).
// Usado pelo Painel e pela Visão geral, para os dois seguirem o mesmo critério.
export async function paradasPorMotivo(de: number, ate: number) {
  const comPausa = await db
    .selectDistinct({ id: eventosExecucao.operacaoId })
    .from(eventosExecucao)
    .where(and(eq(eventosExecucao.tipo, "pausa"), gte(eventosExecucao.ocorridoEm, new Date(de - 30 * DIA)), lte(eventosExecucao.ocorridoEm, new Date(ate))));
  const eventos = comPausa.length
    ? await db
        .select({ operacaoId: eventosExecucao.operacaoId, tipo: eventosExecucao.tipo, ocorridoEm: eventosExecucao.ocorridoEm, motivoParadaId: eventosExecucao.motivoParadaId })
        .from(eventosExecucao)
        .where(inArray(eventosExecucao.operacaoId, comPausa.map((c) => c.id)))
    : [];
  const motivos = new Map((await db.select().from(motivosParada)).map((m) => [m.id, m]));
  const porMotivo = new Map<string, number>();
  for (const opId of new Set(eventos.map((e) => e.operacaoId))) {
    const trechos = trechosDeParada(
      eventos
        .filter((e) => e.operacaoId === opId)
        .map((e) => ({ tipo: e.tipo as TipoEvento, ocorridoEm: e.ocorridoEm.getTime(), motivoParadaId: e.motivoParadaId })),
      ate,
    );
    for (const t of trechos) {
      const ini = Math.max(t.inicio, de);
      const fim = Math.min(t.fim, ate);
      if (fim <= ini) continue;
      const chave = t.motivoParadaId ?? "sem-motivo";
      porMotivo.set(chave, (porMotivo.get(chave) ?? 0) + (fim - ini) / MINUTO);
    }
  }
  const total = [...porMotivo.values()].reduce((s, v) => s + v, 0);
  let acumulado = 0;
  const pareto = [...porMotivo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, minutos]) => {
      acumulado += minutos;
      const m = motivos.get(id);
      return {
        motivo: m?.nome ?? "Sem motivo",
        categoria: m?.categoria ?? "nao_planejada",
        minutos: Math.round(minutos),
        percentual: total ? minutos / total : 0,
        acumulado: total ? acumulado / total : 0,
      };
    });
  const naoPlanejadaMin = pareto.filter((p) => p.categoria === "nao_planejada").reduce((s, p) => s + p.minutos, 0);
  return { pareto, totalMin: Math.round(total), naoPlanejadaMin };
}

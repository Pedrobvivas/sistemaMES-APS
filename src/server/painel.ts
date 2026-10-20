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

  // Pareto de paradas: trechos pausa → retomada dos últimos dias, recortados na janela.
  const comPausa = await db
    .selectDistinct({ id: eventosExecucao.operacaoId })
    .from(eventosExecucao)
    .where(and(eq(eventosExecucao.tipo, "pausa"), gte(eventosExecucao.ocorridoEm, new Date(inicioPareto - 30 * DIA))));
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
      eventos.filter((e) => e.operacaoId === opId).map((e) => ({ tipo: e.tipo as TipoEvento, ocorridoEm: e.ocorridoEm.getTime(), motivoParadaId: e.motivoParadaId })),
      agora,
    );
    for (const t of trechos) {
      const de = Math.max(t.inicio, inicioPareto);
      const ate = Math.min(t.fim, agora);
      if (ate <= de) continue;
      const chave = t.motivoParadaId ?? "sem-motivo";
      porMotivo.set(chave, (porMotivo.get(chave) ?? 0) + (ate - de) / MINUTO);
    }
  }
  const totalParadas = [...porMotivo.values()].reduce((s, v) => s + v, 0);
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
        percentual: totalParadas ? minutos / totalParadas : 0,
        acumulado: totalParadas ? acumulado / totalParadas : 0,
      };
    });

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
    totalParadasMin: Math.round(totalParadas),
    recursos: recursosAgora,
  };
}

import "server-only";
// Indicadores da Visão geral. Período padrão: últimos 30 dias, comparados com os 30 anteriores.
// Fórmulas documentadas em docs/indicadores.md. Sem base de cálculo, o valor vem null ("—" na tela).
import { and, asc, eq, gte, inArray, lte, max } from "drizzle-orm";
import { db } from "@/db";
import { apontamentos, centrosTrabalho, clientes, operacoesOrdem, ordensProducao, programacaoItens } from "@/db/schema";
import {
  entregasNoPrazo,
  minutosNaJanela,
  producaoPorDia,
  razao,
  variacaoPercentual,
  variacaoPontos,
  type Variacao,
} from "@/domain/indicadores/visao-geral";
import { DIA, diaIsoLocal, fimDoDia } from "@/domain/tempo";
import { FUSO, carregarDisponibilidade } from "@/server/aps/entrada";
import { programacaoAprovada } from "@/server/aps/programacoes";
import { paradasPorMotivo } from "@/server/painel";

export const DIAS_PERIODO = 30;
export const DIAS_CARGA = 7;

type Janela = { de: number; ate: number };

// Apontamentos da ÚLTIMA operação de cada OP = produto acabado (evita contar a mesma peça em cada etapa).
async function producaoAcabada(j: Janela) {
  const linhas = await db
    .select({
      ordemId: operacoesOrdem.ordemId,
      sequencia: operacoesOrdem.sequencia,
      boa: apontamentos.quantidadeBoa,
      rejeitada: apontamentos.quantidadeRejeitada,
      ocorridoEm: apontamentos.ocorridoEm,
    })
    .from(apontamentos)
    .innerJoin(operacoesOrdem, eq(operacoesOrdem.id, apontamentos.operacaoId))
    .where(and(gte(apontamentos.ocorridoEm, new Date(j.de)), lte(apontamentos.ocorridoEm, new Date(j.ate))));
  if (linhas.length === 0) return [];
  const ordens = [...new Set(linhas.map((l) => l.ordemId))];
  const ultimas = await db
    .select({ ordemId: operacoesOrdem.ordemId, ultima: max(operacoesOrdem.sequencia) })
    .from(operacoesOrdem)
    .where(and(inArray(operacoesOrdem.ordemId, ordens), inArray(operacoesOrdem.status, ["pendente", "em_execucao", "pausada", "concluida"])))
    .groupBy(operacoesOrdem.ordemId);
  const ultimaSeq = new Map(ultimas.map((u) => [u.ordemId, u.ultima]));
  return linhas
    .filter((l) => l.sequencia === ultimaSeq.get(l.ordemId))
    .map((l) => ({ ocorridoEm: l.ocorridoEm.getTime(), boa: l.boa, rejeitada: l.rejeitada }));
}

// OPs concluídas na janela, com término real (fim da última operação) e prazo.
async function ordensConcluidas(j: Janela) {
  const linhas = await db
    .select({ ordemId: operacoesOrdem.ordemId, termino: max(operacoesOrdem.fimReal), prazo: ordensProducao.prazoEntrega })
    .from(operacoesOrdem)
    .innerJoin(ordensProducao, eq(ordensProducao.id, operacoesOrdem.ordemId))
    .where(eq(ordensProducao.status, "concluida"))
    .groupBy(operacoesOrdem.ordemId, ordensProducao.prazoEntrega);
  return linhas
    .filter((l) => l.termino && l.termino.getTime() >= j.de && l.termino.getTime() <= j.ate)
    .map((l) => ({ termino: l.termino!.getTime(), prazoFim: fimDoDia(l.prazo, FUSO) }));
}

async function resumoPeriodo(j: Janela) {
  const [producao, concluidas, paradas] = await Promise.all([producaoAcabada(j), ordensConcluidas(j), paradasPorMotivo(j.de, j.ate)]);
  const boa = producao.reduce((s, p) => s + p.boa, 0);
  const rejeitada = producao.reduce((s, p) => s + p.rejeitada, 0);
  return {
    producao,
    boa,
    rejeitada,
    qualidade: razao(boa, boa + rejeitada),
    concluidas: concluidas.length,
    entregas: entregasNoPrazo(concluidas),
    paradas,
  };
}

export type Indicador = {
  chave: string;
  rotulo: string;
  valor: string;
  detalhe: string;
  variacao: Variacao;
  melhorQuandoSobe: boolean;
  definicao: string;
  icone: string;
};

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const num = (v: number) => v.toLocaleString("pt-BR");
const horas = (min: number) => `${(min / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

export async function carregarVisaoGeral() {
  const agora = Date.now();
  const atual: Janela = { de: agora - DIAS_PERIODO * DIA, ate: agora };
  const anterior: Janela = { de: agora - 2 * DIAS_PERIODO * DIA, ate: atual.de };
  const carga: Janela = { de: agora, ate: agora + DIAS_CARGA * DIA };

  const [a, b, aprovada, carteira, listaCentros] = await Promise.all([
    resumoPeriodo(atual),
    resumoPeriodo(anterior),
    programacaoAprovada(),
    db
      .select({ id: ordensProducao.id, codigo: ordensProducao.codigo, prazo: ordensProducao.prazoEntrega, status: ordensProducao.status, cliente: clientes.nome })
      .from(ordensProducao)
      .leftJoin(clientes, eq(clientes.id, ordensProducao.clienteId))
      .where(inArray(ordensProducao.status, ["liberada", "em_execucao"])),
    db.select().from(centrosTrabalho).where(eq(centrosTrabalho.ativo, true)).orderBy(asc(centrosTrabalho.ordem), asc(centrosTrabalho.nome)),
  ]);

  // Carga dos próximos 7 dias: horas programadas (aprovada) ÷ horas de turno disponíveis.
  const { recursos: ativos, disponibilidade } = await carregarDisponibilidade(carga.de, carga.ate);
  const itens = aprovada
    ? await db
        .select({ recursoId: programacaoItens.recursoId, segmentos: programacaoItens.segmentos })
        .from(programacaoItens)
        .where(and(eq(programacaoItens.programacaoId, aprovada.id), gte(programacaoItens.fim, new Date(carga.de)), lte(programacaoItens.inicio, new Date(carga.ate))))
    : [];
  const ocupadoPorRecurso = new Map<string, number>();
  for (const i of itens) ocupadoPorRecurso.set(i.recursoId, (ocupadoPorRecurso.get(i.recursoId) ?? 0) + minutosNaJanela(i.segmentos, carga.de, carga.ate));
  const porCentro = new Map<string, { ocupado: number; disponivel: number }>();
  for (const r of ativos) {
    const c = porCentro.get(r.centroId) ?? { ocupado: 0, disponivel: 0 };
    c.disponivel += minutosNaJanela(disponibilidade.get(r.id) ?? [], carga.de, carga.ate);
    c.ocupado += ocupadoPorRecurso.get(r.id) ?? 0;
    porCentro.set(r.centroId, c);
  }
  const ocupacaoCentros = listaCentros
    .filter((c) => porCentro.has(c.id))
    .map((c) => {
      const v = porCentro.get(c.id)!;
      return { id: c.id, nome: c.nome, ocupadoMin: Math.round(v.ocupado), disponivelMin: Math.round(v.disponivel), taxa: razao(v.ocupado, v.disponivel) };
    });
  const totalOcupado = ocupacaoCentros.reduce((s, c) => s + c.ocupadoMin, 0);
  const totalDisponivel = ocupacaoCentros.reduce((s, c) => s + c.disponivelMin, 0);

  // OPs em risco: atraso previsto ou conflito na programação aprovada.
  const resumo = new Map((aprovada?.resumoOrdens ?? []).map((r) => [r.ordemId, r]));
  const emRisco = carteira
    .map((o) => {
      const r = resumo.get(o.id);
      if (!r) return { ...o, motivo: "fora" as const, atrasoMin: 0, fimPrevisto: null as number | null };
      if (!r.completa) return { ...o, motivo: "conflito" as const, atrasoMin: 0, fimPrevisto: null };
      if (r.atrasoMin > 0) return { ...o, motivo: "atraso" as const, atrasoMin: r.atrasoMin, fimPrevisto: r.fimPrevisto };
      return null;
    })
    .filter((x) => x !== null)
    .sort((x, y) => y.atrasoMin - x.atrasoMin || x.prazo.localeCompare(y.prazo));
  const atrasadas = emRisco.filter((x) => x.motivo === "atraso").length;

  const indicadores: Indicador[] = [
    {
      chave: "otd",
      rotulo: `Entregas no prazo (${DIAS_PERIODO} dias)`,
      valor: pct(a.entregas.taxa),
      detalhe: a.entregas.total ? `${a.entregas.noPrazo} de ${a.entregas.total} OPs concluídas` : "Nenhuma OP concluída no período",
      variacao: variacaoPontos(a.entregas.taxa, b.entregas.taxa),
      melhorQuandoSobe: true,
      definicao: "OPs concluídas no período cujo término da última operação ficou até o fim do dia de entrega ÷ OPs concluídas no período.",
      icone: "concluir",
    },
    {
      chave: "pecas",
      rotulo: `Produtos acabados (${DIAS_PERIODO} dias)`,
      valor: num(a.boa),
      detalhe: "peças boas na última operação",
      variacao: variacaoPercentual(a.boa, b.boa),
      melhorQuandoSobe: true,
      definicao: "Soma das quantidades boas apontadas na última operação de cada OP (produto pronto). Etapas intermediárias não entram, para não contar a mesma peça várias vezes.",
      icone: "cadastros",
    },
    {
      chave: "qualidade",
      rotulo: `Qualidade (${DIAS_PERIODO} dias)`,
      valor: pct(a.qualidade),
      detalhe: a.boa + a.rejeitada ? `${num(a.rejeitada)} rejeitada(s)` : "Sem apontamentos no período",
      variacao: variacaoPontos(a.qualidade, b.qualidade),
      melhorQuandoSobe: true,
      definicao: "Peças boas ÷ (boas + rejeitadas), na última operação de cada OP, no período.",
      icone: "info",
    },
    {
      chave: "concluidas",
      rotulo: `OPs concluídas (${DIAS_PERIODO} dias)`,
      valor: num(a.concluidas),
      detalhe: `${num(b.concluidas)} nos ${DIAS_PERIODO} dias anteriores`,
      variacao: variacaoPercentual(a.concluidas, b.concluidas),
      melhorQuandoSobe: true,
      definicao: "OPs com status Concluída cuja última operação terminou no período.",
      icone: "ordens",
    },
    {
      chave: "carteira",
      rotulo: "OPs em carteira",
      valor: num(carteira.length),
      detalhe: aprovada ? `${atrasadas} com atraso previsto` : "sem programação aprovada",
      variacao: null,
      melhorQuandoSobe: false,
      definicao: "OPs liberadas ou em execução agora. O atraso previsto vem da programação aprovada.",
      icone: "programacao",
    },
    {
      chave: "carga",
      rotulo: `Carga programada (${DIAS_CARGA} dias)`,
      valor: aprovada ? horas(totalOcupado) : "—",
      detalhe: aprovada ? `de ${horas(totalDisponivel)} de turno disponíveis` : "sem programação aprovada",
      variacao: null,
      melhorQuandoSobe: true,
      definicao: "Horas de trabalho da programação aprovada que caem nos próximos 7 dias, somando todos os recursos ativos.",
      icone: "relogio",
    },
    {
      chave: "ocupacao",
      rotulo: `Ocupação dos recursos (${DIAS_CARGA} dias)`,
      valor: aprovada ? pct(razao(totalOcupado, totalDisponivel)) : "—",
      detalhe: "programado ÷ tempo de turno",
      variacao: null,
      melhorQuandoSobe: true,
      definicao: "Horas programadas nos próximos 7 dias ÷ horas de turno disponíveis (turnos − feriados − indisponibilidades) dos recursos ativos.",
      icone: "terminal",
    },
    {
      chave: "paradas",
      rotulo: `Tempo parado (${DIAS_PERIODO} dias)`,
      valor: horas(a.paradas.totalMin),
      detalhe: a.paradas.totalMin ? `${pct(razao(a.paradas.naoPlanejadaMin, a.paradas.totalMin))} não planejado` : "Nenhuma parada apontada",
      variacao: variacaoPercentual(a.paradas.totalMin, b.paradas.totalMin),
      melhorQuandoSobe: false,
      definicao: "Soma dos trechos entre “Pausar” e “Retomar/Finalizar” apontados no terminal, no período.",
      icone: "pausar",
    },
  ];

  return {
    agora,
    indicadores,
    producaoDiaria: producaoPorDia(a.producao, diaIsoLocal(agora, FUSO), DIAS_PERIODO, FUSO),
    ocupacaoCentros,
    paradas: a.paradas.pareto.slice(0, 5),
    totalParadasMin: a.paradas.totalMin,
    emRisco: emRisco.slice(0, 6),
    totalEmRisco: emRisco.length,
    aprovada: aprovada ? { numero: aprovada.numero } : null,
  };
}

export type DadosVisaoGeral = Awaited<ReturnType<typeof carregarVisaoGeral>>;

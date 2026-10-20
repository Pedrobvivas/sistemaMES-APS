import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  centrosTrabalho,
  clientes,
  grupoRecursoMembros,
  indisponibilidades,
  operacoesOrdem,
  ordensProducao,
  produtos,
  programacaoConflitos,
  programacaoItens,
  programacoes,
  user,
} from "@/db/schema";
import { compararMetricas, compararProgramacoes, type ComparacaoMetricas, type MudancaOrdem } from "@/domain/aps/comparacao";
import type { Metricas } from "@/domain/aps/tipos";
import type { Intervalo } from "@/domain/calendario";
import { DIA, diaIsoLocal, fimDoDia, localParaInstante, somarDias } from "@/domain/tempo";
import { FUSO, carregarDisponibilidade } from "./entrada";

export type ItemGantt = {
  operacaoId: string;
  ordemId: string;
  ordemCodigo: string;
  operacaoNome: string;
  sequencia: number;
  recursoId: string;
  inicio: number;
  fim: number;
  setupMin: number;
  segmentos: Intervalo[];
  fixada: boolean;
  emExecucao: boolean;
  statusOperacao: string;
  justificativa: string;
  atrasoMin: number;
  prazo: string;
  prioridade: number;
  produto: string;
  cliente: string | null;
  elegiveis: string[];
};

export type RecursoGantt = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  disponibilidade: Intervalo[];
  paradas: { inicio: number; fim: number; motivo: string }[];
};

export type DadosGantt = {
  programacao: {
    id: string;
    numero: number;
    status: string;
    origem: string;
    descricao: string;
    geradoEm: number;
    geradoPor: string | null;
    agora: number;
    metricas: Metricas;
  };
  aprovada: { id: string; numero: number } | null;
  sugeridaAberta: { id: string; numero: number } | null;
  janela: { inicio: number; fim: number };
  centros: { id: string; nome: string; recursos: RecursoGantt[] }[];
  itens: ItemGantt[];
  conflitos: { tipo: string; mensagem: string; ordemCodigo: string | null; operacaoId: string | null }[];
  comparacao: { mudancas: (MudancaOrdem & { ordemCodigo: string })[]; metricas: ComparacaoMetricas } | null;
  opsForaDaVersao: number;
  fuso: string;
};

export async function listarVersoes(limite = 20) {
  return db
    .select({
      id: programacoes.id,
      numero: programacoes.numero,
      status: programacoes.status,
      origem: programacoes.origem,
      descricao: programacoes.descricao,
      geradoEm: programacoes.geradoEm,
      decididoEm: programacoes.decididoEm,
      metricas: programacoes.metricas,
      geradoPor: user.name,
    })
    .from(programacoes)
    .leftJoin(user, eq(user.id, programacoes.geradoPor))
    .orderBy(desc(programacoes.numero))
    .limit(limite);
}

// Versão a mostrar: a pedida, senão a sugerida aberta, senão a aprovada.
export async function escolherVersao(id?: string) {
  if (id) {
    const [p] = await db.select({ id: programacoes.id }).from(programacoes).where(eq(programacoes.id, id)).limit(1);
    if (p) return p.id;
  }
  const [aberta] = await db.select({ id: programacoes.id }).from(programacoes).where(eq(programacoes.status, "sugerida")).limit(1);
  if (aberta) return aberta.id;
  const [aprovada] = await db.select({ id: programacoes.id }).from(programacoes).where(eq(programacoes.status, "aprovada")).limit(1);
  return aprovada?.id ?? null;
}

export async function carregarGantt(programacaoId: string): Promise<DadosGantt | null> {
  const [prog] = await db
    .select({ p: programacoes, autor: user.name })
    .from(programacoes)
    .leftJoin(user, eq(user.id, programacoes.geradoPor))
    .where(eq(programacoes.id, programacaoId))
    .limit(1);
  if (!prog) return null;
  const p = prog.p;

  const [[aprovada], [aberta]] = await Promise.all([
    db.select().from(programacoes).where(eq(programacoes.status, "aprovada")).limit(1),
    db.select({ id: programacoes.id, numero: programacoes.numero }).from(programacoes).where(eq(programacoes.status, "sugerida")).limit(1),
  ]);

  const linhas = await db
    .select({
      item: programacaoItens,
      ordemCodigo: ordensProducao.codigo,
      prazo: ordensProducao.prazoEntrega,
      prioridade: ordensProducao.prioridade,
      operacaoNome: operacoesOrdem.nome,
      sequencia: operacoesOrdem.sequencia,
      grupoId: operacoesOrdem.grupoRecursoId,
      statusOperacao: operacoesOrdem.status,
      produto: produtos.nome,
      cliente: clientes.nome,
    })
    .from(programacaoItens)
    .innerJoin(ordensProducao, eq(ordensProducao.id, programacaoItens.ordemId))
    .innerJoin(operacoesOrdem, eq(operacoesOrdem.id, programacaoItens.operacaoId))
    .innerJoin(produtos, eq(produtos.id, ordensProducao.produtoId))
    .leftJoin(clientes, eq(clientes.id, ordensProducao.clienteId))
    .where(eq(programacaoItens.programacaoId, p.id))
    .orderBy(asc(programacaoItens.inicio));

  const membros = await db.select().from(grupoRecursoMembros).orderBy(asc(grupoRecursoMembros.preferencia));
  const elegiveis = new Map<string, string[]>();
  for (const m of membros) elegiveis.set(m.grupoId, [...(elegiveis.get(m.grupoId) ?? []), m.recursoId]);
  const atraso = new Map(p.resumoOrdens.map((r) => [r.ordemId, r.atrasoMin]));

  const itens: ItemGantt[] = linhas.map((l) => ({
    operacaoId: l.item.operacaoId,
    ordemId: l.item.ordemId,
    ordemCodigo: l.ordemCodigo,
    operacaoNome: l.operacaoNome,
    sequencia: l.sequencia,
    recursoId: l.item.recursoId,
    inicio: l.item.inicio.getTime(),
    fim: l.item.fim.getTime(),
    setupMin: l.item.setupMin,
    segmentos: l.item.segmentos,
    fixada: l.item.fixada,
    emExecucao: l.item.emExecucao,
    statusOperacao: l.statusOperacao,
    justificativa: l.item.justificativa,
    atrasoMin: atraso.get(l.item.ordemId) ?? 0,
    prazo: l.prazo,
    prioridade: l.prioridade,
    produto: l.produto,
    cliente: l.cliente,
    elegiveis: elegiveis.get(l.grupoId) ?? [],
  }));

  // Janela: do início do dia da geração até um dia depois do último término (mínimo 14 dias).
  const agora = p.agora.getTime();
  const inicio = localParaInstante(diaIsoLocal(agora, FUSO), 0, FUSO);
  const ultimo = itens.length ? Math.max(...itens.map((i) => i.fim)) : agora;
  const fim = Math.max(fimDoDia(somarDias(diaIsoLocal(ultimo, FUSO), 1), FUSO), inicio + 14 * DIA);

  const { recursos: listaRecursos, disponibilidade } = await carregarDisponibilidade(inicio, fim);
  const centros = await db.select().from(centrosTrabalho).where(eq(centrosTrabalho.ativo, true)).orderBy(asc(centrosTrabalho.ordem), asc(centrosTrabalho.nome));
  const paradas = listaRecursos.length
    ? await db.select().from(indisponibilidades).where(inArray(indisponibilidades.recursoId, listaRecursos.map((r) => r.id)))
    : [];

  const conflitos = await db
    .select({ tipo: programacaoConflitos.tipo, mensagem: programacaoConflitos.mensagem, ordemCodigo: ordensProducao.codigo, operacaoId: programacaoConflitos.operacaoId })
    .from(programacaoConflitos)
    .leftJoin(ordensProducao, eq(ordensProducao.id, programacaoConflitos.ordemId))
    .where(eq(programacaoConflitos.programacaoId, p.id));

  let comparacao: DadosGantt["comparacao"] = null;
  if (p.status !== "aprovada" && aprovada && aprovada.id !== p.id) {
    const codigos = new Map(
      (await db.select({ id: ordensProducao.id, codigo: ordensProducao.codigo }).from(ordensProducao)).map((o) => [o.id, o.codigo]),
    );
    comparacao = {
      mudancas: compararProgramacoes(aprovada.resumoOrdens, p.resumoOrdens).map((m) => ({ ...m, ordemCodigo: codigos.get(m.ordemId) ?? "?" })),
      metricas: compararMetricas(aprovada.metricas, p.metricas),
    };
  }

  // OPs liberadas depois da geração desta versão (ficam fora até gerar de novo).
  const programadas = new Set(p.resumoOrdens.map((r) => r.ordemId));
  const ativas = await db
    .select({ id: ordensProducao.id })
    .from(ordensProducao)
    .where(and(inArray(ordensProducao.status, ["liberada", "em_execucao"])));
  const opsForaDaVersao = ativas.filter((o) => !programadas.has(o.id)).length;

  return {
    programacao: {
      id: p.id,
      numero: p.numero,
      status: p.status,
      origem: p.origem,
      descricao: p.descricao,
      geradoEm: p.geradoEm.getTime(),
      geradoPor: prog.autor,
      agora,
      metricas: p.metricas,
    },
    aprovada: aprovada ? { id: aprovada.id, numero: aprovada.numero } : null,
    sugeridaAberta: aberta ?? null,
    janela: { inicio, fim },
    centros: centros
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        recursos: listaRecursos
          .filter((r) => r.centroId === c.id)
          .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"))
          .map((r) => ({
            id: r.id,
            codigo: r.codigo,
            nome: r.nome,
            tipo: r.tipo,
            disponibilidade: disponibilidade.get(r.id) ?? [],
            paradas: paradas
              .filter((x) => x.recursoId === r.id && x.fim.getTime() > inicio && x.inicio.getTime() < fim)
              .map((x) => ({ inicio: x.inicio.getTime(), fim: x.fim.getTime(), motivo: x.motivo })),
          })),
      }))
      .filter((c) => c.recursos.length > 0),
    itens,
    conflitos,
    comparacao,
    opsForaDaVersao,
    fuso: FUSO,
  };
}

import "server-only";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  eventosExecucao,
  feriados,
  grupoRecursoMembros,
  indisponibilidades,
  operacoesOrdem,
  ordensProducao,
  recursos,
  turnoPeriodos,
  turnos,
} from "@/db/schema";
import { gerarDisponibilidade, type Intervalo } from "@/domain/calendario";
import type { EntradaSequenciamento, Fixacao, OrdemEntrada, RecursoEntrada } from "@/domain/aps/tipos";
import { tempoTrabalhado, type TipoEvento } from "@/domain/mes/execucao";
import { DIA, FUSO_PADRAO, MINUTO, fimDoDia, localParaInstante } from "@/domain/tempo";

export const HORIZONTE_DIAS = 60;
export const FUSO = process.env.FUSO_FABRICA ?? FUSO_PADRAO;

// Disponibilidade de cada recurso ativo numa janela (turnos − feriados − indisponibilidades).
export async function carregarDisponibilidade(de: number, ate: number) {
  const [lista, periodos, dias, paradas] = await Promise.all([
    db.select().from(recursos).where(eq(recursos.ativo, true)),
    db
      .select({ turnoId: turnoPeriodos.turnoId, diaSemana: turnoPeriodos.diaSemana, inicioMin: turnoPeriodos.inicioMin, fimMin: turnoPeriodos.fimMin })
      .from(turnoPeriodos)
      .innerJoin(turnos, eq(turnos.id, turnoPeriodos.turnoId))
      .where(eq(turnos.ativo, true)),
    db.select().from(feriados),
    db
      .select()
      .from(indisponibilidades)
      .where(and(lte(indisponibilidades.inicio, new Date(ate)), gte(indisponibilidades.fim, new Date(de)))),
  ]);
  const feriadosIso = dias.map((d) => d.data);
  const mapa = new Map<string, Intervalo[]>();
  for (const r of lista) {
    mapa.set(
      r.id,
      r.turnoId
        ? gerarDisponibilidade({
            periodos: periodos.filter((p) => p.turnoId === r.turnoId),
            feriados: feriadosIso,
            indisponibilidades: paradas.filter((p) => p.recursoId === r.id).map((p) => ({ inicio: p.inicio.getTime(), fim: p.fim.getTime() })),
            de,
            ate,
            fuso: FUSO,
          })
        : [],
    );
  }
  return { recursos: lista, disponibilidade: mapa };
}

// Monta a entrada do sequenciador a partir do banco: OPs liberadas e em execução,
// recursos elegíveis por grupo, operações já iniciadas e as datas fixadas.
export async function montarEntrada(opcoes: { agora?: number; fixacoes?: Fixacao[] } = {}): Promise<EntradaSequenciamento> {
  const agora = Math.floor((opcoes.agora ?? Date.now()) / MINUTO) * MINUTO;
  const horizonteFim = agora + HORIZONTE_DIAS * DIA;
  const { recursos: listaRecursos, disponibilidade } = await carregarDisponibilidade(agora, horizonteFim);

  const ordens = await db
    .select()
    .from(ordensProducao)
    .where(inArray(ordensProducao.status, ["liberada", "em_execucao"]))
    .orderBy(asc(ordensProducao.codigo));
  const ids = ordens.map((o) => o.id);
  const ops = ids.length
    ? await db
        .select()
        .from(operacoesOrdem)
        .where(and(inArray(operacoesOrdem.ordemId, ids), ne(operacoesOrdem.status, "cancelada")))
        .orderBy(asc(operacoesOrdem.sequencia))
    : [];
  const membros = await db
    .select({ grupoId: grupoRecursoMembros.grupoId, recursoId: grupoRecursoMembros.recursoId, preferencia: grupoRecursoMembros.preferencia, codigo: recursos.codigo })
    .from(grupoRecursoMembros)
    .innerJoin(recursos, eq(recursos.id, grupoRecursoMembros.recursoId))
    .where(eq(recursos.ativo, true))
    .orderBy(asc(grupoRecursoMembros.preferencia), asc(recursos.codigo));
  const elegiveisPorGrupo = new Map<string, string[]>();
  for (const m of membros) elegiveisPorGrupo.set(m.grupoId, [...(elegiveisPorGrupo.get(m.grupoId) ?? []), m.recursoId]);

  // Tempo já trabalhado nas operações iniciadas, para estimar o restante.
  const iniciadas = ops.filter((o) => o.status === "em_execucao" || o.status === "pausada");
  const eventos = iniciadas.length
    ? await db
        .select({ operacaoId: eventosExecucao.operacaoId, tipo: eventosExecucao.tipo, ocorridoEm: eventosExecucao.ocorridoEm })
        .from(eventosExecucao)
        .where(inArray(eventosExecucao.operacaoId, iniciadas.map((o) => o.id)))
    : [];

  const entradaOrdens: OrdemEntrada[] = ordens.map((o) => ({
    id: o.id,
    codigo: o.codigo,
    prioridade: o.prioridade,
    prazoEntrega: fimDoDia(o.prazoEntrega, FUSO),
    inicioMaisCedo: o.inicioMaisCedo ? localParaInstante(o.inicioMaisCedo, 0, FUSO) : null,
    operacoes: ops
      .filter((op) => op.ordemId === o.id)
      .map((op) => {
        let minutosRestantes: number | null = null;
        if (op.status === "em_execucao" || op.status === "pausada") {
          const trabalhado = tempoTrabalhado(
            eventos.filter((e) => e.operacaoId === op.id).map((e) => ({ tipo: e.tipo as TipoEvento, ocorridoEm: e.ocorridoEm.getTime() })),
            agora,
          );
          // Estimativa: o previsto menos o já trabalhado, com mínimo de 15 min enquanto não finalizar.
          minutosRestantes = Math.max(15, Math.round(op.setupMin + op.processamentoMin - trabalhado / MINUTO));
        }
        return {
          id: op.id,
          sequencia: op.sequencia,
          nome: op.nome,
          setupMin: op.setupMin,
          processamentoMin: op.processamentoMin,
          recursosElegiveis: elegiveisPorGrupo.get(op.grupoRecursoId) ?? [],
          status: op.status,
          recursoAtualId: op.recursoExecucaoId,
          minutosRestantes,
          fimReal: op.fimReal?.getTime() ?? null,
        };
      }),
  }));

  const fixacoes: Fixacao[] =
    opcoes.fixacoes ??
    ops
      .filter((op) => op.fixadaInicio && op.status === "pendente")
      .map((op) => ({ operacaoId: op.id, inicio: op.fixadaInicio!.getTime(), recursoId: op.fixadaRecursoId }));

  const entradaRecursos: RecursoEntrada[] = listaRecursos
    .map((r) => ({ id: r.id, nome: r.nome, disponibilidade: disponibilidade.get(r.id) ?? [] }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { agora, horizonteFim, fuso: FUSO, recursos: entradaRecursos, ordens: entradaOrdens, fixacoes };
}

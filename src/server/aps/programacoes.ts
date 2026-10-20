import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { operacoesOrdem, ordensProducao, programacaoConflitos, programacaoItens, programacoes, recursos } from "@/db/schema";
import { aplicarArraste, desafixar, type ModoArraste } from "@/domain/aps/arraste";
import { sequenciar } from "@/domain/aps/sequenciador";
import type { Fixacao, ItemProgramado, ResultadoSequenciamento } from "@/domain/aps/tipos";
import { registrarAuditoria } from "@/server/auditoria";
import { montarEntrada } from "./entrada";

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

async function gravarSugerida(
  resultado: ResultadoSequenciamento,
  dados: { agora: number; horizonteFim: number; origem: "completa" | "arraste" | "desafixar"; descricao: string; baseId: string | null; usuarioId: string },
) {
  return db.transaction(async (tx) => {
    // Só uma simulação aberta por vez: a anterior é descartada (fica no histórico).
    await tx
      .update(programacoes)
      .set({ status: "descartada", decididoEm: new Date(), decididoPor: dados.usuarioId })
      .where(eq(programacoes.status, "sugerida"));

    const [prog] = await tx
      .insert(programacoes)
      .values({
        status: "sugerida",
        origem: dados.origem,
        descricao: dados.descricao,
        baseId: dados.baseId,
        agora: new Date(dados.agora),
        horizonteFim: new Date(dados.horizonteFim),
        fixacoes: resultado.fixacoesAplicadas,
        metricas: resultado.metricas,
        resumoOrdens: resultado.ordens,
        geradoPor: dados.usuarioId,
      })
      .returning({ id: programacoes.id, numero: programacoes.numero });

    if (resultado.itens.length) {
      await tx.insert(programacaoItens).values(
        resultado.itens.map((i) => ({
          programacaoId: prog.id,
          operacaoId: i.operacaoId,
          ordemId: i.ordemId,
          recursoId: i.recursoId,
          inicio: new Date(i.inicio),
          fim: new Date(i.fim),
          setupMin: i.setupMin,
          segmentos: i.segmentos,
          fixada: i.fixada,
          emExecucao: i.emExecucao,
          justificativa: i.justificativa,
        })),
      );
    }
    if (resultado.conflitos.length) {
      await tx.insert(programacaoConflitos).values(
        resultado.conflitos.map((c) => ({
          programacaoId: prog.id,
          ordemId: c.ordemId || null,
          operacaoId: c.operacaoId,
          tipo: c.tipo,
          mensagem: c.mensagem,
        })),
      );
    }
    await registrarAuditoria(tx, {
      entidade: "programacao",
      entidadeId: prog.id,
      acao: dados.origem === "completa" ? "gerar" : dados.origem,
      resumo: `Programação nº ${prog.numero} gerada: ${dados.descricao}`,
      usuarioId: dados.usuarioId,
      detalhes: { metricas: resultado.metricas, conflitos: resultado.conflitos.length },
    });
    return prog;
  });
}

export async function programacaoAprovada() {
  const [p] = await db.select().from(programacoes).where(eq(programacoes.status, "aprovada")).limit(1);
  return p ?? null;
}

async function itensDe(programacaoId: string): Promise<ItemProgramado[]> {
  const linhas = await db.select().from(programacaoItens).where(eq(programacaoItens.programacaoId, programacaoId));
  return linhas.map((l) => ({
    operacaoId: l.operacaoId,
    ordemId: l.ordemId,
    recursoId: l.recursoId,
    inicio: l.inicio.getTime(),
    fim: l.fim.getTime(),
    setupMin: l.setupMin,
    segmentos: l.segmentos,
    fixada: l.fixada,
    emExecucao: l.emExecucao,
    justificativa: l.justificativa,
  }));
}

// Programação completa a partir do estado atual (datas fixadas aprovadas continuam valendo).
export async function gerarProgramacao(usuarioId: string): Promise<Resultado<{ programacaoId: string }>> {
  const entrada = await montarEntrada();
  if (entrada.ordens.length === 0) return { ok: false, erro: "Não há OPs liberadas para programar. Libere ao menos uma OP." };
  if (entrada.recursos.length === 0) return { ok: false, erro: "Não há recursos ativos cadastrados." };
  const resultado = sequenciar(entrada);
  const aprovada = await programacaoAprovada();
  const prog = await gravarSugerida(resultado, {
    agora: entrada.agora,
    horizonteFim: entrada.horizonteFim,
    origem: "completa",
    descricao: `Programação completa de ${entrada.ordens.length} OP(s)`,
    baseId: aprovada?.id ?? null,
    usuarioId,
  });
  return { ok: true, programacaoId: prog.id };
}

async function carregarBase(programacaoId: string) {
  const [base] = await db.select().from(programacoes).where(eq(programacoes.id, programacaoId)).limit(1);
  if (!base) return null;
  if (base.status !== "aprovada" && base.status !== "sugerida") return null;
  return base;
}

export async function arrastar(
  cmd: { programacaoId: string; operacaoId: string; modo: ModoArraste; novoInicio: number; recursoId: string | null },
  usuarioId: string,
): Promise<Resultado<{ programacaoId: string }>> {
  const base = await carregarBase(cmd.programacaoId);
  if (!base) return { ok: false, erro: "Esta versão da programação não está mais aberta. Atualize a página." };

  const entrada = await montarEntrada({ fixacoes: base.fixacoes });
  const ordem = entrada.ordens.find((o) => o.operacoes.some((op) => op.id === cmd.operacaoId));
  if (!ordem) return { ok: false, erro: "A OP desta operação não está mais liberada para programação." };
  const nomes = new Map(
    (await db.select({ id: recursos.id, nome: recursos.nome }).from(recursos)).map((r) => [r.id, r.nome]),
  );

  const r = aplicarArraste(
    { modo: cmd.modo, operacaoId: cmd.operacaoId, novoInicio: cmd.novoInicio, recursoId: cmd.recursoId },
    {
      agora: entrada.agora,
      fuso: entrada.fuso,
      ordem,
      itensBase: await itensDe(base.id),
      fixacoesAtuais: base.fixacoes,
      nomeRecurso: (id) => nomes.get(id) ?? "Recurso",
    },
  );
  if (!r.ok) return r;

  const resultado = sequenciar({ ...entrada, fixacoes: r.fixacoes });
  const prog = await gravarSugerida(resultado, {
    agora: entrada.agora,
    horizonteFim: entrada.horizonteFim,
    origem: "arraste",
    descricao: r.descricao,
    baseId: base.id,
    usuarioId,
  });
  return { ok: true, programacaoId: prog.id };
}

export async function desafixarOperacoes(
  cmd: { programacaoId: string; operacaoIds: string[]; descricao: string },
  usuarioId: string,
): Promise<Resultado<{ programacaoId: string }>> {
  const base = await carregarBase(cmd.programacaoId);
  if (!base) return { ok: false, erro: "Esta versão da programação não está mais aberta. Atualize a página." };
  const fixacoes = desafixar(base.fixacoes, cmd.operacaoIds);
  if (fixacoes.length === base.fixacoes.length) return { ok: false, erro: "Esta operação não tem data fixada." };
  const entrada = await montarEntrada({ fixacoes });
  const resultado = sequenciar(entrada);
  const prog = await gravarSugerida(resultado, {
    agora: entrada.agora,
    horizonteFim: entrada.horizonteFim,
    origem: "desafixar",
    descricao: cmd.descricao,
    baseId: base.id,
    usuarioId,
  });
  return { ok: true, programacaoId: prog.id };
}

// Aprova uma programação sugerida: a anterior vira "substituída" e as datas fixadas passam a valer.
export async function aprovar(programacaoId: string, usuarioId: string): Promise<Resultado> {
  return db.transaction(async (tx) => {
    const [prog] = await tx.select().from(programacoes).where(eq(programacoes.id, programacaoId)).for("update");
    if (!prog) return { ok: false as const, erro: "Programação não encontrada." };
    if (prog.status !== "sugerida") return { ok: false as const, erro: "Só uma programação sugerida pode ser aprovada." };

    await tx
      .update(programacoes)
      .set({ status: "substituida", decididoEm: new Date(), decididoPor: usuarioId })
      .where(eq(programacoes.status, "aprovada"));
    await tx.update(programacoes).set({ status: "aprovada", decididoEm: new Date(), decididoPor: usuarioId }).where(eq(programacoes.id, prog.id));

    // Datas fixadas: valem as da versão aprovada (as que não estão nela são desfeitas).
    const ativas = tx.select({ id: ordensProducao.id }).from(ordensProducao).where(inArray(ordensProducao.status, ["liberada", "em_execucao"]));
    await tx
      .update(operacoesOrdem)
      .set({ fixadaInicio: null, fixadaRecursoId: null })
      .where(and(inArray(operacoesOrdem.ordemId, ativas), ne(operacoesOrdem.status, "concluida")));
    for (const f of prog.fixacoes as Fixacao[]) {
      await tx
        .update(operacoesOrdem)
        .set({ fixadaInicio: new Date(f.inicio), fixadaRecursoId: f.recursoId ?? null })
        .where(and(eq(operacoesOrdem.id, f.operacaoId), eq(operacoesOrdem.status, "pendente")));
    }
    await registrarAuditoria(tx, {
      entidade: "programacao",
      entidadeId: prog.id,
      acao: "aprovar",
      resumo: `Programação nº ${prog.numero} aprovada: ${prog.descricao}`,
      usuarioId,
    });
    return { ok: true as const };
  });
}

export async function descartar(programacaoId: string, usuarioId: string): Promise<Resultado> {
  const [prog] = await db
    .update(programacoes)
    .set({ status: "descartada", decididoEm: new Date(), decididoPor: usuarioId })
    .where(and(eq(programacoes.id, programacaoId), eq(programacoes.status, "sugerida")))
    .returning({ numero: programacoes.numero, descricao: programacoes.descricao });
  if (!prog) return { ok: false, erro: "Só uma programação sugerida pode ser descartada." };
  await registrarAuditoria(db, {
    entidade: "programacao",
    entidadeId: programacaoId,
    acao: "descartar",
    resumo: `Programação nº ${prog.numero} descartada: ${prog.descricao}`,
    usuarioId,
  });
  return { ok: true };
}

import "server-only";
import { and, asc, eq, inArray, ne, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  apontamentos,
  eventosExecucao,
  grupoRecursoMembros,
  motivosParada,
  operacoesOrdem,
  operadores,
  ordemHistorico,
  ordensProducao,
  programacaoItens,
  recursos,
} from "@/db/schema";
import { validarEvento, type TipoEvento } from "@/domain/mes/execucao";

const registrado: Record<TipoEvento, string> = {
  inicio: "Início registrado",
  pausa: "Pausa registrada",
  retomada: "Retomada registrada",
  fim: "Finalização registrada",
};
import { statusPelasOperacoes } from "@/domain/ordens/status";
import { programacaoAprovada, type Resultado } from "@/server/aps/programacoes";

export type ComandoEvento = {
  operacaoId: string;
  recursoId: string;
  operadorId: string;
  tipo: TipoEvento;
  motivoParadaId?: string | null;
  observacao?: string | null;
  quantidades?: { boa: number; rejeitada: number } | null;
  confirmarExcedente?: boolean;
  chaveIdempotencia: string;
};

// Registra um toque do terminal. Tudo numa transação com a operação travada:
// dois toques simultâneos não geram estados impossíveis.
export async function registrarEvento(cmd: ComandoEvento, usuarioId: string): Promise<Resultado<{ mensagem: string; duplicado?: boolean }>> {
  return db.transaction(async (tx) => {
    const [repetido] = await tx
      .select({ id: eventosExecucao.id, tipo: eventosExecucao.tipo })
      .from(eventosExecucao)
      .where(eq(eventosExecucao.chaveIdempotencia, cmd.chaveIdempotencia))
      .limit(1);
    if (repetido) return { ok: true as const, duplicado: true, mensagem: `${registrado[repetido.tipo as TipoEvento]} (toque repetido ignorado).` };

    const [op] = await tx.select().from(operacoesOrdem).where(eq(operacoesOrdem.id, cmd.operacaoId)).for("update");
    if (!op) return { ok: false as const, erro: "Operação não encontrada." };
    const [ordem] = await tx.select().from(ordensProducao).where(eq(ordensProducao.id, op.ordemId)).for("update");
    if (ordem.status !== "liberada" && ordem.status !== "em_execucao") {
      return { ok: false as const, erro: `A OP ${ordem.codigo} não está liberada para produção.` };
    }
    const [operador] = await tx.select().from(operadores).where(and(eq(operadores.id, cmd.operadorId), eq(operadores.ativo, true)));
    if (!operador) return { ok: false as const, erro: "Selecione um operador ativo." };

    const [habilitado] = await tx
      .select({ id: grupoRecursoMembros.recursoId })
      .from(grupoRecursoMembros)
      .innerJoin(recursos, eq(recursos.id, grupoRecursoMembros.recursoId))
      .where(and(eq(grupoRecursoMembros.grupoId, op.grupoRecursoId), eq(grupoRecursoMembros.recursoId, cmd.recursoId), eq(recursos.ativo, true)));
    if (!habilitado) return { ok: false as const, erro: "Este recurso não está habilitado para esta operação." };
    if (op.recursoExecucaoId && op.recursoExecucaoId !== cmd.recursoId && cmd.tipo !== "inicio") {
      return { ok: false as const, erro: "Esta operação foi iniciada em outro recurso." };
    }

    if (cmd.tipo === "pausa") {
      if (!cmd.motivoParadaId) return { ok: false as const, erro: "Informe o motivo da parada." };
      const [motivo] = await tx.select().from(motivosParada).where(and(eq(motivosParada.id, cmd.motivoParadaId), eq(motivosParada.ativo, true)));
      if (!motivo) return { ok: false as const, erro: "Motivo de parada inválido." };
    }

    const irmas = await tx.select().from(operacoesOrdem).where(eq(operacoesOrdem.ordemId, op.ordemId));
    const anteriores = irmas.filter((o) => o.status !== "cancelada" && o.sequencia < op.sequencia);
    const nivel = anteriores.length ? Math.max(...anteriores.map((o) => o.sequencia)) : null;
    const anterioresPendentes = anteriores.filter((o) => o.sequencia === nivel && o.status !== "concluida").map((o) => o.nome);

    const [ocupando] = await tx
      .select({ nome: operacoesOrdem.nome, codigo: ordensProducao.codigo })
      .from(operacoesOrdem)
      .innerJoin(ordensProducao, eq(ordensProducao.id, operacoesOrdem.ordemId))
      .where(and(eq(operacoesOrdem.recursoExecucaoId, cmd.recursoId), eq(operacoesOrdem.status, "em_execucao"), ne(operacoesOrdem.id, op.id)))
      .limit(1);

    const [{ produzido }] = await tx
      .select({ produzido: sum(apontamentos.quantidadeBoa) })
      .from(apontamentos)
      .where(eq(apontamentos.operacaoId, op.id));

    const v = validarEvento({
      statusAtual: op.status,
      tipo: cmd.tipo,
      anterioresPendentes,
      ocupacaoRecurso: ocupando ? `OP ${ocupando.codigo} · ${ocupando.nome}` : null,
      motivoParadaId: cmd.motivoParadaId,
      quantidades: cmd.quantidades,
      quantidadePlanejada: ordem.quantidade,
      produzidoAntes: Number(produzido ?? 0),
      confirmarExcedente: cmd.confirmarExcedente,
    });
    if (!v.ok) return v;

    const agora = new Date();
    const [evento] = await tx
      .insert(eventosExecucao)
      .values({
        operacaoId: op.id,
        recursoId: cmd.recursoId,
        operadorId: operador.id,
        tipo: cmd.tipo,
        motivoParadaId: cmd.tipo === "pausa" ? cmd.motivoParadaId : null,
        observacao: cmd.observacao ?? null,
        ocorridoEm: agora,
        usuarioId,
        chaveIdempotencia: cmd.chaveIdempotencia,
      })
      .returning({ id: eventosExecucao.id });

    if (cmd.tipo === "fim" && cmd.quantidades) {
      await tx.insert(apontamentos).values({
        operacaoId: op.id,
        eventoId: evento.id,
        operadorId: operador.id,
        quantidadeBoa: cmd.quantidades.boa,
        quantidadeRejeitada: cmd.quantidades.rejeitada,
        ocorridoEm: agora,
      });
    }

    await tx
      .update(operacoesOrdem)
      .set({
        status: v.novoStatus,
        // A data fixada deixa de valer: a operação passou a ser comandada pela execução.
        fixadaInicio: null,
        fixadaRecursoId: null,
        ...(cmd.tipo === "inicio" ? { recursoExecucaoId: cmd.recursoId, inicioReal: agora } : {}),
        ...(cmd.tipo === "fim" ? { fimReal: agora } : {}),
      })
      .where(eq(operacoesOrdem.id, op.id));

    const statusOps = irmas.map((o) => (o.id === op.id ? v.novoStatus : o.status));
    const novoStatusOrdem = statusPelasOperacoes(ordem.status, statusOps);
    if (novoStatusOrdem !== ordem.status) {
      await tx.update(ordensProducao).set({ status: novoStatusOrdem }).where(eq(ordensProducao.id, ordem.id));
      await tx.insert(ordemHistorico).values({ ordemId: ordem.id, de: ordem.status, para: novoStatusOrdem, usuarioId, motivo: "Apontamento de produção" });
    }

    return { ok: true as const, mensagem: `${registrado[cmd.tipo]}: OP ${ordem.codigo} · ${op.nome}.` };
  });
}

// Fila de trabalho de um recurso no terminal: o que está em andamento nele e
// as próximas operações da programação aprovada.
export async function filaDoRecurso(recursoId: string) {
  const aprovada = await programacaoAprovada();
  const emAndamento = await db
    .select({ op: operacoesOrdem, ordemCodigo: ordensProducao.codigo, quantidade: ordensProducao.quantidade })
    .from(operacoesOrdem)
    .innerJoin(ordensProducao, eq(ordensProducao.id, operacoesOrdem.ordemId))
    .where(and(eq(operacoesOrdem.recursoExecucaoId, recursoId), inArray(operacoesOrdem.status, ["em_execucao", "pausada"])));

  const proximas = aprovada
    ? await db
        .select({
          op: operacoesOrdem,
          ordemCodigo: ordensProducao.codigo,
          quantidade: ordensProducao.quantidade,
          inicio: programacaoItens.inicio,
          fim: programacaoItens.fim,
        })
        .from(programacaoItens)
        .innerJoin(operacoesOrdem, eq(operacoesOrdem.id, programacaoItens.operacaoId))
        .innerJoin(ordensProducao, eq(ordensProducao.id, operacoesOrdem.ordemId))
        .where(
          and(
            eq(programacaoItens.programacaoId, aprovada.id),
            eq(programacaoItens.recursoId, recursoId),
            eq(operacoesOrdem.status, "pendente"),
            inArray(ordensProducao.status, ["liberada", "em_execucao"]),
          ),
        )
        .orderBy(asc(programacaoItens.inicio))
        .limit(10)
    : [];

  // Quais das próximas já podem começar (operações anteriores concluídas).
  const ordemIds = [...new Set(proximas.map((p) => p.op.ordemId))];
  const irmas = ordemIds.length ? await db.select().from(operacoesOrdem).where(inArray(operacoesOrdem.ordemId, ordemIds)) : [];
  const bloqueio = (op: typeof operacoesOrdem.$inferSelect) => {
    const anteriores = irmas.filter((o) => o.ordemId === op.ordemId && o.status !== "cancelada" && o.sequencia < op.sequencia);
    if (!anteriores.length) return null;
    const nivel = Math.max(...anteriores.map((o) => o.sequencia));
    const faltam = anteriores.filter((o) => o.sequencia === nivel && o.status !== "concluida").map((o) => o.nome);
    return faltam.length ? `Aguardando: ${faltam.join(", ")}` : null;
  };

  return {
    temProgramacao: !!aprovada,
    emAndamento: emAndamento.map((e) => ({ ...e.op, ordemCodigo: e.ordemCodigo, quantidade: e.quantidade })),
    proximas: proximas.map((p) => ({ ...p.op, ordemCodigo: p.ordemCodigo, quantidade: p.quantidade, inicioPrevisto: p.inicio, fimPrevisto: p.fim, bloqueio: bloqueio(p.op) })),
  };
}

// Situação atual de cada recurso (para o terminal e o painel).
export async function situacaoRecursos() {
  const ativos = await db.select().from(recursos).where(eq(recursos.ativo, true)).orderBy(asc(recursos.codigo));
  const ocupadas = await db
    .select({ recursoId: operacoesOrdem.recursoExecucaoId, status: operacoesOrdem.status, nome: operacoesOrdem.nome, codigo: ordensProducao.codigo, id: operacoesOrdem.id })
    .from(operacoesOrdem)
    .innerJoin(ordensProducao, eq(ordensProducao.id, operacoesOrdem.ordemId))
    .where(inArray(operacoesOrdem.status, ["em_execucao", "pausada"]));
  const ultimaPausa = ocupadas.filter((o) => o.status === "pausada").map((o) => o.id);
  const pausas = ultimaPausa.length
    ? await db
        .select({ operacaoId: eventosExecucao.operacaoId, ocorridoEm: eventosExecucao.ocorridoEm, motivo: motivosParada.nome })
        .from(eventosExecucao)
        .leftJoin(motivosParada, eq(motivosParada.id, eventosExecucao.motivoParadaId))
        .where(and(inArray(eventosExecucao.operacaoId, ultimaPausa), eq(eventosExecucao.tipo, "pausa")))
        .orderBy(asc(eventosExecucao.ocorridoEm))
    : [];
  return ativos.map((r) => {
    const atual = ocupadas.find((o) => o.recursoId === r.id && o.status === "em_execucao") ?? ocupadas.find((o) => o.recursoId === r.id);
    const pausa = atual?.status === "pausada" ? pausas.filter((p) => p.operacaoId === atual.id).at(-1) : undefined;
    return {
      id: r.id,
      codigo: r.codigo,
      nome: r.nome,
      centroId: r.centroId,
      estado: !atual ? ("ocioso" as const) : atual.status === "em_execucao" ? ("produzindo" as const) : ("parado" as const),
      atual: atual ? `OP ${atual.codigo} · ${atual.nome}` : null,
      motivoParada: pausa?.motivo ?? null,
      desde: pausa?.ocorridoEm ?? null,
    };
  });
}


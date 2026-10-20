// Ordens de produção e a cópia (snapshot) do roteiro feita na liberação.
import { sql } from "drizzle-orm";
import { check, date, index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { gruposRecurso, produtos, recursos } from "./cadastros";
import { clientes } from "./clientes";
import { atualizadoEm, criadoEm, instante } from "./comum";

export const statusOrdem = pgEnum("status_ordem", ["rascunho", "liberada", "em_execucao", "concluida", "cancelada"]);

export const ordensProducao = pgTable(
  "ordens_producao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codigo: text("codigo").notNull().unique(),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtos.id, { onDelete: "restrict" }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
    pedidoVenda: text("pedido_venda"),
    quantidade: integer("quantidade").notNull(),
    prioridade: integer("prioridade").notNull().default(2), // 1 alta · 2 normal · 3 baixa
    prazoEntrega: date("prazo_entrega").notNull(),
    inicioMaisCedo: date("inicio_mais_cedo"),
    status: statusOrdem("status").notNull().default("rascunho"),
    observacoes: text("observacoes"),
    liberadaEm: instante("liberada_em"),
    criadoPor: text("criado_por").references(() => user.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check("ordem_quantidade", sql`${t.quantidade} > 0`),
    check("ordem_prioridade", sql`${t.prioridade} between 1 and 3`),
    index("ordens_status_idx").on(t.status),
  ],
);

export const statusOperacao = pgEnum("status_operacao", ["pendente", "em_execucao", "pausada", "concluida", "cancelada"]);

export const operacoesOrdem = pgTable(
  "operacoes_ordem",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ordemId: uuid("ordem_id")
      .notNull()
      .references(() => ordensProducao.id, { onDelete: "cascade" }),
    sequencia: integer("sequencia").notNull(),
    nome: text("nome").notNull(),
    grupoRecursoId: uuid("grupo_recurso_id")
      .notNull()
      .references(() => gruposRecurso.id, { onDelete: "restrict" }),
    setupMin: integer("setup_min").notNull().default(0),
    processamentoMin: integer("processamento_min").notNull(),
    status: statusOperacao("status").notNull().default("pendente"),
    // Recurso onde a operação foi iniciada no chão de fábrica.
    recursoExecucaoId: uuid("recurso_execucao_id").references(() => recursos.id, { onDelete: "set null" }),
    inicioReal: instante("inicio_real"),
    fimReal: instante("fim_real"),
    // Data fixada pelo usuário no Gantt (vale até "Desafixar"; gravada ao aprovar a programação).
    fixadaInicio: instante("fixada_inicio"),
    fixadaRecursoId: uuid("fixada_recurso_id").references(() => recursos.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    unique("operacao_ordem_nome").on(t.ordemId, t.nome),
    check("operacao_tempos", sql`${t.setupMin} >= 0 and ${t.processamentoMin} > 0`),
    index("operacoes_ordem_idx").on(t.ordemId, t.sequencia),
  ],
);

export const ordemHistorico = pgTable(
  "ordem_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ordemId: uuid("ordem_id")
      .notNull()
      .references(() => ordensProducao.id, { onDelete: "cascade" }),
    de: statusOrdem("de"),
    para: statusOrdem("para").notNull(),
    usuarioId: text("usuario_id").references(() => user.id, { onDelete: "set null" }),
    motivo: text("motivo"),
    ocorridoEm: criadoEm(),
  },
  (t) => [index("ordem_historico_idx").on(t.ordemId, t.ocorridoEm)],
);

export type OrdemProducao = typeof ordensProducao.$inferSelect;
export type OperacaoOrdem = typeof operacoesOrdem.$inferSelect;

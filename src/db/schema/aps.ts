// Versões de programação (APS). Gerar uma nova nunca apaga as anteriores.
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Intervalo } from "@/domain/calendario";
import type { Fixacao, Metricas, ResumoOrdem } from "@/domain/aps/tipos";
import { user } from "./auth";
import { recursos } from "./cadastros";
import { criadoEm, instante } from "./comum";
import { operacoesOrdem, ordensProducao } from "./ordens";

export const statusProgramacao = pgEnum("status_programacao", ["sugerida", "aprovada", "substituida", "descartada"]);
export const origemProgramacao = pgEnum("origem_programacao", ["completa", "arraste", "desafixar"]);

export const programacoes = pgTable(
  "programacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numero: serial("numero").notNull().unique(),
    status: statusProgramacao("status").notNull().default("sugerida"),
    origem: origemProgramacao("origem").notNull().default("completa"),
    descricao: text("descricao").notNull(),
    // Versão de onde esta partiu (para o antes × depois).
    baseId: uuid("base_id"),
    regra: text("regra").notNull().default("prioridade_entrega"),
    agora: instante("agora").notNull(),
    horizonteFim: instante("horizonte_fim").notNull(),
    fixacoes: jsonb("fixacoes").$type<Fixacao[]>().notNull().default([]),
    metricas: jsonb("metricas").$type<Metricas>().notNull(),
    resumoOrdens: jsonb("resumo_ordens").$type<ResumoOrdem[]>().notNull(),
    geradoPor: text("gerado_por").references(() => user.id, { onDelete: "set null" }),
    geradoEm: criadoEm(),
    decididoPor: text("decidido_por").references(() => user.id, { onDelete: "set null" }),
    decididoEm: instante("decidido_em"),
  },
  (t) => [
    // Só uma programação aprovada vigente.
    uniqueIndex("programacao_aprovada_unica").on(t.status).where(sql`${t.status} = 'aprovada'`),
    index("programacoes_status_idx").on(t.status, t.geradoEm),
  ],
);

export const programacaoItens = pgTable(
  "programacao_itens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programacaoId: uuid("programacao_id")
      .notNull()
      .references(() => programacoes.id, { onDelete: "cascade" }),
    operacaoId: uuid("operacao_id")
      .notNull()
      .references(() => operacoesOrdem.id, { onDelete: "cascade" }),
    ordemId: uuid("ordem_id")
      .notNull()
      .references(() => ordensProducao.id, { onDelete: "cascade" }),
    recursoId: uuid("recurso_id")
      .notNull()
      .references(() => recursos.id, { onDelete: "restrict" }),
    inicio: instante("inicio").notNull(),
    fim: instante("fim").notNull(),
    setupMin: integer("setup_min").notNull().default(0),
    segmentos: jsonb("segmentos").$type<Intervalo[]>().notNull(),
    fixada: boolean("fixada").notNull().default(false),
    emExecucao: boolean("em_execucao").notNull().default(false),
    justificativa: text("justificativa").notNull(),
  },
  (t) => [index("programacao_itens_idx").on(t.programacaoId, t.recursoId, t.inicio)],
);

export const programacaoConflitos = pgTable(
  "programacao_conflitos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programacaoId: uuid("programacao_id")
      .notNull()
      .references(() => programacoes.id, { onDelete: "cascade" }),
    ordemId: uuid("ordem_id").references(() => ordensProducao.id, { onDelete: "cascade" }),
    operacaoId: uuid("operacao_id").references(() => operacoesOrdem.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    mensagem: text("mensagem").notNull(),
  },
  (t) => [index("programacao_conflitos_idx").on(t.programacaoId)],
);

export type Programacao = typeof programacoes.$inferSelect;
export type ProgramacaoItem = typeof programacaoItens.$inferSelect;

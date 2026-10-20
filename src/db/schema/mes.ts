// Execução (MES): eventos imutáveis e apontamentos de quantidade.
// Correção = novo registro; nunca UPDATE/DELETE em evento produtivo.
import { sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { motivosParada, operadores, recursos } from "./cadastros";
import { criadoEm, instante } from "./comum";
import { operacoesOrdem } from "./ordens";

export const tipoEvento = pgEnum("tipo_evento_execucao", ["inicio", "pausa", "retomada", "fim"]);

export const eventosExecucao = pgTable(
  "eventos_execucao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operacaoId: uuid("operacao_id")
      .notNull()
      .references(() => operacoesOrdem.id, { onDelete: "restrict" }),
    recursoId: uuid("recurso_id")
      .notNull()
      .references(() => recursos.id, { onDelete: "restrict" }),
    operadorId: uuid("operador_id")
      .notNull()
      .references(() => operadores.id, { onDelete: "restrict" }),
    tipo: tipoEvento("tipo").notNull(),
    motivoParadaId: uuid("motivo_parada_id").references(() => motivosParada.id, { onDelete: "restrict" }),
    observacao: text("observacao"),
    ocorridoEm: instante("ocorrido_em").notNull(), // relógio do servidor no momento do toque
    registradoEm: criadoEm(),
    usuarioId: text("usuario_id").references(() => user.id, { onDelete: "set null" }),
    // Gerada pelo terminal a cada toque: reenvio ou toque duplo não duplicam o evento.
    chaveIdempotencia: text("chave_idempotencia").notNull().unique(),
  },
  (t) => [index("eventos_operacao_idx").on(t.operacaoId, t.ocorridoEm), index("eventos_recurso_idx").on(t.recursoId, t.ocorridoEm)],
);

export const apontamentos = pgTable(
  "apontamentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operacaoId: uuid("operacao_id")
      .notNull()
      .references(() => operacoesOrdem.id, { onDelete: "restrict" }),
    eventoId: uuid("evento_id").references(() => eventosExecucao.id, { onDelete: "restrict" }),
    operadorId: uuid("operador_id")
      .notNull()
      .references(() => operadores.id, { onDelete: "restrict" }),
    quantidadeBoa: integer("quantidade_boa").notNull(),
    quantidadeRejeitada: integer("quantidade_rejeitada").notNull(),
    ocorridoEm: instante("ocorrido_em").notNull(),
    registradoEm: criadoEm(),
  },
  (t) => [
    check("apontamento_quantidades", sql`${t.quantidadeBoa} >= 0 and ${t.quantidadeRejeitada} >= 0`),
    index("apontamentos_operacao_idx").on(t.operacaoId),
  ],
);

export type EventoExecucao = typeof eventosExecucao.$inferSelect;

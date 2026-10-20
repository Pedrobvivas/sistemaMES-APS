// Auditoria e configurações gerais.
import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { criadoEm } from "./comum";

export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id"),
    acao: text("acao").notNull(),
    resumo: text("resumo").notNull(),
    dados: jsonb("dados"),
    usuarioId: text("usuario_id").references(() => user.id, { onDelete: "set null" }),
    ocorridoEm: criadoEm(),
  },
  (t) => [index("auditoria_entidade_idx").on(t.entidade, t.entidadeId), index("auditoria_data_idx").on(t.ocorridoEm)],
);

// Chave/valor simples. Ex.: "dados_demonstracao" = true quando os dados vieram da carga de demonstração.
export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: jsonb("valor").notNull(),
  atualizadoEm: criadoEm(),
});

// Tabela de exemplo. Use como molde para as tabelas de cada sistema:
// copie, renomeie e ajuste os campos.
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const statusCliente = pgEnum("status_cliente", ["ativo", "inativo"]);

export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  email: text("email"),
  telefone: text("telefone"),
  observacoes: text("observacoes"),
  status: statusCliente("status").notNull().default("ativo"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Cliente = typeof clientes.$inferSelect;
export type NovoCliente = typeof clientes.$inferInsert;

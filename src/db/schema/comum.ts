import { timestamp } from "drizzle-orm/pg-core";

// Instantes sempre com fuso (timestamptz). Turnos noturnos e relatórios dependem disso.
export const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: "date" });

export const criadoEm = () => instante("criado_em").notNull().defaultNow();
export const atualizadoEm = () =>
  instante("atualizado_em")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

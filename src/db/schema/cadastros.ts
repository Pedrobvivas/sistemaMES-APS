// Cadastros industriais: centros, recursos, turnos, calendário, produtos, roteiros, motivos e operadores.
import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgEnum, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm, instante } from "./comum";

export const centrosTrabalho = pgTable("centros_trabalho", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  ordem: integer("ordem").notNull().default(0), // posição no Gantt
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const turnos = pgTable("turnos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

// Períodos de trabalho do turno. fim_min pode passar de 1440 (vira a noite).
export const turnoPeriodos = pgTable(
  "turno_periodos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    turnoId: uuid("turno_id")
      .notNull()
      .references(() => turnos.id, { onDelete: "cascade" }),
    diaSemana: integer("dia_semana").notNull(),
    inicioMin: integer("inicio_min").notNull(),
    fimMin: integer("fim_min").notNull(),
  },
  (t) => [
    check("periodo_valido", sql`${t.diaSemana} between 0 and 6 and ${t.inicioMin} >= 0 and ${t.fimMin} > ${t.inicioMin} and ${t.fimMin} <= 2880`),
    index("turno_periodos_turno_idx").on(t.turnoId),
  ],
);

export const feriados = pgTable("feriados", {
  data: date("data").primaryKey(),
  descricao: text("descricao").notNull(),
  criadoEm: criadoEm(),
});

export const tipoRecurso = pgEnum("tipo_recurso", ["maquina", "posto", "pessoa"]);

export const recursos = pgTable(
  "recursos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codigo: text("codigo").notNull().unique(),
    nome: text("nome").notNull(),
    tipo: tipoRecurso("tipo").notNull().default("posto"),
    centroId: uuid("centro_id")
      .notNull()
      .references(() => centrosTrabalho.id, { onDelete: "restrict" }),
    turnoId: uuid("turno_id").references(() => turnos.id, { onDelete: "set null" }),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("recursos_centro_idx").on(t.centroId)],
);

// Grupo = conjunto de recursos que podem executar uma operação (recursos alternativos).
export const gruposRecurso = pgTable("grupos_recurso", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const grupoRecursoMembros = pgTable(
  "grupo_recurso_membros",
  {
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => gruposRecurso.id, { onDelete: "cascade" }),
    recursoId: uuid("recurso_id")
      .notNull()
      .references(() => recursos.id, { onDelete: "cascade" }),
    preferencia: integer("preferencia").notNull().default(1), // 1 = preferido
  },
  (t) => [primaryKey({ columns: [t.grupoId, t.recursoId] })],
);

export const tipoIndisponibilidade = pgEnum("tipo_indisponibilidade", ["planejada", "nao_planejada"]);

export const indisponibilidades = pgTable(
  "indisponibilidades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recursoId: uuid("recurso_id")
      .notNull()
      .references(() => recursos.id, { onDelete: "cascade" }),
    inicio: instante("inicio").notNull(),
    fim: instante("fim").notNull(),
    tipo: tipoIndisponibilidade("tipo").notNull().default("planejada"),
    motivo: text("motivo").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [check("indisponibilidade_valida", sql`${t.fim} > ${t.inicio}`), index("indisponibilidades_recurso_idx").on(t.recursoId, t.inicio)],
);

export const produtos = pgTable("produtos", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  unidade: text("unidade").notNull().default("un"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

// Roteiro do produto. A OP guarda uma cópia na liberação; mudar aqui não altera OPs já liberadas.
export const roteiroOperacoes = pgTable(
  "roteiro_operacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtos.id, { onDelete: "cascade" }),
    sequencia: integer("sequencia").notNull(), // mesma sequência = em paralelo
    nome: text("nome").notNull(),
    grupoRecursoId: uuid("grupo_recurso_id")
      .notNull()
      .references(() => gruposRecurso.id, { onDelete: "restrict" }),
    setupMin: integer("setup_min").notNull().default(0),
    tempoFixoMin: numeric("tempo_fixo_min", { precision: 10, scale: 2 }).notNull().default("0"),
    tempoPorUnidadeMin: numeric("tempo_por_unidade_min", { precision: 10, scale: 2 }).notNull().default("0"),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    unique("roteiro_operacao_nome").on(t.produtoId, t.nome),
    check("roteiro_tempos", sql`${t.setupMin} >= 0 and ${t.tempoFixoMin} >= 0 and ${t.tempoPorUnidadeMin} >= 0`),
  ],
);

export const categoriaParada = pgEnum("categoria_parada", ["planejada", "nao_planejada"]);

export const motivosParada = pgTable("motivos_parada", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  categoria: categoriaParada("categoria").notNull().default("nao_planejada"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
});

export const operadores = pgTable("operadores", {
  id: uuid("id").primaryKey().defaultRandom(),
  matricula: text("matricula").notNull().unique(),
  nome: text("nome").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export type CentroTrabalho = typeof centrosTrabalho.$inferSelect;
export type Recurso = typeof recursos.$inferSelect;
export type Turno = typeof turnos.$inferSelect;
export type TurnoPeriodo = typeof turnoPeriodos.$inferSelect;
export type Produto = typeof produtos.$inferSelect;
export type RoteiroOperacao = typeof roteiroOperacoes.$inferSelect;
export type GrupoRecurso = typeof gruposRecurso.$inferSelect;
export type MotivoParada = typeof motivosParada.$inferSelect;
export type Operador = typeof operadores.$inferSelect;
export type Indisponibilidade = typeof indisponibilidades.$inferSelect;

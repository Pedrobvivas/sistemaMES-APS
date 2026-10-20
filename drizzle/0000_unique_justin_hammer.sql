CREATE TYPE "public"."status_cliente" AS ENUM('ativo', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."categoria_parada" AS ENUM('planejada', 'nao_planejada');--> statement-breakpoint
CREATE TYPE "public"."tipo_indisponibilidade" AS ENUM('planejada', 'nao_planejada');--> statement-breakpoint
CREATE TYPE "public"."tipo_recurso" AS ENUM('maquina', 'posto', 'pessoa');--> statement-breakpoint
CREATE TYPE "public"."status_operacao" AS ENUM('pendente', 'em_execucao', 'pausada', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_ordem" AS ENUM('rascunho', 'liberada', 'em_execucao', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."origem_programacao" AS ENUM('completa', 'arraste', 'desafixar');--> statement-breakpoint
CREATE TYPE "public"."status_programacao" AS ENUM('sugerida', 'aprovada', 'substituida', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento_execucao" AS ENUM('inicio', 'pausa', 'retomada', 'fim');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"observacoes" text,
	"status" "status_cliente" DEFAULT 'ativo' NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "centros_trabalho" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "centros_trabalho_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "feriados" (
	"data" date PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grupo_recurso_membros" (
	"grupo_id" uuid NOT NULL,
	"recurso_id" uuid NOT NULL,
	"preferencia" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "grupo_recurso_membros_grupo_id_recurso_id_pk" PRIMARY KEY("grupo_id","recurso_id")
);
--> statement-breakpoint
CREATE TABLE "grupos_recurso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grupos_recurso_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "indisponibilidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurso_id" uuid NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone NOT NULL,
	"tipo" "tipo_indisponibilidade" DEFAULT 'planejada' NOT NULL,
	"motivo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indisponibilidade_valida" CHECK ("indisponibilidades"."fim" > "indisponibilidades"."inicio")
);
--> statement-breakpoint
CREATE TABLE "motivos_parada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"categoria" "categoria_parada" DEFAULT 'nao_planejada' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "motivos_parada_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "operadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matricula" text NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operadores_matricula_unique" UNIQUE("matricula")
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"unidade" text DEFAULT 'un' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produtos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "recursos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_recurso" DEFAULT 'posto' NOT NULL,
	"centro_id" uuid NOT NULL,
	"turno_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recursos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "roteiro_operacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"sequencia" integer NOT NULL,
	"nome" text NOT NULL,
	"grupo_recurso_id" uuid NOT NULL,
	"setup_min" integer DEFAULT 0 NOT NULL,
	"tempo_fixo_min" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tempo_por_unidade_min" numeric(10, 2) DEFAULT '0' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roteiro_operacao_nome" UNIQUE("produto_id","nome"),
	CONSTRAINT "roteiro_tempos" CHECK ("roteiro_operacoes"."setup_min" >= 0 and "roteiro_operacoes"."tempo_fixo_min" >= 0 and "roteiro_operacoes"."tempo_por_unidade_min" >= 0)
);
--> statement-breakpoint
CREATE TABLE "turno_periodos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turno_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"inicio_min" integer NOT NULL,
	"fim_min" integer NOT NULL,
	CONSTRAINT "periodo_valido" CHECK ("turno_periodos"."dia_semana" between 0 and 6 and "turno_periodos"."inicio_min" >= 0 and "turno_periodos"."fim_min" > "turno_periodos"."inicio_min" and "turno_periodos"."fim_min" <= 2880)
);
--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turnos_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "operacoes_ordem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ordem_id" uuid NOT NULL,
	"sequencia" integer NOT NULL,
	"nome" text NOT NULL,
	"grupo_recurso_id" uuid NOT NULL,
	"setup_min" integer DEFAULT 0 NOT NULL,
	"processamento_min" integer NOT NULL,
	"status" "status_operacao" DEFAULT 'pendente' NOT NULL,
	"recurso_execucao_id" uuid,
	"inicio_real" timestamp with time zone,
	"fim_real" timestamp with time zone,
	"fixada_inicio" timestamp with time zone,
	"fixada_recurso_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operacao_ordem_nome" UNIQUE("ordem_id","nome"),
	CONSTRAINT "operacao_tempos" CHECK ("operacoes_ordem"."setup_min" >= 0 and "operacoes_ordem"."processamento_min" > 0)
);
--> statement-breakpoint
CREATE TABLE "ordem_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ordem_id" uuid NOT NULL,
	"de" "status_ordem",
	"para" "status_ordem" NOT NULL,
	"usuario_id" text,
	"motivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordens_producao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"produto_id" uuid NOT NULL,
	"cliente_id" uuid,
	"pedido_venda" text,
	"quantidade" integer NOT NULL,
	"prioridade" integer DEFAULT 2 NOT NULL,
	"prazo_entrega" date NOT NULL,
	"inicio_mais_cedo" date,
	"status" "status_ordem" DEFAULT 'rascunho' NOT NULL,
	"observacoes" text,
	"liberada_em" timestamp with time zone,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordens_producao_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "ordem_quantidade" CHECK ("ordens_producao"."quantidade" > 0),
	CONSTRAINT "ordem_prioridade" CHECK ("ordens_producao"."prioridade" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "programacao_conflitos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programacao_id" uuid NOT NULL,
	"ordem_id" uuid,
	"operacao_id" uuid,
	"tipo" text NOT NULL,
	"mensagem" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programacao_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programacao_id" uuid NOT NULL,
	"operacao_id" uuid NOT NULL,
	"ordem_id" uuid NOT NULL,
	"recurso_id" uuid NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone NOT NULL,
	"setup_min" integer DEFAULT 0 NOT NULL,
	"segmentos" jsonb NOT NULL,
	"fixada" boolean DEFAULT false NOT NULL,
	"em_execucao" boolean DEFAULT false NOT NULL,
	"justificativa" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" serial NOT NULL,
	"status" "status_programacao" DEFAULT 'sugerida' NOT NULL,
	"origem" "origem_programacao" DEFAULT 'completa' NOT NULL,
	"descricao" text NOT NULL,
	"base_id" uuid,
	"regra" text DEFAULT 'prioridade_entrega' NOT NULL,
	"agora" timestamp with time zone NOT NULL,
	"horizonte_fim" timestamp with time zone NOT NULL,
	"fixacoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metricas" jsonb NOT NULL,
	"resumo_ordens" jsonb NOT NULL,
	"gerado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"decidido_por" text,
	"decidido_em" timestamp with time zone,
	CONSTRAINT "programacoes_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "apontamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operacao_id" uuid NOT NULL,
	"evento_id" uuid,
	"operador_id" uuid NOT NULL,
	"quantidade_boa" integer NOT NULL,
	"quantidade_rejeitada" integer NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apontamento_quantidades" CHECK ("apontamentos"."quantidade_boa" >= 0 and "apontamentos"."quantidade_rejeitada" >= 0)
);
--> statement-breakpoint
CREATE TABLE "eventos_execucao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operacao_id" uuid NOT NULL,
	"recurso_id" uuid NOT NULL,
	"operador_id" uuid NOT NULL,
	"tipo" "tipo_evento_execucao" NOT NULL,
	"motivo_parada_id" uuid,
	"observacao" text,
	"ocorrido_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" text,
	"chave_idempotencia" text NOT NULL,
	CONSTRAINT "eventos_execucao_chave_idempotencia_unique" UNIQUE("chave_idempotencia")
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"acao" text NOT NULL,
	"resumo" text NOT NULL,
	"dados" jsonb,
	"usuario_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_recurso_membros" ADD CONSTRAINT "grupo_recurso_membros_grupo_id_grupos_recurso_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos_recurso"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_recurso_membros" ADD CONSTRAINT "grupo_recurso_membros_recurso_id_recursos_id_fk" FOREIGN KEY ("recurso_id") REFERENCES "public"."recursos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indisponibilidades" ADD CONSTRAINT "indisponibilidades_recurso_id_recursos_id_fk" FOREIGN KEY ("recurso_id") REFERENCES "public"."recursos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_centro_id_centros_trabalho_id_fk" FOREIGN KEY ("centro_id") REFERENCES "public"."centros_trabalho"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_operacoes" ADD CONSTRAINT "roteiro_operacoes_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_operacoes" ADD CONSTRAINT "roteiro_operacoes_grupo_recurso_id_grupos_recurso_id_fk" FOREIGN KEY ("grupo_recurso_id") REFERENCES "public"."grupos_recurso"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_periodos" ADD CONSTRAINT "turno_periodos_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes_ordem" ADD CONSTRAINT "operacoes_ordem_ordem_id_ordens_producao_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."ordens_producao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes_ordem" ADD CONSTRAINT "operacoes_ordem_grupo_recurso_id_grupos_recurso_id_fk" FOREIGN KEY ("grupo_recurso_id") REFERENCES "public"."grupos_recurso"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes_ordem" ADD CONSTRAINT "operacoes_ordem_recurso_execucao_id_recursos_id_fk" FOREIGN KEY ("recurso_execucao_id") REFERENCES "public"."recursos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes_ordem" ADD CONSTRAINT "operacoes_ordem_fixada_recurso_id_recursos_id_fk" FOREIGN KEY ("fixada_recurso_id") REFERENCES "public"."recursos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_historico" ADD CONSTRAINT "ordem_historico_ordem_id_ordens_producao_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."ordens_producao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_historico" ADD CONSTRAINT "ordem_historico_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacao_conflitos" ADD CONSTRAINT "programacao_conflitos_programacao_id_programacoes_id_fk" FOREIGN KEY ("programacao_id") REFERENCES "public"."programacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacao_conflitos" ADD CONSTRAINT "programacao_conflitos_ordem_id_ordens_producao_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."ordens_producao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacao_conflitos" ADD CONSTRAINT "programacao_conflitos_operacao_id_operacoes_ordem_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes_ordem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacao_itens" ADD CONSTRAINT "programacao_itens_programacao_id_programacoes_id_fk" FOREIGN KEY ("programacao_id") REFERENCES "public"."programacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacao_itens" ADD CONSTRAINT "programacao_itens_operacao_id_operacoes_ordem_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes_ordem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacao_itens" ADD CONSTRAINT "programacao_itens_ordem_id_ordens_producao_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."ordens_producao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacao_itens" ADD CONSTRAINT "programacao_itens_recurso_id_recursos_id_fk" FOREIGN KEY ("recurso_id") REFERENCES "public"."recursos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacoes" ADD CONSTRAINT "programacoes_gerado_por_user_id_fk" FOREIGN KEY ("gerado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacoes" ADD CONSTRAINT "programacoes_decidido_por_user_id_fk" FOREIGN KEY ("decidido_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamentos" ADD CONSTRAINT "apontamentos_operacao_id_operacoes_ordem_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes_ordem"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamentos" ADD CONSTRAINT "apontamentos_evento_id_eventos_execucao_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos_execucao"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamentos" ADD CONSTRAINT "apontamentos_operador_id_operadores_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_execucao" ADD CONSTRAINT "eventos_execucao_operacao_id_operacoes_ordem_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes_ordem"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_execucao" ADD CONSTRAINT "eventos_execucao_recurso_id_recursos_id_fk" FOREIGN KEY ("recurso_id") REFERENCES "public"."recursos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_execucao" ADD CONSTRAINT "eventos_execucao_operador_id_operadores_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_execucao" ADD CONSTRAINT "eventos_execucao_motivo_parada_id_motivos_parada_id_fk" FOREIGN KEY ("motivo_parada_id") REFERENCES "public"."motivos_parada"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_execucao" ADD CONSTRAINT "eventos_execucao_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "indisponibilidades_recurso_idx" ON "indisponibilidades" USING btree ("recurso_id","inicio");--> statement-breakpoint
CREATE INDEX "recursos_centro_idx" ON "recursos" USING btree ("centro_id");--> statement-breakpoint
CREATE INDEX "turno_periodos_turno_idx" ON "turno_periodos" USING btree ("turno_id");--> statement-breakpoint
CREATE INDEX "operacoes_ordem_idx" ON "operacoes_ordem" USING btree ("ordem_id","sequencia");--> statement-breakpoint
CREATE INDEX "ordem_historico_idx" ON "ordem_historico" USING btree ("ordem_id","criado_em");--> statement-breakpoint
CREATE INDEX "ordens_status_idx" ON "ordens_producao" USING btree ("status");--> statement-breakpoint
CREATE INDEX "programacao_conflitos_idx" ON "programacao_conflitos" USING btree ("programacao_id");--> statement-breakpoint
CREATE INDEX "programacao_itens_idx" ON "programacao_itens" USING btree ("programacao_id","recurso_id","inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "programacao_aprovada_unica" ON "programacoes" USING btree ("status") WHERE "programacoes"."status" = 'aprovada';--> statement-breakpoint
CREATE INDEX "programacoes_status_idx" ON "programacoes" USING btree ("status","criado_em");--> statement-breakpoint
CREATE INDEX "apontamentos_operacao_idx" ON "apontamentos" USING btree ("operacao_id");--> statement-breakpoint
CREATE INDEX "eventos_operacao_idx" ON "eventos_execucao" USING btree ("operacao_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "eventos_recurso_idx" ON "eventos_execucao" USING btree ("recurso_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "auditoria" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "auditoria_data_idx" ON "auditoria" USING btree ("criado_em");
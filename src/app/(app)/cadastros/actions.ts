"use server";

// Ações dos cadastros industriais: validar → permissão → gravar → auditar → revalidar.
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  centrosTrabalho,
  feriados,
  grupoRecursoMembros,
  gruposRecurso,
  indisponibilidades,
  motivosParada,
  operadores,
  produtos,
  recursos,
  roteiroOperacoes,
  turnoPeriodos,
  turnos,
} from "@/db/schema";
import { localParaInstante } from "@/domain/tempo";
import { caixa, codigo, decimal, errosZod, horaParaMinutos, inteiro, mensagemErroBanco, type EstadoForm } from "@/lib/formularios";
import { exigirPermissao } from "@/lib/session";
import { FUSO } from "@/server/aps/entrada";
import { registrarAuditoria } from "@/server/auditoria";

const dados = (fd: FormData) => Object.fromEntries(fd);

async function permissao() {
  const { user } = await exigirPermissao("cadastros:editar");
  return user.id;
}

async function concluir(caminho: string, entidade: string, entidadeId: string | null, resumo: string, usuarioId: string): Promise<never> {
  await registrarAuditoria(db, { entidade, entidadeId, acao: "salvar", resumo, usuarioId });
  revalidatePath(caminho);
  redirect(`${caminho}?salvo=1`);
}

// ---------- Centros de trabalho ----------
const esquemaCentro = z.object({
  codigo,
  nome: z.string().trim().min(2, "Informe o nome."),
  ordem: inteiro("Ordem no Gantt"),
  ativo: caixa,
});

export async function salvarCentro(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = esquemaCentro.safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  let salvoId = id;
  try {
    if (id) await db.update(centrosTrabalho).set(v.data).where(eq(centrosTrabalho.id, id));
    else [{ id: salvoId }] = await db.insert(centrosTrabalho).values(v.data).returning({ id: centrosTrabalho.id });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  return concluir("/cadastros/centros", "centro_trabalho", salvoId, `Centro ${v.data.codigo} salvo`, usuarioId);
}

// ---------- Recursos ----------
const esquemaRecurso = z.object({
  codigo,
  nome: z.string().trim().min(2, "Informe o nome."),
  tipo: z.enum(["maquina", "posto", "pessoa"], { message: "Escolha o tipo." }),
  centroId: z.string().uuid("Escolha o centro de trabalho."),
  turnoId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().uuid().nullable()),
  ativo: caixa,
});

export async function salvarRecurso(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = esquemaRecurso.safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  let salvoId = id;
  try {
    if (id) await db.update(recursos).set(v.data).where(eq(recursos.id, id));
    else [{ id: salvoId }] = await db.insert(recursos).values(v.data).returning({ id: recursos.id });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  return concluir("/cadastros/recursos", "recurso", salvoId, `Recurso ${v.data.codigo} salvo`, usuarioId);
}

// ---------- Grupos de recursos (recursos elegíveis/alternativos) ----------
const esquemaGrupo = z.object({ codigo, nome: z.string().trim().min(2, "Informe o nome.") });

export async function salvarGrupo(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = esquemaGrupo.safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  // membro-<recursoId> = "" | "1" | "2"  (não participa · preferencial · alternativo)
  const membros = [...fd.entries()]
    .filter(([k, val]) => k.startsWith("membro-") && (val === "1" || val === "2"))
    .map(([k, val]) => ({ recursoId: k.slice(7), preferencia: Number(val) }));
  if (membros.length === 0) return { erros: { geral: "Inclua ao menos um recurso no grupo." } };
  if (membros.some((m) => !z.string().uuid().safeParse(m.recursoId).success)) return { erros: { geral: "Recurso inválido." } };
  let salvoId = id;
  try {
    await db.transaction(async (tx) => {
      if (id) await tx.update(gruposRecurso).set(v.data).where(eq(gruposRecurso.id, id));
      else [{ id: salvoId }] = await tx.insert(gruposRecurso).values(v.data).returning({ id: gruposRecurso.id });
      await tx.delete(grupoRecursoMembros).where(eq(grupoRecursoMembros.grupoId, salvoId!));
      await tx.insert(grupoRecursoMembros).values(membros.map((m) => ({ ...m, grupoId: salvoId! })));
    });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  return concluir("/cadastros/grupos", "grupo_recurso", salvoId, `Grupo ${v.data.codigo} salvo com ${membros.length} recurso(s)`, usuarioId);
}

// ---------- Turnos ----------
export async function salvarTurno(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = z.object({ nome: z.string().trim().min(2, "Informe o nome."), ativo: caixa }).safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  const dias = fd.getAll("dia").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (dias.length === 0) return { erros: { dias: "Marque ao menos um dia." } };
  const periodos: { inicioMin: number; fimMin: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const ini = String(fd.get(`inicio${i}`) ?? "");
    const fim = String(fd.get(`fim${i}`) ?? "");
    if (!ini && !fim) continue;
    const a = horaParaMinutos(ini);
    let b = horaParaMinutos(fim);
    if (a === null || b === null) return { erros: { [`periodo${i}`]: "Use o formato HH:MM." } };
    if (b <= a) b += 1440; // termina no dia seguinte
    periodos.push({ inicioMin: a, fimMin: b });
  }
  if (periodos.length === 0) return { erros: { periodo1: "Informe ao menos um período de trabalho." } };
  const ordenados = [...periodos].sort((x, y) => x.inicioMin - y.inicioMin);
  if (ordenados.some((p, i) => i > 0 && p.inicioMin < ordenados[i - 1].fimMin)) return { erros: { periodo1: "Os períodos se sobrepõem." } };
  let salvoId = id;
  try {
    await db.transaction(async (tx) => {
      if (id) await tx.update(turnos).set(v.data).where(eq(turnos.id, id));
      else [{ id: salvoId }] = await tx.insert(turnos).values(v.data).returning({ id: turnos.id });
      await tx.delete(turnoPeriodos).where(eq(turnoPeriodos.turnoId, salvoId!));
      await tx.insert(turnoPeriodos).values(dias.flatMap((diaSemana) => periodos.map((p) => ({ ...p, diaSemana, turnoId: salvoId! }))));
    });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  return concluir("/cadastros/turnos", "turno", salvoId, `Turno ${v.data.nome} salvo`, usuarioId);
}

// ---------- Feriados ----------
export async function salvarFeriado(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = z
    .object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."), descricao: z.string().trim().min(2, "Informe a descrição.") })
    .safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  try {
    await db.insert(feriados).values(v.data);
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  return concluir("/cadastros/calendario", "feriado", v.data.data, `Feriado ${v.data.data} incluído`, usuarioId);
}

export async function removerFeriado(data: string) {
  const usuarioId = await permissao();
  await db.delete(feriados).where(eq(feriados.data, data));
  await registrarAuditoria(db, { entidade: "feriado", entidadeId: data, acao: "remover", resumo: `Feriado ${data} removido`, usuarioId });
  revalidatePath("/cadastros/calendario");
}

// ---------- Indisponibilidades ----------
const dataHoraLocal = (rotulo: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `Informe ${rotulo}.`)
    .transform((v) => localParaInstante(v.slice(0, 10), Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16)), FUSO));

export async function salvarIndisponibilidade(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = z
    .object({
      recursoId: z.string().uuid("Escolha o recurso."),
      inicio: dataHoraLocal("o início"),
      fim: dataHoraLocal("o fim"),
      tipo: z.enum(["planejada", "nao_planejada"]),
      motivo: z.string().trim().min(2, "Informe o motivo."),
    })
    .refine((d) => d.fim > d.inicio, { message: "O fim deve ser depois do início.", path: ["fim"] })
    .safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  const [criada] = await db
    .insert(indisponibilidades)
    .values({ ...v.data, inicio: new Date(v.data.inicio), fim: new Date(v.data.fim) })
    .returning({ id: indisponibilidades.id });
  return concluir("/cadastros/calendario", "indisponibilidade", criada.id, `Indisponibilidade incluída: ${v.data.motivo}`, usuarioId);
}

export async function removerIndisponibilidade(id: string) {
  const usuarioId = await permissao();
  if (!z.string().uuid().safeParse(id).success) return;
  await db.delete(indisponibilidades).where(eq(indisponibilidades.id, id));
  await registrarAuditoria(db, { entidade: "indisponibilidade", entidadeId: id, acao: "remover", resumo: "Indisponibilidade removida", usuarioId });
  revalidatePath("/cadastros/calendario");
}

// ---------- Motivos de parada ----------
export async function salvarMotivo(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = z
    .object({ codigo, nome: z.string().trim().min(2, "Informe o nome."), categoria: z.enum(["planejada", "nao_planejada"]), ativo: caixa })
    .safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  let salvoId = id;
  try {
    if (id) await db.update(motivosParada).set(v.data).where(eq(motivosParada.id, id));
    else [{ id: salvoId }] = await db.insert(motivosParada).values(v.data).returning({ id: motivosParada.id });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  return concluir("/cadastros/motivos", "motivo_parada", salvoId, `Motivo ${v.data.codigo} salvo`, usuarioId);
}

// ---------- Operadores ----------
export async function salvarOperador(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = z
    .object({ matricula: z.string().trim().min(1, "Informe a matrícula."), nome: z.string().trim().min(2, "Informe o nome."), ativo: caixa })
    .safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  let salvoId = id;
  try {
    if (id) await db.update(operadores).set(v.data).where(eq(operadores.id, id));
    else [{ id: salvoId }] = await db.insert(operadores).values(v.data).returning({ id: operadores.id });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  return concluir("/cadastros/operadores", "operador", salvoId, `Operador ${v.data.matricula} salvo`, usuarioId);
}

// ---------- Produtos e roteiros ----------
export async function salvarProduto(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = z
    .object({ codigo, nome: z.string().trim().min(2, "Informe o nome."), unidade: z.string().trim().min(1, "Informe a unidade."), ativo: caixa })
    .safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  let salvoId = id;
  try {
    if (id) await db.update(produtos).set(v.data).where(eq(produtos.id, id));
    else [{ id: salvoId }] = await db.insert(produtos).values(v.data).returning({ id: produtos.id });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  await registrarAuditoria(db, { entidade: "produto", entidadeId: salvoId, acao: "salvar", resumo: `Produto ${v.data.codigo} salvo`, usuarioId });
  revalidatePath("/cadastros/produtos");
  redirect(`/cadastros/produtos/${salvoId}?salvo=1`);
}

const esquemaOperacao = z.object({
  sequencia: inteiro("Sequência", 1),
  nome: z.string().trim().min(2, "Informe o nome da operação."),
  grupoRecursoId: z.string().uuid("Escolha o grupo de recursos."),
  setupMin: inteiro("Preparação"),
  tempoFixoMin: decimal("Tempo fixo"),
  tempoPorUnidadeMin: decimal("Tempo por unidade"),
});

export async function salvarOperacaoRoteiro(produtoId: string, operacaoId: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const usuarioId = await permissao();
  const v = esquemaOperacao
    .refine((d) => d.tempoFixoMin + d.tempoPorUnidadeMin > 0, { message: "Informe um tempo fixo ou por unidade.", path: ["tempoPorUnidadeMin"] })
    .safeParse(dados(fd));
  if (!v.success) return errosZod(v.error);
  const valores = { ...v.data, tempoFixoMin: String(v.data.tempoFixoMin), tempoPorUnidadeMin: String(v.data.tempoPorUnidadeMin) };
  try {
    if (operacaoId)
      await db.update(roteiroOperacoes).set(valores).where(and(eq(roteiroOperacoes.id, operacaoId), eq(roteiroOperacoes.produtoId, produtoId)));
    else await db.insert(roteiroOperacoes).values({ ...valores, produtoId });
  } catch (e) {
    return { erros: { geral: mensagemErroBanco(e) } };
  }
  await registrarAuditoria(db, {
    entidade: "roteiro",
    entidadeId: produtoId,
    acao: "salvar_operacao",
    resumo: `Operação "${v.data.nome}" salva no roteiro (OPs já liberadas não mudam)`,
    usuarioId,
  });
  revalidatePath(`/cadastros/produtos/${produtoId}`);
  redirect(`/cadastros/produtos/${produtoId}?salvo=1`);
}

export async function removerOperacaoRoteiro(produtoId: string, operacaoId: string) {
  const usuarioId = await permissao();
  await db.delete(roteiroOperacoes).where(and(eq(roteiroOperacoes.id, operacaoId), eq(roteiroOperacoes.produtoId, produtoId)));
  await registrarAuditoria(db, { entidade: "roteiro", entidadeId: produtoId, acao: "remover_operacao", resumo: "Operação removida do roteiro", usuarioId });
  revalidatePath(`/cadastros/produtos/${produtoId}`);
}

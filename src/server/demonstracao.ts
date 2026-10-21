import "server-only";
// Carga de dados de demonstração (fábrica fictícia de quadros elétricos).
// Os dados ficam marcados em `configuracoes.dados_demonstracao` e a interface mostra o selo
// "Demonstração" enquanto existirem. Nada aqui é dado real de cliente.
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  apontamentos,
  auditoria,
  centrosTrabalho,
  clientes,
  configuracoes,
  eventosExecucao,
  feriados,
  grupoRecursoMembros,
  gruposRecurso,
  indisponibilidades,
  motivosParada,
  operacoesOrdem,
  operadores,
  ordemHistorico,
  ordensProducao,
  produtos,
  programacaoConflitos,
  programacaoItens,
  programacoes,
  recursos,
  roteiroOperacoes,
  turnoPeriodos,
  turnos,
} from "@/db/schema";
import { diaDaSemanaIso, diaIsoLocal, localParaInstante, somarDias } from "@/domain/tempo";
import { aprovar, gerarProgramacao, type Resultado } from "@/server/aps/programacoes";
import { FUSO } from "@/server/aps/entrada";
import { registrarAuditoria } from "@/server/auditoria";
import { liberarOrdem } from "@/server/ordens";

const CHAVE = "dados_demonstracao";

export async function estadoDemonstracao() {
  const [flag] = await db.select().from(configuracoes).where(eq(configuracoes.chave, CHAVE)).limit(1);
  return flag ? (flag.valor as { carregadoEm: string; clientes: string[] }) : null;
}

async function baseIndustrialVazia() {
  const [[r], [o], [p]] = await Promise.all([
    db.select({ n: count() }).from(recursos),
    db.select({ n: count() }).from(ordensProducao),
    db.select({ n: count() }).from(produtos),
  ]);
  return r.n === 0 && o.n === 0 && p.n === 0;
}

// Apaga só o que a carga de demonstração criou (todo o cadastro industrial dela).
async function apagarTudo(clientesDemo: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(apontamentos);
    await tx.delete(eventosExecucao);
    await tx.delete(programacaoConflitos);
    await tx.delete(programacaoItens);
    await tx.delete(programacoes);
    await tx.delete(ordemHistorico);
    await tx.delete(operacoesOrdem);
    await tx.delete(ordensProducao);
    await tx.delete(roteiroOperacoes);
    await tx.delete(produtos);
    await tx.delete(grupoRecursoMembros);
    await tx.delete(gruposRecurso);
    await tx.delete(indisponibilidades);
    await tx.delete(recursos);
    await tx.delete(turnoPeriodos);
    await tx.delete(turnos);
    await tx.delete(centrosTrabalho);
    await tx.delete(motivosParada);
    await tx.delete(operadores);
    await tx.delete(feriados);
    if (clientesDemo.length) await tx.delete(clientes).where(inArray(clientes.id, clientesDemo));
    await tx.delete(configuracoes).where(eq(configuracoes.chave, CHAVE));
    await tx.delete(auditoria).where(inArray(auditoria.entidade, ["programacao", "ordem"]));
  });
}

export async function removerDemonstracao(usuarioId: string): Promise<Resultado> {
  const estado = await estadoDemonstracao();
  if (!estado) return { ok: false, erro: "Os dados atuais não vieram da carga de demonstração; nada foi apagado." };
  await apagarTudo(estado.clientes);
  await registrarAuditoria(db, { entidade: "sistema", acao: "remover_demonstracao", resumo: "Dados de demonstração removidos", usuarioId });
  return { ok: true };
}

function diaUtil(base: string, n: number) {
  let d = base;
  let passos = 0;
  while (passos < n) {
    d = somarDias(d, 1);
    const s = diaDaSemanaIso(d);
    if (s !== 0 && s !== 6) passos++;
  }
  return d;
}

function diaUtilAnterior(base: string) {
  let d = somarDias(base, -1);
  while ([0, 6].includes(diaDaSemanaIso(d))) d = somarDias(d, -1);
  return d;
}

const hora = (dia: string, h: number, m = 0) => new Date(localParaInstante(dia, h * 60 + m, FUSO));

export async function carregarDemonstracao(usuarioId: string): Promise<Resultado> {
  const estado = await estadoDemonstracao();
  if (estado) await apagarTudo(estado.clientes);
  else if (!(await baseIndustrialVazia())) {
    return { ok: false, erro: "Já existem cadastros industriais reais. A demonstração só pode ser carregada em uma base vazia." };
  }

  const hoje = diaIsoLocal(Date.now(), FUSO);
  const ontem = diaUtilAnterior(hoje);
  const anteontem = diaUtilAnterior(ontem);

  const ids = await db.transaction(async (tx) => {
    // Turnos e calendário
    const [comercial, doisTurnos] = await tx
      .insert(turnos)
      .values([{ nome: "Comercial (07h–17h)" }, { nome: "Dois turnos (06h–22h)" }])
      .returning();
    const uteis = [1, 2, 3, 4, 5];
    await tx.insert(turnoPeriodos).values([
      ...uteis.flatMap((d) => [
        { turnoId: comercial.id, diaSemana: d, inicioMin: 7 * 60, fimMin: 12 * 60 },
        { turnoId: comercial.id, diaSemana: d, inicioMin: 13 * 60, fimMin: 17 * 60 },
      ]),
      ...uteis.flatMap((d) => [{ turnoId: doisTurnos.id, diaSemana: d, inicioMin: 6 * 60, fimMin: 22 * 60 }]),
    ]);
    const anoAtual = Number(hoje.slice(0, 4));
    await tx
      .insert(feriados)
      .values([
        { data: `${anoAtual}-11-02`, descricao: "Finados" },
        { data: `${anoAtual}-11-15`, descricao: "Proclamação da República" },
        { data: `${anoAtual}-11-20`, descricao: "Dia da Consciência Negra" },
        { data: `${anoAtual}-12-25`, descricao: "Natal" },
        { data: `${anoAtual + 1}-01-01`, descricao: "Confraternização Universal" },
      ])
      .onConflictDoNothing();

    // Centros e recursos
    const centros = await tx
      .insert(centrosTrabalho)
      .values([
        { codigo: "CALD", nome: "Caldeiraria (corte e dobra)", ordem: 1 },
        { codigo: "PINT", nome: "Pintura", ordem: 2 },
        { codigo: "MMEC", nome: "Montagem mecânica", ordem: 3 },
        { codigo: "MELE", nome: "Montagem elétrica", ordem: 4 },
        { codigo: "TEST", nome: "Testes e inspeção", ordem: 5 },
      ])
      .returning();
    const c = Object.fromEntries(centros.map((x) => [x.codigo, x.id]));
    const lista = await tx
      .insert(recursos)
      .values([
        { codigo: "PUNC-01", nome: "Puncionadeira CNC", tipo: "maquina", centroId: c.CALD, turnoId: doisTurnos.id },
        { codigo: "DOBR-01", nome: "Dobradeira", tipo: "maquina", centroId: c.CALD, turnoId: comercial.id },
        { codigo: "CAB-PINT", nome: "Cabine de pintura", tipo: "posto", centroId: c.PINT, turnoId: comercial.id },
        { codigo: "MEC-A", nome: "Montador mecânico A", tipo: "pessoa", centroId: c.MMEC, turnoId: comercial.id },
        { codigo: "MEC-B", nome: "Montador mecânico B", tipo: "pessoa", centroId: c.MMEC, turnoId: comercial.id },
        { codigo: "ELE-A", nome: "Eletricista montador A", tipo: "pessoa", centroId: c.MELE, turnoId: comercial.id },
        { codigo: "ELE-B", nome: "Eletricista montador B", tipo: "pessoa", centroId: c.MELE, turnoId: comercial.id },
        { codigo: "ELE-C", nome: "Eletricista montador C", tipo: "pessoa", centroId: c.MELE, turnoId: comercial.id },
        { codigo: "BANC-01", nome: "Bancada de testes", tipo: "posto", centroId: c.TEST, turnoId: comercial.id },
      ])
      .returning();
    const r = Object.fromEntries(lista.map((x) => [x.codigo, x.id]));

    const grupos = await tx
      .insert(gruposRecurso)
      .values([
        { codigo: "G-PUNC", nome: "Puncionamento" },
        { codigo: "G-DOBR", nome: "Dobra" },
        { codigo: "G-PINT", nome: "Pintura" },
        { codigo: "G-MEC", nome: "Montadores mecânicos" },
        { codigo: "G-ELE", nome: "Eletricistas montadores" },
        { codigo: "G-TEST", nome: "Testes" },
      ])
      .returning();
    const g = Object.fromEntries(grupos.map((x) => [x.codigo, x.id]));
    await tx.insert(grupoRecursoMembros).values([
      { grupoId: g["G-PUNC"], recursoId: r["PUNC-01"] },
      { grupoId: g["G-DOBR"], recursoId: r["DOBR-01"] },
      { grupoId: g["G-PINT"], recursoId: r["CAB-PINT"] },
      { grupoId: g["G-MEC"], recursoId: r["MEC-A"] },
      { grupoId: g["G-MEC"], recursoId: r["MEC-B"] },
      { grupoId: g["G-ELE"], recursoId: r["ELE-A"] },
      { grupoId: g["G-ELE"], recursoId: r["ELE-B"] },
      { grupoId: g["G-ELE"], recursoId: r["ELE-C"], preferencia: 2 },
      { grupoId: g["G-TEST"], recursoId: r["BANC-01"] },
    ]);

    // Manutenção preventiva da dobradeira no segundo dia útil.
    const diaManut = diaUtil(hoje, 2);
    await tx.insert(indisponibilidades).values({
      recursoId: r["DOBR-01"],
      inicio: hora(diaManut, 7),
      fim: hora(diaManut, 11),
      tipo: "planejada",
      motivo: "Manutenção preventiva",
    });

    // Produtos e roteiros (tempos em minutos)
    const prods = await tx
      .insert(produtos)
      .values([
        { codigo: "QDC-24", nome: "Quadro de distribuição 24 circuitos" },
        { codigo: "CCM-6", nome: "Centro de controle de motores 6 gavetas" },
        { codigo: "CAB-MED", nome: "Cabine de medição primária" },
        { codigo: "SB-8", nome: "String box solar 8 entradas" },
      ])
      .returning();
    const p = Object.fromEntries(prods.map((x) => [x.codigo, x.id]));
    type Linha = [number, string, string, number, number, number]; // seq, nome, grupo, setup, fixo, por unidade
    const roteiros: Record<string, Linha[]> = {
      "QDC-24": [
        [10, "Corte", "G-PUNC", 20, 20, 15],
        [20, "Dobra", "G-DOBR", 15, 15, 10],
        [30, "Pintura", "G-PINT", 30, 60, 20],
        [40, "Montagem mecânica", "G-MEC", 0, 30, 90],
        [50, "Montagem elétrica", "G-ELE", 0, 30, 180],
        [60, "Testes", "G-TEST", 10, 30, 30],
      ],
      "CCM-6": [
        [10, "Corte", "G-PUNC", 20, 30, 40],
        [20, "Dobra", "G-DOBR", 15, 30, 30],
        [30, "Pintura", "G-PINT", 30, 90, 30],
        [40, "Montagem mecânica", "G-MEC", 0, 60, 300],
        [50, "Montagem elétrica", "G-ELE", 0, 60, 480],
        [60, "Testes", "G-TEST", 15, 60, 90],
      ],
      "CAB-MED": [
        [10, "Corte", "G-PUNC", 20, 30, 60],
        [20, "Dobra", "G-DOBR", 15, 30, 45],
        [30, "Pintura", "G-PINT", 30, 120, 60],
        [40, "Montagem mecânica", "G-MEC", 0, 60, 600],
        [40, "Preparação de chicotes", "G-ELE", 0, 30, 240],
        [50, "Montagem elétrica", "G-ELE", 0, 60, 480],
        [60, "Testes", "G-TEST", 15, 120, 0],
      ],
      "SB-8": [
        [10, "Corte", "G-PUNC", 10, 10, 8],
        [20, "Pintura", "G-PINT", 20, 45, 5],
        [30, "Montagem elétrica", "G-ELE", 0, 20, 50],
        [40, "Testes", "G-TEST", 5, 10, 10],
      ],
    };
    await tx.insert(roteiroOperacoes).values(
      Object.entries(roteiros).flatMap(([prod, linhas]) =>
        linhas.map(([sequencia, nome, grupo, setupMin, fixo, unidade]) => ({
          produtoId: p[prod],
          sequencia,
          nome,
          grupoRecursoId: g[grupo],
          setupMin,
          tempoFixoMin: String(fixo),
          tempoPorUnidadeMin: String(unidade),
        })),
      ),
    );

    const motivos = await tx
      .insert(motivosParada)
      .values([
        { codigo: "FALTA-MAT", nome: "Falta de material", categoria: "nao_planejada" },
        { codigo: "AJUSTE-PROJ", nome: "Ajuste de projeto", categoria: "nao_planejada" },
        { codigo: "MANUT-CORR", nome: "Manutenção corretiva", categoria: "nao_planejada" },
        { codigo: "RETRABALHO", nome: "Retrabalho de qualidade", categoria: "nao_planejada" },
        { codigo: "REFEICAO", nome: "Refeição", categoria: "planejada" },
        { codigo: "DDS", nome: "Reunião / DDS", categoria: "planejada" },
      ])
      .returning();
    const m = Object.fromEntries(motivos.map((x) => [x.codigo, x.id]));

    const ops = await tx
      .insert(operadores)
      .values([
        { matricula: "1001", nome: "Bruno Lima" },
        { matricula: "1002", nome: "Carla Souza" },
        { matricula: "1003", nome: "Diego Alves" },
        { matricula: "1004", nome: "Elaine Rocha" },
        { matricula: "1005", nome: "Fábio Nunes" },
      ])
      .returning();

    const cls = await tx
      .insert(clientes)
      .values([
        { nome: "Construtora Horizonte" },
        { nome: "Solar Vale Energia" },
        { nome: "Metalúrgica Paraná" },
        { nome: "Hospital Santa Clara" },
        { nome: "Condomínio Parque das Águas" },
      ])
      .returning();
    const cl = cls.map((x) => x.id);

    // Ordens: [código, produto, qtd, prioridade, entrega (dias úteis a partir de hoje), cliente]
    const ordens: [string, string, number, number, number, number][] = [
      ["4301", "QDC-24", 2, 2, 3, 0],
      ["4302", "SB-8", 6, 2, 2, 1],
      ["4303", "CCM-6", 1, 1, 6, 2],
      ["4304", "QDC-24", 3, 2, 7, 4],
      ["4305", "CAB-MED", 1, 2, 10, 3],
      ["4306", "SB-8", 10, 3, 9, 1],
      ["4307", "QDC-24", 1, 2, 5, 0],
      ["4308", "CCM-6", 2, 2, 12, 2],
      ["4309", "SB-8", 4, 1, 4, 1],
      ["4310", "QDC-24", 2, 3, 14, 4],
      ["4311", "CAB-MED", 1, 2, 15, 3],
      ["4312", "QDC-24", 4, 2, 11, 0],
    ];
    const criadas = await tx
      .insert(ordensProducao)
      .values(
        ordens.map(([codigo, prod, quantidade, prioridade, dias, cliente]) => ({
          codigo,
          produtoId: p[prod],
          quantidade,
          prioridade,
          prazoEntrega: diaUtil(hoje, dias),
          clienteId: cl[cliente],
          pedidoVenda: `PV-${Number(codigo) + 1200}`,
          criadoPor: usuarioId,
        })),
      )
      .returning();
    await tx.insert(configuracoes).values({ chave: CHAVE, valor: { carregadoEm: new Date().toISOString(), clientes: cl } });
    return { ordens: criadas, r, m, operadores: ops, produtos: p, clientes: cl };
  });

  for (const o of ids.ordens) {
    const lib = await liberarOrdem(o.id, usuarioId);
    if (!lib.ok) return lib;
  }

  // Histórico de execução fictício para o terminal e o Pareto de paradas.
  await db.transaction(async (tx) => {
    const op = async (codigo: string, nome: string) => {
      const ordem = ids.ordens.find((x) => x.codigo === codigo)!;
      const [linha] = await tx
        .select()
        .from(operacoesOrdem)
        .where(and(eq(operacoesOrdem.ordemId, ordem.id), eq(operacoesOrdem.nome, nome)));
      return linha;
    };
    let n = 0;
    const evento = (operacaoId: string, recursoId: string, tipo: "inicio" | "pausa" | "retomada" | "fim", quando: Date, motivoParadaId: string | null = null, operador = 0) =>
      tx
        .insert(eventosExecucao)
        .values({
          operacaoId,
          recursoId,
          operadorId: ids.operadores[operador].id,
          tipo,
          motivoParadaId,
          ocorridoEm: quando,
          usuarioId,
          chaveIdempotencia: `demo-${Date.now()}-${++n}`,
        })
        .returning({ id: eventosExecucao.id });
    const concluir = async (codigo: string, nome: string, recurso: string, inicio: Date, fim: Date, boa: number, operador = 0, pausas: [Date, Date, string][] = []) => {
      const o = await op(codigo, nome);
      await evento(o.id, ids.r[recurso], "inicio", inicio, null, operador);
      for (const [de, ate, motivo] of pausas) {
        await evento(o.id, ids.r[recurso], "pausa", de, ids.m[motivo], operador);
        await evento(o.id, ids.r[recurso], "retomada", ate, null, operador);
      }
      const [ev] = await evento(o.id, ids.r[recurso], "fim", fim, null, operador);
      await tx.insert(apontamentos).values({ operacaoId: o.id, eventoId: ev.id, operadorId: ids.operadores[operador].id, quantidadeBoa: boa, quantidadeRejeitada: 0, ocorridoEm: fim });
      await tx.update(operacoesOrdem).set({ status: "concluida", recursoExecucaoId: ids.r[recurso], inicioReal: inicio, fimReal: fim }).where(eq(operacoesOrdem.id, o.id));
    };
    const iniciar = async (codigo: string, nome: string, recurso: string, inicio: Date, operador = 0, pausada?: [Date, string]) => {
      const o = await op(codigo, nome);
      await evento(o.id, ids.r[recurso], "inicio", inicio, null, operador);
      if (pausada) await evento(o.id, ids.r[recurso], "pausa", pausada[0], ids.m[pausada[1]], operador);
      await tx
        .update(operacoesOrdem)
        .set({ status: pausada ? "pausada" : "em_execucao", recursoExecucaoId: ids.r[recurso], inicioReal: inicio })
        .where(eq(operacoesOrdem.id, o.id));
    };

    // OP 4301: caldeiraria e pintura concluídas; montagem mecânica em andamento.
    await concluir("4301", "Corte", "PUNC-01", hora(anteontem, 7), hora(anteontem, 8, 10), 2, 0);
    await concluir("4301", "Dobra", "DOBR-01", hora(anteontem, 9), hora(anteontem, 10), 2, 0);
    await concluir("4301", "Pintura", "CAB-PINT", hora(anteontem, 13), hora(anteontem, 15, 20), 2, 1, [[hora(anteontem, 14), hora(anteontem, 14, 40), "FALTA-MAT"]]);
    await iniciar("4301", "Montagem mecânica", "MEC-A", new Date(Date.now() - 60 * 60_000), 2);
    // OP 4302: corte e pintura concluídos; montagem elétrica parada por falta de material.
    await concluir("4302", "Corte", "PUNC-01", hora(ontem, 6, 30), hora(ontem, 7, 40), 6, 0);
    await concluir("4302", "Pintura", "CAB-PINT", hora(ontem, 8), hora(ontem, 9, 30), 6, 1, [[hora(ontem, 8, 45), hora(ontem, 9), "AJUSTE-PROJ"]]);
    await iniciar("4302", "Montagem elétrica", "ELE-A", new Date(Date.now() - 180 * 60_000), 3, [new Date(Date.now() - 80 * 60_000), "FALTA-MAT"]);
    // OP 4303: corte concluído (com parada de manutenção).
    await concluir("4303", "Corte", "PUNC-01", hora(ontem, 14), hora(ontem, 16, 30), 1, 0, [[hora(ontem, 15), hora(ontem, 15, 50), "MANUT-CORR"]]);

    for (const codigo of ["4301", "4302", "4303"]) {
      const ordem = ids.ordens.find((x) => x.codigo === codigo)!;
      await tx.update(ordensProducao).set({ status: "em_execucao" }).where(eq(ordensProducao.id, ordem.id));
      await tx.insert(ordemHistorico).values({ ordemId: ordem.id, de: "liberada", para: "em_execucao", usuarioId, motivo: "Apontamento de produção (demonstração)" });
    }
  });

  await gerarHistorico(usuarioId, { ...ids, hoje: ontem });

  const gerada = await gerarProgramacao(usuarioId);
  if (!gerada.ok) return gerada;
  const aprovada = await aprovar(gerada.programacaoId, usuarioId);
  if (!aprovada.ok) return aprovada;
  await registrarAuditoria(db, { entidade: "sistema", acao: "carregar_demonstracao", resumo: "Dados de demonstração carregados", usuarioId });
  return { ok: true };
}


// Gerador pseudoaleatório com semente: o histórico sai igual a cada carga.
function sorteador(semente: number) {
  let a = semente >>> 0;
  const proximo = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    numero: proximo,
    inteiro: (min: number, max: number) => min + Math.floor(proximo() * (max - min + 1)),
    item: <T,>(lista: T[]) => lista[Math.floor(proximo() * lista.length)],
  };
}

// Histórico fictício de ~60 dias de OPs concluídas, para a Visão geral ter tendência,
// comparação entre períodos, entregas no prazo/atrasadas, rejeições e paradas.
async function gerarHistorico(
  usuarioId: string,
  base: {
    hoje: string; // último dia útil com histórico
    produtos: Record<string, string>;
    clientes: string[];
    operadores: { id: string }[];
    m: Record<string, string>;
  },
) {
  const s = sorteador(20261021);
  const membros = await db.select().from(grupoRecursoMembros);
  const recursoDoGrupo = (grupoId: string) => {
    const lista = membros.filter((x) => x.grupoId === grupoId);
    return s.item(lista).recursoId;
  };
  const qtd: Record<string, [number, number]> = { "QDC-24": [1, 4], "SB-8": [4, 12], "CCM-6": [1, 2], "CAB-MED": [1, 1] };
  const mix = ["QDC-24", "SB-8", "QDC-24", "CCM-6", "SB-8", "CAB-MED", "QDC-24", "SB-8"];
  const motivos = ["FALTA-MAT", "FALTA-MAT", "FALTA-MAT", "AJUSTE-PROJ", "AJUSTE-PROJ", "MANUT-CORR", "RETRABALHO", "DDS"];

  // Dias úteis de trás para frente (~60 dias corridos).
  const dias: string[] = [];
  let d = base.hoje;
  while (dias.length < 42) {
    dias.push(d);
    d = diaUtilAnterior(d);
  }
  dias.reverse();

  let codigo = 4101;
  for (const [indice, diaFim] of dias.entries()) {
    // Ritmo maior nas semanas recentes (tendência de alta).
    const quantas = s.numero() < (indice < 21 ? 0.35 : 0.65) ? 2 : 1;
    for (let k = 0; k < quantas; k++) {
      const produto = s.item(mix);
      const quantidade = s.inteiro(...qtd[produto]);
      const noPrazo = s.numero() < 0.8;
      const prazo = noPrazo ? diaUtil(diaFim, s.inteiro(0, 3)) : diaUtilAnterior(s.numero() < 0.5 ? diaFim : diaUtilAnterior(diaFim));
      const [ordem] = await db
        .insert(ordensProducao)
        .values({
          codigo: String(codigo++),
          produtoId: base.produtos[produto],
          quantidade,
          prioridade: s.numero() < 0.15 ? 1 : 2,
          prazoEntrega: prazo,
          clienteId: s.item(base.clientes),
          pedidoVenda: `PV-${codigo + 1100}`,
          criadoPor: usuarioId,
        })
        .returning();
      const lib = await liberarOrdem(ordem.id, usuarioId);
      if (!lib.ok) continue;

      await db.transaction(async (tx) => {
        const ops = (await tx.select().from(operacoesOrdem).where(eq(operacoesOrdem.ordemId, ordem.id))).sort((a, b) => a.sequencia - b.sequencia);
        const ultimaSeq = Math.max(...ops.map((o) => o.sequencia));
        const eventos: (typeof eventosExecucao.$inferInsert)[] = [];
        const pontos: (typeof apontamentos.$inferInsert)[] = [];
        let fimOrdem = new Date(0);
        for (const [i, op] of ops.entries()) {
          const voltaDias = Math.floor((ops.length - 1 - i) / 2);
          let dia = diaFim;
          for (let v = 0; v < voltaDias; v++) dia = diaUtilAnterior(dia);
          const manha = (ops.length - 1 - i) % 2 === 1;
          const inicio = new Date(hora(dia, manha ? 7 : 13, s.inteiro(0, 40)).getTime());
          let fim = new Date(inicio.getTime() + s.inteiro(50, 180) * 60_000);
          const recursoId = recursoDoGrupo(op.grupoRecursoId);
          const operadorId = s.item(base.operadores).id;
          const ev = (tipo: "inicio" | "pausa" | "retomada" | "fim", quando: Date, motivo: string | null = null) => {
            const id = crypto.randomUUID();
            eventos.push({ id, operacaoId: op.id, recursoId, operadorId, tipo, motivoParadaId: motivo, ocorridoEm: quando, usuarioId, chaveIdempotencia: `demo-hist-${id}` });
            return id;
          };
          ev("inicio", inicio);
          if (s.numero() < 0.3) {
            const pausa = new Date(inicio.getTime() + s.inteiro(15, 40) * 60_000);
            const duracao = s.inteiro(10, 70) * 60_000;
            ev("pausa", pausa, base.m[s.item(motivos)]);
            ev("retomada", new Date(pausa.getTime() + duracao));
            fim = new Date(fim.getTime() + duracao);
          }
          const idFim = ev("fim", fim);
          const ultima = op.sequencia === ultimaSeq;
          pontos.push({
            operacaoId: op.id,
            eventoId: idFim,
            operadorId,
            quantidadeBoa: quantidade,
            quantidadeRejeitada: ultima && s.numero() < 0.18 ? s.inteiro(1, Math.max(1, Math.ceil(quantidade / 4))) : 0,
            ocorridoEm: fim,
          });
          await tx.update(operacoesOrdem).set({ status: "concluida", recursoExecucaoId: recursoId, inicioReal: inicio, fimReal: fim }).where(eq(operacoesOrdem.id, op.id));
          if (fim > fimOrdem) fimOrdem = fim;
        }
        await tx.insert(eventosExecucao).values(eventos);
        await tx.insert(apontamentos).values(pontos);
        await tx.update(ordensProducao).set({ status: "concluida" }).where(eq(ordensProducao.id, ordem.id));
        await tx.insert(ordemHistorico).values([
          { ordemId: ordem.id, de: "liberada", para: "em_execucao", usuarioId, motivo: "Apontamento de produção (demonstração)" },
          { ordemId: ordem.id, de: "em_execucao", para: "concluida", usuarioId, motivo: "Apontamento de produção (demonstração)" },
        ]);
      });
    }
  }
}

// Sequenciador determinístico de capacidade finita, para frente.
//
// Regra (explicável e reprodutível — não é otimização):
// 1. Operações já iniciadas no chão de fábrica ficam no recurso onde estão, a partir de agora.
// 2. Operações com data fixada pelo usuário (arraste) reservam o recurso a partir dessa data.
// 3. As demais ordens entram em fila: prioridade (1 = alta) → data de entrega → código.
//    Cada operação ocupa o primeiro horário livre, depois das operações anteriores da
//    mesma ordem, no recurso elegível que termina mais cedo. Uma ordem mais atrás na
//    fila só usa um espaço livre anterior se couber inteira nele.
// 4. Se a data fixada não puder ser cumprida por dependência, a fixação vira
//    "não começar antes de" e o conflito é informado.
import { encontrarEncaixe, minutosDisponiveis, type Ocupacao } from "../calendario.ts";
import { MINUTO, formatarCurto } from "../tempo.ts";
import type {
  Conflito,
  EntradaSequenciamento,
  Fixacao,
  ItemProgramado,
  OperacaoEntrada,
  OrdemEntrada,
  ResultadoSequenciamento,
  ResumoOrdem,
} from "./tipos.ts";

const rotuloPrioridade: Record<number, string> = { 1: "alta", 2: "normal", 3: "baixa" };

export function compararFila(a: OrdemEntrada, b: OrdemEntrada) {
  return a.prioridade - b.prioridade || a.prazoEntrega - b.prazoEntrega || a.codigo.localeCompare(b.codigo, "pt-BR");
}

type Contexto = {
  e: EntradaSequenciamento;
  ordemDaOperacao: Map<string, OrdemEntrada>;
  operacao: Map<string, OperacaoEntrada>;
  recursoNome: Map<string, string>;
  disponibilidade: Map<string, EntradaSequenciamento["recursos"][number]["disponibilidade"]>;
  posicaoFila: Map<string, number>;
  fila: OrdemEntrada[];
};

type Rodada = {
  itens: Map<string, ItemProgramado>;
  conflitos: Conflito[];
  violacoes: { fixacao: Fixacao; mensagem: string }[];
};

function criarContexto(e: EntradaSequenciamento): Contexto {
  const ordemDaOperacao = new Map<string, OrdemEntrada>();
  const operacao = new Map<string, OperacaoEntrada>();
  for (const o of e.ordens) {
    for (const op of o.operacoes) {
      ordemDaOperacao.set(op.id, o);
      operacao.set(op.id, op);
    }
  }
  const fila = [...e.ordens].sort(compararFila);
  return {
    e,
    ordemDaOperacao,
    operacao,
    recursoNome: new Map(e.recursos.map((r) => [r.id, r.nome])),
    disponibilidade: new Map(e.recursos.map((r) => [r.id, r.disponibilidade])),
    posicaoFila: new Map(fila.map((o, i) => [o.id, i + 1])),
    fila,
  };
}

function rotuloOperacao(ctx: Contexto, operacaoId: string) {
  const op = ctx.operacao.get(operacaoId);
  const ordem = ctx.ordemDaOperacao.get(operacaoId);
  return `OP ${ordem?.codigo ?? "?"} · ${op?.nome ?? "?"}`;
}

// Níveis de sequência da ordem, ignorando canceladas: [[ops seq 10], [ops seq 20], …]
function niveis(ordem: OrdemEntrada) {
  const ativas = ordem.operacoes.filter((op) => op.status !== "cancelada");
  const sequencias = [...new Set(ativas.map((op) => op.sequencia))].sort((a, b) => a - b);
  return sequencias.map((s) =>
    ativas.filter((op) => op.sequencia === s).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id)),
  );
}

// Término de cada operação (concluída = término real; programada = término previsto).
function fimDe(ctx: Contexto, itens: Map<string, ItemProgramado>, op: OperacaoEntrada): number | null {
  if (op.status === "concluida") return op.fimReal ?? ctx.e.agora;
  return itens.get(op.id)?.fim ?? null;
}

// Maior término entre as operações do nível anterior (e quem determinou).
function predecessoras(ctx: Contexto, itens: Map<string, ItemProgramado>, ordem: OrdemEntrada, op: OperacaoEntrada) {
  const lista = niveis(ordem);
  const indice = lista.findIndex((n) => n.some((x) => x.id === op.id));
  if (indice <= 0) return { fim: 0, nome: null as string | null, faltando: null as OperacaoEntrada | null };
  let fim = 0;
  let nome: string | null = null;
  for (const anterior of lista[indice - 1]) {
    const f = fimDe(ctx, itens, anterior);
    if (f === null) return { fim: 0, nome: null, faltando: anterior };
    if (f > fim) {
      fim = f;
      nome = anterior.nome;
    }
  }
  return { fim, nome, faltando: null };
}

function minutosDaOperacao(op: OperacaoEntrada) {
  return Math.max(1, op.setupMin + op.processamentoMin);
}

function reservar(ocupacoes: Map<string, Ocupacao[]>, recursoId: string, item: ItemProgramado) {
  const lista = ocupacoes.get(recursoId) ?? [];
  lista.push({ inicio: item.inicio, fim: item.fim, operacaoId: item.operacaoId });
  lista.sort((a, b) => a.inicio - b.inicio);
  ocupacoes.set(recursoId, lista);
}

type Candidato = { recursoId: string; inicio: number; fim: number; segmentos: ItemProgramado["segmentos"]; bloqueadoPor: Ocupacao | null };

function melhorCandidato(
  ctx: Contexto,
  ocupacoes: Map<string, Ocupacao[]>,
  recursos: string[],
  aPartirDe: number,
  minutos: number,
  criterio: "termino" | "inicio",
): { candidato: Candidato | null; motivo: "sem_turno" | "fora_horizonte" } {
  let melhor: Candidato | null = null;
  let todosSemTurno = true;
  for (const recursoId of recursos) {
    const disp = ctx.disponibilidade.get(recursoId) ?? [];
    const r = encontrarEncaixe(disp, ocupacoes.get(recursoId) ?? [], aPartirDe, minutos);
    if (!r.ok) {
      if (r.motivo !== "sem_turno") todosSemTurno = false;
      continue;
    }
    todosSemTurno = false;
    const c = { recursoId, ...r.encaixe, bloqueadoPor: r.bloqueadoPor };
    const chave = criterio === "termino" ? c.fim : c.inicio;
    const chaveMelhor = melhor ? (criterio === "termino" ? melhor.fim : melhor.inicio) : Infinity;
    // Empate: mantém o primeiro (ordem de preferência do grupo).
    if (chave < chaveMelhor) melhor = c;
  }
  return { candidato: melhor, motivo: todosSemTurno ? "sem_turno" : "fora_horizonte" };
}

function mensagemSemEncaixe(ctx: Contexto, opId: string, motivo: "sem_turno" | "fora_horizonte") {
  return motivo === "sem_turno"
    ? `${rotuloOperacao(ctx, opId)}: nenhum recurso elegível tem turno cadastrado.`
    : `${rotuloOperacao(ctx, opId)}: não coube dentro do horizonte de programação (até ${formatarCurto(ctx.e.horizonteFim, ctx.e.fuso)}).`;
}

function recursosValidos(ctx: Contexto, op: OperacaoEntrada) {
  return op.recursosElegiveis.filter((id) => ctx.disponibilidade.has(id));
}

function rodar(ctx: Contexto, reservadas: Fixacao[], minimas: Map<string, Fixacao>, notas: Map<string, string>): Rodada {
  const { e } = ctx;
  const itens = new Map<string, ItemProgramado>();
  const conflitos: Conflito[] = [];
  const ocupacoes = new Map<string, Ocupacao[]>();
  const fuso = e.fuso;

  const conflito = (c: Omit<Conflito, "ordemId"> & { ordemId?: string }) => {
    const ordemId = c.ordemId ?? (c.operacaoId ? ctx.ordemDaOperacao.get(c.operacaoId)?.id : undefined) ?? "";
    conflitos.push({ ...c, ordemId });
  };

  // 1. Operações já iniciadas.
  for (const ordem of ctx.fila) {
    for (const op of ordem.operacoes) {
      if (op.status !== "em_execucao" && op.status !== "pausada") continue;
      const recursoId = op.recursoAtualId && ctx.disponibilidade.has(op.recursoAtualId) ? op.recursoAtualId : null;
      if (!recursoId) {
        conflito({ tipo: "sem_recurso_elegivel", operacaoId: op.id, mensagem: `${rotuloOperacao(ctx, op.id)} está em execução em um recurso fora da programação.` });
        continue;
      }
      const restante = Math.max(1, op.minutosRestantes ?? op.processamentoMin);
      const r = encontrarEncaixe(ctx.disponibilidade.get(recursoId)!, ocupacoes.get(recursoId) ?? [], e.agora, restante);
      if (!r.ok) {
        conflito({ tipo: r.motivo, operacaoId: op.id, mensagem: mensagemSemEncaixe(ctx, op.id, r.motivo) });
        continue;
      }
      const item: ItemProgramado = {
        operacaoId: op.id,
        ordemId: ordem.id,
        recursoId,
        ...r.encaixe,
        setupMin: 0,
        fixada: false,
        emExecucao: true,
        justificativa: `${op.status === "pausada" ? "Pausada" : "Em execução"} no chão de fábrica; restam cerca de ${restante} min, contados a partir de agora.`,
      };
      itens.set(op.id, item);
      reservar(ocupacoes, recursoId, item);
    }
  }

  // 2. Datas fixadas pelo usuário (reservam o recurso antes da fila).
  const ordenadas = [...reservadas].sort(
    (a, b) =>
      a.inicio - b.inicio ||
      (ctx.posicaoFila.get(ctx.ordemDaOperacao.get(a.operacaoId)!.id) ?? 0) -
        (ctx.posicaoFila.get(ctx.ordemDaOperacao.get(b.operacaoId)!.id) ?? 0) ||
      a.operacaoId.localeCompare(b.operacaoId),
  );
  for (const fix of ordenadas) {
    const op = ctx.operacao.get(fix.operacaoId)!;
    const ordem = ctx.ordemDaOperacao.get(fix.operacaoId)!;
    const elegiveis = recursosValidos(ctx, op);
    const recursos = fix.recursoId && elegiveis.includes(fix.recursoId) ? [fix.recursoId] : elegiveis;
    if (recursos.length === 0) {
      conflito({ tipo: "sem_recurso_elegivel", operacaoId: op.id, mensagem: `${rotuloOperacao(ctx, op.id)}: nenhum recurso elegível ativo.` });
      continue;
    }
    const desejado = Math.max(fix.inicio, e.agora);
    const { candidato: c, motivo } = melhorCandidato(ctx, ocupacoes, recursos, desejado, minutosDaOperacao(op), "inicio");
    if (!c) {
      conflito({ tipo: motivo, operacaoId: op.id, mensagem: mensagemSemEncaixe(ctx, op.id, motivo) });
      continue;
    }
    const partes = [`Data fixada pelo usuário: ${formatarCurto(fix.inicio, fuso)}.`];
    if (c.bloqueadoPor) {
      const msg = `A data fixada de ${rotuloOperacao(ctx, op.id)} (${formatarCurto(fix.inicio, fuso)}) não pôde ser cumprida: ${ctx.recursoNome.get(c.recursoId)} já está reservado para ${rotuloOperacao(ctx, c.bloqueadoPor.operacaoId)} até ${formatarCurto(c.bloqueadoPor.fim, fuso)}. Início em ${formatarCurto(c.inicio, fuso)}.`;
      conflito({ tipo: "fixacao_nao_cumprida", operacaoId: op.id, mensagem: msg });
      partes.push("Recurso já reservado na data; iniciada no primeiro horário livre depois.");
    } else if (c.inicio > desejado) {
      partes.push(`A data cai fora do turno; início no próximo horário de trabalho (${formatarCurto(c.inicio, fuso)}).`);
    }
    const item: ItemProgramado = {
      operacaoId: op.id,
      ordemId: ordem.id,
      recursoId: c.recursoId,
      inicio: c.inicio,
      fim: c.fim,
      segmentos: c.segmentos,
      setupMin: op.setupMin,
      fixada: true,
      emExecucao: false,
      justificativa: partes.join(" "),
    };
    itens.set(op.id, item);
    reservar(ocupacoes, c.recursoId, item);
  }

  // 3. Fila.
  for (const ordem of ctx.fila) {
    const posicao = ctx.posicaoFila.get(ordem.id)!;
    for (const nivel of niveis(ordem)) {
      for (const op of nivel) {
        if (op.status !== "pendente" || itens.has(op.id)) continue;
        const pred = predecessoras(ctx, itens, ordem, op);
        if (pred.faltando) {
          conflito({
            tipo: "predecessora_nao_programada",
            operacaoId: op.id,
            mensagem: `${rotuloOperacao(ctx, op.id)} não foi programada porque depende de "${pred.faltando.nome}", que ficou sem programação.`,
          });
          continue;
        }
        const minima = minimas.get(op.id);
        const limites: { valor: number; texto: string }[] = [
          { valor: e.agora, texto: "agora" },
          { valor: ordem.inicioMaisCedo ?? 0, texto: "início mais cedo da OP" },
          { valor: pred.fim, texto: `término de "${pred.nome}"` },
          { valor: minima?.inicio ?? 0, texto: "data fixada pelo usuário" },
        ];
        const limite = limites.reduce((a, b) => (b.valor > a.valor ? b : a));
        const elegiveis = recursosValidos(ctx, op);
        const recursos = minima?.recursoId && elegiveis.includes(minima.recursoId) ? [minima.recursoId] : elegiveis;
        if (recursos.length === 0) {
          conflito({
            tipo: "sem_recurso_elegivel",
            operacaoId: op.id,
            mensagem: `${rotuloOperacao(ctx, op.id)}: nenhum recurso ativo está habilitado para esta operação.`,
          });
          continue;
        }
        const { candidato: c, motivo } = melhorCandidato(ctx, ocupacoes, recursos, limite.valor, minutosDaOperacao(op), "termino");
        if (!c) {
          conflito({ tipo: motivo, operacaoId: op.id, mensagem: mensagemSemEncaixe(ctx, op.id, motivo) });
          continue;
        }
        const partes = [
          `${posicao}ª na fila (prioridade ${rotuloPrioridade[ordem.prioridade] ?? ordem.prioridade}, entrega ${formatarCurto(ordem.prazoEntrega, fuso).slice(0, 5)}).`,
        ];
        if (minima) partes.push(notas.get(op.id) ?? "Data fixada pelo usuário não pôde ser cumprida.");
        partes.push(`Pode começar a partir de ${formatarCurto(limite.valor, fuso)} (${limite.texto}).`);
        if (c.bloqueadoPor) {
          partes.push(`Recurso ocupado por ${rotuloOperacao(ctx, c.bloqueadoPor.operacaoId)} até ${formatarCurto(c.bloqueadoPor.fim, fuso)}.`);
        } else if (c.inicio > limite.valor) {
          partes.push("Aguardou o próximo horário de turno.");
        }
        if (recursos.length > 1) {
          partes.push(`Recurso escolhido: ${ctx.recursoNome.get(c.recursoId)} (termina mais cedo entre ${recursos.length} elegíveis).`);
        }
        const item: ItemProgramado = {
          operacaoId: op.id,
          ordemId: ordem.id,
          recursoId: c.recursoId,
          inicio: c.inicio,
          fim: c.fim,
          segmentos: c.segmentos,
          setupMin: op.setupMin,
          fixada: !!minima,
          emExecucao: false,
          justificativa: partes.join(" "),
        };
        itens.set(op.id, item);
        reservar(ocupacoes, c.recursoId, item);
      }
    }
  }

  // 4. Fixações que ficaram antes da operação anterior (dependência violada).
  const violacoes: Rodada["violacoes"] = [];
  for (const fix of reservadas) {
    const item = itens.get(fix.operacaoId);
    if (!item) continue;
    const ordem = ctx.ordemDaOperacao.get(fix.operacaoId)!;
    const pred = predecessoras(ctx, itens, ordem, ctx.operacao.get(fix.operacaoId)!);
    if (pred.faltando) {
      violacoes.push({
        fixacao: fix,
        mensagem: `A data fixada de ${rotuloOperacao(ctx, fix.operacaoId)} (${formatarCurto(fix.inicio, fuso)}) não pôde ser cumprida: depende de "${pred.faltando.nome}", que ficou sem programação.`,
      });
    } else if (pred.fim > item.inicio) {
      violacoes.push({
        fixacao: fix,
        mensagem: `A data fixada de ${rotuloOperacao(ctx, fix.operacaoId)} (${formatarCurto(fix.inicio, fuso)}) não pôde ser cumprida: depende de "${pred.nome}", que agora termina em ${formatarCurto(pred.fim, fuso)}. Programada para o primeiro horário possível depois disso.`,
      });
    }
  }

  return { itens, conflitos, violacoes };
}

export function sequenciar(e: EntradaSequenciamento): ResultadoSequenciamento {
  const ctx = criarContexto(e);
  const conflitosFixacao: Conflito[] = [];

  // Só valem fixações de operações pendentes que existem nesta entrada.
  const validas: Fixacao[] = [];
  const vistas = new Set<string>();
  for (const f of e.fixacoes) {
    const op = ctx.operacao.get(f.operacaoId);
    if (!op || vistas.has(f.operacaoId)) continue;
    vistas.add(f.operacaoId);
    if (op.status !== "pendente") {
      conflitosFixacao.push({
        tipo: "fixacao_ignorada",
        ordemId: ctx.ordemDaOperacao.get(f.operacaoId)!.id,
        operacaoId: f.operacaoId,
        mensagem: `A data fixada de ${rotuloOperacao(ctx, f.operacaoId)} foi ignorada porque a operação já foi iniciada ou concluída.`,
      });
      continue;
    }
    if (f.recursoId && !op.recursosElegiveis.includes(f.recursoId)) {
      conflitosFixacao.push({
        tipo: "fixacao_ignorada",
        ordemId: ctx.ordemDaOperacao.get(f.operacaoId)!.id,
        operacaoId: f.operacaoId,
        mensagem: `O recurso fixado para ${rotuloOperacao(ctx, f.operacaoId)} não está habilitado para a operação; a data foi mantida e o recurso será escolhido pelo sistema.`,
      });
      validas.push({ ...f, recursoId: null });
      continue;
    }
    validas.push(f);
  }

  let reservadas = validas;
  const minimas = new Map<string, Fixacao>();
  const notas = new Map<string, string>();
  let rodada = rodar(ctx, reservadas, minimas, notas);
  // Cada volta rebaixa ao menos uma fixação para "não antes de"; termina em ≤ n voltas.
  while (rodada.violacoes.length > 0) {
    for (const v of rodada.violacoes) {
      minimas.set(v.fixacao.operacaoId, v.fixacao);
      notas.set(v.fixacao.operacaoId, v.mensagem);
      conflitosFixacao.push({
        tipo: "fixacao_nao_cumprida",
        ordemId: ctx.ordemDaOperacao.get(v.fixacao.operacaoId)!.id,
        operacaoId: v.fixacao.operacaoId,
        mensagem: v.mensagem,
      });
    }
    const rebaixadas = new Set(rodada.violacoes.map((v) => v.fixacao.operacaoId));
    reservadas = reservadas.filter((f) => !rebaixadas.has(f.operacaoId));
    rodada = rodar(ctx, reservadas, minimas, notas);
  }

  const itens = [...rodada.itens.values()].sort(
    (a, b) => a.inicio - b.inicio || a.recursoId.localeCompare(b.recursoId) || a.operacaoId.localeCompare(b.operacaoId),
  );
  const conflitos = [...conflitosFixacao, ...rodada.conflitos];
  return {
    itens,
    conflitos,
    ordens: resumirOrdens(ctx, rodada.itens),
    metricas: calcularMetricas(ctx, itens, rodada.itens),
    fixacoesAplicadas: validas,
  };
}

function resumirOrdens(ctx: Contexto, itens: Map<string, ItemProgramado>): ResumoOrdem[] {
  return ctx.fila.map((ordem) => {
    const ativas = ordem.operacoes.filter((op) => op.status !== "cancelada");
    let fim = 0;
    let inicio: number | null = null;
    let completa = ativas.length > 0;
    for (const op of ativas) {
      const f = fimDe(ctx, itens, op);
      if (f === null) completa = false;
      else fim = Math.max(fim, f);
      const item = itens.get(op.id);
      if (item && (inicio === null || item.inicio < inicio)) inicio = item.inicio;
    }
    const fimPrevisto = completa ? fim : null;
    const atrasoMin = fimPrevisto !== null && fimPrevisto > ordem.prazoEntrega ? Math.ceil((fimPrevisto - ordem.prazoEntrega) / MINUTO) : 0;
    return { ordemId: ordem.id, posicaoFila: ctx.posicaoFila.get(ordem.id)!, inicioPrevisto: inicio, fimPrevisto, atrasoMin, completa };
  });
}

function calcularMetricas(ctx: Contexto, itens: ItemProgramado[], porOperacao: Map<string, ItemProgramado>) {
  const resumo = resumirOrdens(ctx, porOperacao);
  const termino = itens.length ? Math.max(...itens.map((i) => i.fim)) : null;
  const utilizacao = ctx.e.recursos.map((r) => {
    const disponivelMin = termino ? minutosDisponiveis(r.disponibilidade, ctx.e.agora, termino) : 0;
    let ocupado = 0;
    for (const i of itens) {
      if (i.recursoId !== r.id) continue;
      for (const s of i.segmentos) ocupado += (s.fim - s.inicio) / MINUTO;
    }
    return { recursoId: r.id, disponivelMin: Math.round(disponivelMin), ocupadoMin: Math.round(ocupado) };
  });
  const pendentes = [...ctx.operacao.values()].filter((op) => op.status !== "concluida" && op.status !== "cancelada");
  const comSetup = itens.filter((i) => !i.emExecucao && i.setupMin > 0);
  return {
    totalOrdens: resumo.length,
    ordensProgramadas: resumo.filter((r) => r.completa).length,
    ordensAtrasadas: resumo.filter((r) => r.atrasoMin > 0).length,
    atrasoTotalMin: resumo.reduce((s, r) => s + r.atrasoMin, 0),
    operacoesProgramadas: itens.length,
    operacoesNaoProgramadas: pendentes.length - itens.length,
    operacoesComSetup: comSetup.length,
    setupTotalMin: comSetup.reduce((s, i) => s + i.setupMin, 0),
    ociosidadeMin: utilizacao.reduce((s, u) => s + Math.max(0, u.disponivelMin - u.ocupadoMin), 0),
    termino,
    utilizacao,
  };
}

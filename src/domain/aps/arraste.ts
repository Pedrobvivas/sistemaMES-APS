// Traduz um arraste no Gantt em fixações para a próxima programação.
// Regras combinadas com o cliente:
// - A data solta vira a data de início da OP (ou da operação) e fica fixada até "Desafixar".
// - A prioridade não muda: as demais OPs são reprogramadas pela fila normal.
// - Só uma operação: não pode começar antes do fim da operação anterior da mesma OP.
// - Troca de recurso só para recurso elegível (e só no modo "operação").
// - Não se arrasta o que já foi iniciado nem para antes de agora.
import { formatarCurto } from "../tempo.ts";
import type { Fixacao, ItemProgramado, OrdemEntrada } from "./tipos.ts";

export type ModoArraste = "ordem" | "operacao";

export type ComandoArraste = {
  modo: ModoArraste;
  operacaoId: string; // barra que foi arrastada
  novoInicio: number;
  recursoId?: string | null; // linha onde foi solta (só vale no modo operação)
};

export type ResultadoArraste = { ok: true; fixacoes: Fixacao[]; descricao: string } | { ok: false; erro: string };

const TOLERANCIA_AGORA = 5 * 60_000;

export function aplicarArraste(
  cmd: ComandoArraste,
  contexto: {
    agora: number;
    fuso: string;
    ordem: OrdemEntrada;
    itensBase: ItemProgramado[]; // programação de onde o arraste partiu
    fixacoesAtuais: Fixacao[];
    nomeRecurso: (id: string) => string;
  },
): ResultadoArraste {
  const { ordem, agora, fuso } = contexto;
  const op = ordem.operacoes.find((o) => o.id === cmd.operacaoId);
  if (!op) return { ok: false, erro: "Operação não encontrada nesta OP." };
  if (op.status !== "pendente") return { ok: false, erro: `"${op.nome}" já foi iniciada no chão de fábrica e não pode ser movida.` };
  if (cmd.novoInicio < agora - TOLERANCIA_AGORA) return { ok: false, erro: "Não é possível programar para antes de agora." };

  const base = new Map(contexto.itensBase.map((i) => [i.operacaoId, i]));
  const itemArrastado = base.get(op.id);
  if (!itemArrastado) return { ok: false, erro: "Esta operação não está na programação atual. Gere uma nova programação primeiro." };

  const ativas = ordem.operacoes.filter((o) => o.status !== "cancelada");
  const fimDe = (opId: string) => {
    const o = ativas.find((x) => x.id === opId)!;
    if (o.status === "concluida") return o.fimReal ?? agora;
    return base.get(opId)?.fim ?? null;
  };
  const anteriores = (seq: number) => ativas.filter((o) => o.sequencia < seq);
  const nivelAnterior = (seq: number) => {
    const menores = anteriores(seq);
    if (menores.length === 0) return [];
    const maior = Math.max(...menores.map((o) => o.sequencia));
    return menores.filter((o) => o.sequencia === maior);
  };
  const daOrdem = new Set(ativas.map((o) => o.id));
  const quando = formatarCurto(Math.max(cmd.novoInicio, agora), fuso);

  if (cmd.modo === "operacao") {
    const recursoId = cmd.recursoId ?? itemArrastado.recursoId;
    if (!op.recursosElegiveis.includes(recursoId)) {
      return { ok: false, erro: `${contexto.nomeRecurso(recursoId)} não está habilitado para "${op.nome}".` };
    }
    for (const anterior of nivelAnterior(op.sequencia)) {
      const fim = fimDe(anterior.id);
      if (fim !== null && fim > cmd.novoInicio) {
        return {
          ok: false,
          erro: `"${op.nome}" depende de "${anterior.nome}", que termina em ${formatarCurto(fim, fuso)}. Solte a operação a partir desse horário ou mova a OP inteira.`,
        };
      }
    }
    const fixacoes = contexto.fixacoesAtuais.filter((f) => f.operacaoId !== op.id);
    fixacoes.push({ operacaoId: op.id, inicio: cmd.novoInicio, recursoId });
    const troca = recursoId !== itemArrastado.recursoId ? ` em ${contexto.nomeRecurso(recursoId)}` : "";
    return { ok: true, fixacoes, descricao: `OP ${ordem.codigo} · ${op.nome} movida para ${quando}${troca}.` };
  }

  // OP inteira: desloca o primeiro nível pendente pelo mesmo intervalo do arraste;
  // as operações seguintes acompanham pela sequência. Fixações antigas da OP saem.
  const deslocamento = cmd.novoInicio - itemArrastado.inicio;
  const pendentes = ativas.filter((o) => o.status === "pendente");
  const primeiraSeq = Math.min(...pendentes.map((o) => o.sequencia));
  const primeiras = pendentes.filter((o) => o.sequencia === primeiraSeq);
  const novas: Fixacao[] = [];
  for (const p of primeiras) {
    const item = base.get(p.id);
    if (!item) return { ok: false, erro: `"${p.nome}" não está na programação atual. Gere uma nova programação primeiro.` };
    const inicio = Math.max(item.inicio + deslocamento, agora);
    for (const anterior of nivelAnterior(p.sequencia)) {
      const fim = fimDe(anterior.id);
      if (fim !== null && fim > inicio) {
        return {
          ok: false,
          erro: `A OP ${ordem.codigo} não pode começar em ${formatarCurto(inicio, fuso)}: "${anterior.nome}" está em andamento e termina em ${formatarCurto(fim, fuso)}.`,
        };
      }
    }
    novas.push({ operacaoId: p.id, inicio, recursoId: item.recursoId });
  }
  const fixacoes = [...contexto.fixacoesAtuais.filter((f) => !daOrdem.has(f.operacaoId)), ...novas];
  const inicioOp = formatarCurto(Math.min(...novas.map((n) => n.inicio)), fuso);
  return { ok: true, fixacoes, descricao: `OP ${ordem.codigo} movida para começar em ${inicioOp}.` };
}

// Remove a data fixada de uma operação (ou de todas as operações da OP).
export function desafixar(fixacoes: Fixacao[], operacaoIds: string[]) {
  const remover = new Set(operacaoIds);
  return fixacoes.filter((f) => !remover.has(f.operacaoId));
}

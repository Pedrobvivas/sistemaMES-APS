// Máquina de estados da execução de uma operação no chão de fábrica.
import type { StatusOperacao } from "../aps/tipos.ts";

export type TipoEvento = "inicio" | "pausa" | "retomada" | "fim";

export const rotuloEvento: Record<TipoEvento, string> = {
  inicio: "Início",
  pausa: "Pausa",
  retomada: "Retomada",
  fim: "Finalização",
};

const transicoes: Record<TipoEvento, { de: StatusOperacao[]; para: StatusOperacao }> = {
  inicio: { de: ["pendente"], para: "em_execucao" },
  pausa: { de: ["em_execucao"], para: "pausada" },
  retomada: { de: ["pausada"], para: "em_execucao" },
  fim: { de: ["em_execucao"], para: "concluida" },
};

export type ContextoEvento = {
  statusAtual: StatusOperacao;
  tipo: TipoEvento;
  // Operações do nível anterior da mesma OP que ainda não foram concluídas.
  anterioresPendentes: string[];
  // Outra operação já em execução no mesmo recurso (capacidade 1).
  ocupacaoRecurso: string | null;
  motivoParadaId?: string | null;
  quantidades?: { boa: number; rejeitada: number } | null;
  quantidadePlanejada: number;
  produzidoAntes: number; // boas já apontadas nesta operação
  confirmarExcedente?: boolean;
};

export type Validacao = { ok: true; novoStatus: StatusOperacao } | { ok: false; erro: string };

export function validarEvento(c: ContextoEvento): Validacao {
  const regra = transicoes[c.tipo];
  if (!regra.de.includes(c.statusAtual)) {
    return { ok: false, erro: mensagemTransicao(c.statusAtual, c.tipo) };
  }
  if (c.tipo === "inicio" && c.anterioresPendentes.length > 0) {
    return { ok: false, erro: `Antes, conclua: ${c.anterioresPendentes.join(", ")}.` };
  }
  if ((c.tipo === "inicio" || c.tipo === "retomada") && c.ocupacaoRecurso) {
    return { ok: false, erro: `O recurso já está produzindo ${c.ocupacaoRecurso}. Pause ou finalize antes.` };
  }
  if (c.tipo === "pausa" && !c.motivoParadaId) {
    return { ok: false, erro: "Informe o motivo da parada." };
  }
  if (c.tipo === "fim") {
    const q = c.quantidades;
    if (!q) return { ok: false, erro: "Informe as quantidades boa e rejeitada." };
    if (!Number.isInteger(q.boa) || !Number.isInteger(q.rejeitada) || q.boa < 0 || q.rejeitada < 0) {
      return { ok: false, erro: "Quantidades devem ser números inteiros a partir de zero." };
    }
    if (q.boa + q.rejeitada === 0) return { ok: false, erro: "Informe ao menos uma peça produzida ou rejeitada." };
    if (c.produzidoAntes + q.boa > c.quantidadePlanejada && !c.confirmarExcedente) {
      return {
        ok: false,
        erro: `A quantidade boa (${c.produzidoAntes + q.boa}) passa da quantidade da OP (${c.quantidadePlanejada}). Confirme o excedente para continuar.`,
      };
    }
  }
  return { ok: true, novoStatus: regra.para };
}

function mensagemTransicao(status: StatusOperacao, tipo: TipoEvento) {
  const estado: Record<StatusOperacao, string> = {
    pendente: "ainda não foi iniciada",
    em_execucao: "já está em execução",
    pausada: "está pausada",
    concluida: "já foi concluída",
    cancelada: "foi cancelada",
  };
  return `Não é possível registrar ${rotuloEvento[tipo].toLowerCase()}: a operação ${estado[status]}.`;
}

// Tempo trabalhado (ms) a partir dos eventos em ordem: soma dos trechos início/retomada → pausa/fim.
export function tempoTrabalhado(eventos: { tipo: TipoEvento; ocorridoEm: number }[], agora: number) {
  let total = 0;
  let aberto: number | null = null;
  for (const ev of [...eventos].sort((a, b) => a.ocorridoEm - b.ocorridoEm)) {
    if (ev.tipo === "inicio" || ev.tipo === "retomada") aberto ??= ev.ocorridoEm;
    else if (aberto !== null) {
      total += Math.max(0, ev.ocorridoEm - aberto);
      aberto = null;
    }
  }
  if (aberto !== null) total += Math.max(0, agora - aberto);
  return total;
}

// Trechos de parada (pausa → retomada/fim, ou até agora se ainda parada).
export function trechosDeParada(
  eventos: { tipo: TipoEvento; ocorridoEm: number; motivoParadaId: string | null }[],
  agora: number,
) {
  const trechos: { motivoParadaId: string | null; inicio: number; fim: number }[] = [];
  let pausa: { inicio: number; motivo: string | null } | null = null;
  for (const ev of [...eventos].sort((a, b) => a.ocorridoEm - b.ocorridoEm)) {
    if (ev.tipo === "pausa") pausa = { inicio: ev.ocorridoEm, motivo: ev.motivoParadaId };
    else if (pausa && (ev.tipo === "retomada" || ev.tipo === "fim")) {
      trechos.push({ motivoParadaId: pausa.motivo, inicio: pausa.inicio, fim: ev.ocorridoEm });
      pausa = null;
    }
  }
  if (pausa) trechos.push({ motivoParadaId: pausa.motivo, inicio: pausa.inicio, fim: agora });
  return trechos;
}

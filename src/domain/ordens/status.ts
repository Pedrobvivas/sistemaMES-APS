// Ciclo de vida da ordem de produção.
// rascunho → liberada → em_execucao → concluida ; cancelada a partir de rascunho/liberada sem apontamentos.
// "em_execucao" e "concluida" são consequência dos apontamentos, não ação manual.
import type { StatusOperacao } from "../aps/tipos.ts";

export type StatusOrdem = "rascunho" | "liberada" | "em_execucao" | "concluida" | "cancelada";

export const rotuloStatusOrdem: Record<StatusOrdem, string> = {
  rascunho: "Rascunho",
  liberada: "Liberada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export type AcaoOrdem = "liberar" | "cancelar";

const permitidas: Record<AcaoOrdem, StatusOrdem[]> = {
  liberar: ["rascunho"],
  cancelar: ["rascunho", "liberada"],
};

const destino: Record<AcaoOrdem, StatusOrdem> = {
  liberar: "liberada",
  cancelar: "cancelada",
};

export function validarAcaoOrdem(
  status: StatusOrdem,
  acao: AcaoOrdem,
  opcoes: { operacoesDoRoteiro?: number; algumaIniciada?: boolean } = {},
): { ok: true; novoStatus: StatusOrdem } | { ok: false; erro: string } {
  if (!permitidas[acao].includes(status)) {
    const nomes: Record<AcaoOrdem, string> = { liberar: "liberar", cancelar: "cancelar" };
    return { ok: false, erro: `Não é possível ${nomes[acao]} uma OP com status "${rotuloStatusOrdem[status]}".` };
  }
  if (acao === "liberar" && !opcoes.operacoesDoRoteiro) {
    return { ok: false, erro: "O produto desta OP não tem operações no roteiro. Cadastre o roteiro antes de liberar." };
  }
  if (acao === "cancelar" && opcoes.algumaIniciada) {
    return { ok: false, erro: "Esta OP já tem apontamentos de produção e não pode ser alterada dessa forma." };
  }
  return { ok: true, novoStatus: destino[acao] };
}

// Status da OP a partir das operações, depois de um apontamento.
export function statusPelasOperacoes(atual: StatusOrdem, operacoes: StatusOperacao[]): StatusOrdem {
  if (atual === "cancelada" || atual === "rascunho") return atual;
  const ativas = operacoes.filter((s) => s !== "cancelada");
  if (ativas.length > 0 && ativas.every((s) => s === "concluida")) return "concluida";
  if (ativas.some((s) => s !== "pendente")) return "em_execucao";
  return "liberada";
}

// Duração do processamento da operação na OP (snapshot do roteiro).
export function duracaoProcessamento(tempoPorUnidadeMin: number, tempoFixoMin: number, quantidade: number) {
  return Math.max(1, Math.ceil(tempoFixoMin + tempoPorUnidadeMin * quantidade));
}

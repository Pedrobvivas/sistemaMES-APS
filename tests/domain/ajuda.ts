// Montagem de cenários para os testes do domínio.
import { gerarDisponibilidade, type PeriodoTurno } from "../../src/domain/calendario.ts";
import type { Fixacao, OperacaoEntrada, OrdemEntrada, RecursoEntrada } from "../../src/domain/aps/tipos.ts";
import { DIA, fimDoDia, localParaInstante } from "../../src/domain/tempo.ts";

export const FUSO = "America/Sao_Paulo";

// "2026-10-26", "08:00" → instante. 26/10/2026 é uma segunda-feira.
export function t(dia: string, hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return localParaInstante(dia, h * 60 + m, FUSO);
}

// Turno comercial de segunda a sexta: 08:00–12:00 e 13:00–17:00 (8 h por dia).
export const turnoComercial: PeriodoTurno[] = [1, 2, 3, 4, 5].flatMap((diaSemana) => [
  { diaSemana, inicioMin: 8 * 60, fimMin: 12 * 60 },
  { diaSemana, inicioMin: 13 * 60, fimMin: 17 * 60 },
]);

export const AGORA = t("2026-10-26", "07:00");
export const HORIZONTE = AGORA + 30 * DIA;

export function recurso(
  id: string,
  opcoes: { periodos?: PeriodoTurno[]; feriados?: string[]; indisponibilidades?: { inicio: number; fim: number }[] } = {},
): RecursoEntrada {
  return {
    id,
    nome: id,
    disponibilidade: gerarDisponibilidade({
      periodos: opcoes.periodos ?? turnoComercial,
      feriados: opcoes.feriados ?? [],
      indisponibilidades: opcoes.indisponibilidades ?? [],
      de: AGORA,
      ate: HORIZONTE,
      fuso: FUSO,
    }),
  };
}

let seq = 0;
export function op(nome: string, minutos: number, recursos: string[], extra: Partial<OperacaoEntrada> = {}): OperacaoEntrada {
  seq += 10;
  return {
    id: extra.id ?? `${nome}-${seq}`,
    sequencia: extra.sequencia ?? seq,
    nome,
    setupMin: 0,
    processamentoMin: minutos,
    recursosElegiveis: recursos,
    status: "pendente",
    ...extra,
  };
}

export function ordem(codigo: string, operacoes: OperacaoEntrada[], extra: Partial<OrdemEntrada> = {}): OrdemEntrada {
  return {
    id: codigo,
    codigo,
    prioridade: 2,
    prazoEntrega: fimDoDia("2026-11-30", FUSO),
    operacoes: operacoes.map((o) => ({ ...o, id: `${codigo}:${o.nome}` })),
    ...extra,
  };
}

export function entrada(recursos: RecursoEntrada[], ordens: OrdemEntrada[], fixacoes: Fixacao[] = []) {
  return { agora: AGORA, horizonteFim: HORIZONTE, fuso: FUSO, recursos, ordens, fixacoes };
}

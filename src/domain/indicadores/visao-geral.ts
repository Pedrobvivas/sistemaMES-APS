// Cálculos da Visão geral. Funções puras: recebem os dados já lidos do banco.
// Regra geral: sem base de cálculo (denominador zero), o resultado é null e a tela mostra "—".
import { diaIsoLocal, somarDias } from "../tempo.ts";

export type Variacao = { tipo: "percentual" | "pontos"; valor: number } | null;

// a / b, ou null quando b é zero.
export function razao(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

// Variação percentual entre períodos (null se o período anterior não tem base).
export function variacaoPercentual(atual: number | null, anterior: number | null): Variacao {
  if (atual === null || anterior === null || anterior <= 0) return null;
  return { tipo: "percentual", valor: ((atual - anterior) / anterior) * 100 };
}

// Diferença em pontos percentuais entre duas taxas (0–1).
export function variacaoPontos(atual: number | null, anterior: number | null): Variacao {
  if (atual === null || anterior === null) return null;
  return { tipo: "pontos", valor: (atual - anterior) * 100 };
}

export type OrdemConcluida = { termino: number; prazoFim: number };

// Entregas no prazo: OPs cujo término real ficou até o fim do dia de entrega.
export function entregasNoPrazo(ordens: OrdemConcluida[]) {
  const noPrazo = ordens.filter((o) => o.termino <= o.prazoFim).length;
  return { noPrazo, total: ordens.length, taxa: razao(noPrazo, ordens.length) };
}

export type ApontamentoDia = { ocorridoEm: number; boa: number; rejeitada: number };
export type ProducaoDia = { dia: string; boa: number; rejeitada: number };

// Soma por dia local, preenchendo com zero os dias sem apontamento (do mais antigo ao mais recente).
export function producaoPorDia(apontamentos: ApontamentoDia[], ultimoDia: string, dias: number, fuso: string): ProducaoDia[] {
  const primeiro = somarDias(ultimoDia, -(dias - 1));
  const mapa = new Map<string, ProducaoDia>();
  for (let i = 0; i < dias; i++) {
    const d = somarDias(primeiro, i);
    mapa.set(d, { dia: d, boa: 0, rejeitada: 0 });
  }
  for (const a of apontamentos) {
    const linha = mapa.get(diaIsoLocal(a.ocorridoEm, fuso));
    if (!linha) continue;
    linha.boa += a.boa;
    linha.rejeitada += a.rejeitada;
  }
  return [...mapa.values()];
}

// Minutos de sobreposição entre trechos [inicio, fim) e a janela.
export function minutosNaJanela(trechos: { inicio: number; fim: number }[], de: number, ate: number) {
  let total = 0;
  for (const t of trechos) {
    const a = Math.max(t.inicio, de);
    const b = Math.min(t.fim, ate);
    if (b > a) total += b - a;
  }
  return total / 60_000;
}

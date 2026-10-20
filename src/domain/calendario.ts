// Disponibilidade de um recurso: turnos − feriados − indisponibilidades.
// E a busca do primeiro encaixe de uma operação nessa disponibilidade.
import { MINUTO, diaDaSemanaIso, diaIsoLocal, localParaInstante, somarDias } from "./tempo.ts";

export type Intervalo = { inicio: number; fim: number };

export type PeriodoTurno = {
  diaSemana: number; // 0 = domingo … 6 = sábado (dia em que o período começa)
  inicioMin: number; // minutos desde 00:00
  fimMin: number; // pode passar de 1440 quando o turno vira a noite
};

// Junta intervalos que se tocam ou se sobrepõem. Devolve ordenado.
export function unir(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = intervalos.filter((i) => i.fim > i.inicio).sort((a, b) => a.inicio - b.inicio);
  const saida: Intervalo[] = [];
  for (const i of ordenados) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && i.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, i.fim);
    else saida.push({ ...i });
  }
  return saida;
}

// base − remover (ambos podem vir em qualquer ordem).
export function subtrair(base: Intervalo[], remover: Intervalo[]): Intervalo[] {
  const r = unir(remover);
  const saida: Intervalo[] = [];
  for (const b of unir(base)) {
    let cursor = b.inicio;
    for (const x of r) {
      if (x.fim <= cursor || x.inicio >= b.fim) continue;
      if (x.inicio > cursor) saida.push({ inicio: cursor, fim: x.inicio });
      cursor = Math.max(cursor, x.fim);
      if (cursor >= b.fim) break;
    }
    if (cursor < b.fim) saida.push({ inicio: cursor, fim: b.fim });
  }
  return saida;
}

export type EntradaDisponibilidade = {
  periodos: PeriodoTurno[];
  feriados: Iterable<string>; // "2026-11-02"
  indisponibilidades: Intervalo[];
  de: number;
  ate: number;
  fuso: string;
};

export function gerarDisponibilidade(e: EntradaDisponibilidade): Intervalo[] {
  const feriados = new Set(e.feriados);
  const brutos: Intervalo[] = [];
  // Começa um dia antes para pegar turnos noturnos que entram na janela.
  let dia = somarDias(diaIsoLocal(e.de, e.fuso), -1);
  const ultimoDia = diaIsoLocal(e.ate, e.fuso);
  while (dia <= ultimoDia) {
    if (!feriados.has(dia)) {
      const semana = diaDaSemanaIso(dia);
      for (const p of e.periodos) {
        if (p.diaSemana !== semana || p.fimMin <= p.inicioMin) continue;
        brutos.push({ inicio: localParaInstante(dia, p.inicioMin, e.fuso), fim: localParaInstante(dia, p.fimMin, e.fuso) });
      }
    }
    dia = somarDias(dia, 1);
  }
  const janela = unir(brutos)
    .map((i) => ({ inicio: Math.max(i.inicio, e.de), fim: Math.min(i.fim, e.ate) }))
    .filter((i) => i.fim > i.inicio);
  return subtrair(janela, e.indisponibilidades);
}

// Primeiro instante ≥ t que está dentro de algum intervalo; null se não houver.
export function proximoDisponivel(disponivel: Intervalo[], t: number): number | null {
  for (const i of disponivel) {
    if (t < i.inicio) return i.inicio;
    if (t < i.fim) return t;
  }
  return null;
}

export type Encaixe = { inicio: number; fim: number; segmentos: Intervalo[] };

// Consome `minutos` de tempo disponível a partir de `inicio` (já disponível).
// A operação pode parar no fim de um turno e continuar no próximo.
function consumir(disponivel: Intervalo[], inicio: number, minutos: number): Encaixe | null {
  let restante = minutos * MINUTO;
  const segmentos: Intervalo[] = [];
  for (const i of disponivel) {
    if (i.fim <= inicio) continue;
    const de = Math.max(i.inicio, inicio);
    const usado = Math.min(i.fim - de, restante);
    segmentos.push({ inicio: de, fim: de + usado });
    restante -= usado;
    if (restante <= 0) return { inicio: segmentos[0].inicio, fim: de + usado, segmentos };
  }
  return null; // acabou o horizonte antes de terminar
}

export type Ocupacao = Intervalo & { operacaoId: string };

export type ResultadoEncaixe =
  | { ok: true; encaixe: Encaixe; bloqueadoPor: Ocupacao | null }
  | { ok: false; motivo: "sem_turno" | "fora_horizonte" };

// Primeiro encaixe com início ≥ `aPartirDe` que não cruza nenhuma ocupação
// do recurso entre o início e o fim (a operação não é dividida em volta de outra).
// `bloqueadoPor` informa a última ocupação que empurrou o início (para explicar).
export function encontrarEncaixe(
  disponivel: Intervalo[],
  ocupacoes: Ocupacao[],
  aPartirDe: number,
  minutos: number,
): ResultadoEncaixe {
  if (disponivel.length === 0) return { ok: false, motivo: "sem_turno" };
  let t = proximoDisponivel(disponivel, aPartirDe);
  let bloqueadoPor: Ocupacao | null = null;
  const duracao = Math.max(1, minutos);
  // Limite de segurança: cada volta avança t para depois de uma ocupação.
  for (let voltas = 0; voltas <= ocupacoes.length + 1; voltas++) {
    if (t === null) return { ok: false, motivo: "fora_horizonte" };
    const encaixe = consumir(disponivel, t, duracao);
    if (!encaixe) return { ok: false, motivo: "fora_horizonte" };
    const conflito = ocupacoes
      .filter((o) => o.inicio < encaixe.fim && o.fim > encaixe.inicio)
      .sort((a, b) => b.fim - a.fim)[0];
    if (!conflito) return { ok: true, encaixe, bloqueadoPor };
    bloqueadoPor = conflito;
    t = proximoDisponivel(disponivel, conflito.fim);
  }
  return { ok: false, motivo: "fora_horizonte" };
}

// Minutos disponíveis de um calendário dentro de uma janela.
export function minutosDisponiveis(disponivel: Intervalo[], de: number, ate: number) {
  let total = 0;
  for (const i of disponivel) {
    const a = Math.max(i.inicio, de);
    const b = Math.min(i.fim, ate);
    if (b > a) total += b - a;
  }
  return total / MINUTO;
}


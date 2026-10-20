// Conversões de data e hora no fuso da fábrica, sem dependências externas.
// Todo instante interno é um número em milissegundos (UTC); o fuso só entra
// para transformar "dia/hora do turno" em instante e vice-versa.

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

export const FUSO_PADRAO = "America/Sao_Paulo";

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatadorPartes(fuso: string) {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

const diasSemana: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type PartesLocais = {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
};

export function partesLocais(instante: number, fuso = FUSO_PADRAO): PartesLocais {
  const partes = Object.fromEntries(formatadorPartes(fuso).formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    diaSemana: diasSemana[partes.weekday],
  };
}

// Diferença (em ms) entre o relógio local e o UTC naquele instante.
function deslocamento(instante: number, fuso: string) {
  const p = partesLocais(instante, fuso);
  const segundos = new Date(instante).getUTCSeconds();
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, segundos);
  return comoUtc - (instante - (instante % 1000));
}

// "2026-10-23" + 480 minutos (08:00) no fuso → instante UTC.
// Minutos acima de 1440 caem no dia seguinte (turno que passa da meia-noite).
export function localParaInstante(diaIso: string, minutosDoDia: number, fuso = FUSO_PADRAO) {
  const [ano, mes, dia] = diaIso.split("-").map(Number);
  const comoUtc = Date.UTC(ano, mes - 1, dia, 0, minutosDoDia);
  let palpite = comoUtc - deslocamento(comoUtc, fuso);
  // Segunda passada corrige mudanças de horário de verão perto do instante.
  palpite = comoUtc - deslocamento(palpite, fuso);
  return palpite;
}

export function diaIsoLocal(instante: number, fuso = FUSO_PADRAO) {
  const p = partesLocais(instante, fuso);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

// Soma dias a uma data ISO, sem passar por fuso.
export function somarDias(diaIso: string, dias: number) {
  const [ano, mes, dia] = diaIso.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

export function diaDaSemanaIso(diaIso: string) {
  const [ano, mes, dia] = diaIso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

// Fim do dia local (23:59:59.999) — usado para comparar com a data de entrega.
export function fimDoDia(diaIso: string, fuso = FUSO_PADRAO) {
  return localParaInstante(somarDias(diaIso, 1), 0, fuso) - 1;
}

const formatosCurtos = new Map<string, Intl.DateTimeFormat>();

// "23/10 08:00" — para mensagens e justificativas.
export function formatarCurto(instante: number, fuso = FUSO_PADRAO) {
  let f = formatosCurtos.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("pt-BR", {
      timeZone: fuso,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatosCurtos.set(fuso, f);
  }
  return f.format(new Date(instante)).replace(",", "");
}

export function formatarDuracao(minutos: number) {
  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  if (h < 24 || resto !== 0) return resto ? `${h} h ${resto} min` : `${h} h`;
  return `${h} h`;
}

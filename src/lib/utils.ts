import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Junta classes do Tailwind resolvendo conflitos (ex.: cn("p-2", "p-4") → "p-4").
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Projeto Base";

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatarData(data: Date | string) {
  return dataHora.format(typeof data === "string" ? new Date(data) : data);
}

// Para colunas `date` do banco ("2026-10-13"): formata sem passar por fuso horário,
// senão a meia-noite UTC vira o dia anterior no Brasil.
export function formatarDiaIso(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarMoeda(valor: number | string) {
  return moeda.format(typeof valor === "string" ? Number(valor) : valor);
}

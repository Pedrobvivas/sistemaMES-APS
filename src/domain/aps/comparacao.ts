// Antes × depois entre duas programações: o que mudou para cada OP.
import { MINUTO } from "../tempo.ts";
import type { Metricas, ResumoOrdem } from "./tipos.ts";

export type MudancaOrdem = {
  ordemId: string;
  fimAntes: number | null;
  fimDepois: number | null;
  deltaMin: number | null; // positivo = termina mais tarde
  atrasoAntesMin: number;
  atrasoDepoisMin: number;
  situacao: "atrasou" | "adiantou" | "passou_a_atrasar" | "saiu_do_atraso" | "igual" | "sem_programacao";
};

export function compararProgramacoes(antes: ResumoOrdem[], depois: ResumoOrdem[]): MudancaOrdem[] {
  const mapaAntes = new Map(antes.map((r) => [r.ordemId, r]));
  const lista = depois.map((d): MudancaOrdem => {
    const a = mapaAntes.get(d.ordemId);
    const fimAntes = a?.fimPrevisto ?? null;
    const fimDepois = d.fimPrevisto;
    const deltaMin = fimAntes !== null && fimDepois !== null ? Math.round((fimDepois - fimAntes) / MINUTO) : null;
    const atrasoAntesMin = a?.atrasoMin ?? 0;
    const atrasoDepoisMin = d.atrasoMin;
    let situacao: MudancaOrdem["situacao"] = "igual";
    if (fimDepois === null) situacao = "sem_programacao";
    else if (atrasoAntesMin === 0 && atrasoDepoisMin > 0) situacao = "passou_a_atrasar";
    else if (atrasoAntesMin > 0 && atrasoDepoisMin === 0) situacao = "saiu_do_atraso";
    else if (deltaMin !== null && deltaMin > 0) situacao = "atrasou";
    else if (deltaMin !== null && deltaMin < 0) situacao = "adiantou";
    return { ordemId: d.ordemId, fimAntes, fimDepois, deltaMin, atrasoAntesMin, atrasoDepoisMin, situacao };
  });
  const peso: Record<MudancaOrdem["situacao"], number> = {
    passou_a_atrasar: 0,
    sem_programacao: 1,
    atrasou: 2,
    saiu_do_atraso: 3,
    adiantou: 4,
    igual: 5,
  };
  return lista.sort((x, y) => peso[x.situacao] - peso[y.situacao] || Math.abs(y.deltaMin ?? 0) - Math.abs(x.deltaMin ?? 0));
}

export type ComparacaoMetricas = { chave: keyof Metricas; rotulo: string; antes: number; depois: number; melhorQuandoMenor: boolean }[];

export function compararMetricas(antes: Metricas, depois: Metricas): ComparacaoMetricas {
  const linhas: [keyof Metricas, string, boolean][] = [
    ["ordensAtrasadas", "OPs atrasadas", true],
    ["atrasoTotalMin", "Atraso total (min)", true],
    ["operacoesNaoProgramadas", "Operações sem programação", true],
    ["ociosidadeMin", "Tempo ocioso dos recursos (min)", true],
    ["operacoesComSetup", "Preparações (setups)", true],
  ];
  return linhas.map(([chave, rotulo, melhorQuandoMenor]) => ({
    chave,
    rotulo,
    antes: Number(antes[chave] ?? 0),
    depois: Number(depois[chave] ?? 0),
    melhorQuandoMenor,
  }));
}

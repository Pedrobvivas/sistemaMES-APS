// Organização das linhas do Gantt: por recurso, por OP ou por cliente, com filtros.
// Função pura (sem React): recebe barras e recursos, devolve grupos, faixas e a posição de cada barra.
import { fimDoDia } from "../tempo.ts";

export type Visao = "recurso" | "op" | "cliente";
export type Situacao = "todas" | "atrasadas" | "fixadas" | "em_execucao";

export type Filtros = {
  texto: string; // código da OP, produto ou cliente
  cliente: string; // "" = todos; SEM_CLIENTE = OPs sem cliente
  centroId: string; // "" = todos
  situacao: Situacao;
};

export const SEM_CLIENTE = "__sem_cliente__";
export const FILTROS_VAZIOS: Filtros = { texto: "", cliente: "", centroId: "", situacao: "todas" };

export type BarraLayout = {
  operacaoId: string;
  ordemId: string;
  ordemCodigo: string;
  recursoId: string;
  inicio: number;
  fim: number;
  produto: string;
  cliente: string | null;
  prazo: string; // "2026-11-05"
  atrasoMin: number;
  fixada: boolean;
  emExecucao: boolean;
};

export type RecursoLayout = { id: string; codigo: string; nome: string; centroId: string; centroNome: string };

export type Grupo = { id: string; titulo: string; topo: number };
export type Faixa =
  | { tipo: "recurso"; id: string; recursoId: string; titulo: string; subtitulo: string; topo: number; altura: number }
  | { tipo: "op"; id: string; ordemId: string; titulo: string; subtitulo: string; topo: number; altura: number; prazoFim: number; atrasoMin: number };

export type Layout = {
  grupos: Grupo[];
  faixas: Faixa[];
  topoDaBarra: Map<string, number>; // operacaoId → topo (px) da barra
  altura: number;
  ordensVisiveis: number;
  totalOrdens: number;
  filtroAtivo: boolean;
};

export const ALTURA_GRUPO = 30;
export const ALTURA_FAIXA = 52; // uma barra
export const ALTURA_SUBLINHA = 40; // cada barra extra empilhada (operações em paralelo)
export const MARGEM_BARRA = 8;

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function filtroAtivo(f: Filtros) {
  return f.texto.trim() !== "" || f.cliente !== "" || f.centroId !== "" || f.situacao !== "todas";
}

// OPs que passam nos filtros de OP (texto, cliente, situação).
function ordensFiltradas(barras: BarraLayout[], f: Filtros) {
  const porOrdem = new Map<string, BarraLayout[]>();
  for (const b of barras) porOrdem.set(b.ordemId, [...(porOrdem.get(b.ordemId) ?? []), b]);
  const termo = normalizar(f.texto);
  const ok = new Set<string>();
  for (const [ordemId, lista] of porOrdem) {
    const b = lista[0];
    if (termo && !normalizar(`${b.ordemCodigo} ${b.produto} ${b.cliente ?? ""}`).includes(termo)) continue;
    if (f.cliente === SEM_CLIENTE ? b.cliente !== null : f.cliente && b.cliente !== f.cliente) continue;
    if (f.situacao === "atrasadas" && !lista.some((x) => x.atrasoMin > 0)) continue;
    if (f.situacao === "fixadas" && !lista.some((x) => x.fixada)) continue;
    if (f.situacao === "em_execucao" && !lista.some((x) => x.emExecucao)) continue;
    ok.add(ordemId);
  }
  return { ok, total: porOrdem.size };
}

// Distribui barras que se sobrepõem em sublinhas (primeira sublinha livre).
function empilhar(barras: BarraLayout[]) {
  const fins: number[] = [];
  const sub = new Map<string, number>();
  for (const b of [...barras].sort((x, y) => x.inicio - y.inicio || x.operacaoId.localeCompare(y.operacaoId))) {
    let i = fins.findIndex((f) => f <= b.inicio);
    if (i === -1) {
      i = fins.length;
      fins.push(0);
    }
    fins[i] = b.fim;
    sub.set(b.operacaoId, i);
  }
  return { sub, linhas: Math.max(1, fins.length) };
}

function formatarPrazo(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function montarLayout(entrada: { visao: Visao; filtros: Filtros; barras: BarraLayout[]; recursos: RecursoLayout[]; fuso: string }): Layout {
  const { visao, filtros, recursos, fuso } = entrada;
  const centroDoRecurso = new Map(recursos.map((r) => [r.id, r.centroId]));
  const { ok: ordensOk, total: totalOrdens } = ordensFiltradas(entrada.barras, filtros);
  const barras = entrada.barras.filter(
    (b) => ordensOk.has(b.ordemId) && (!filtros.centroId || centroDoRecurso.get(b.recursoId) === filtros.centroId),
  );
  const ativo = filtroAtivo(filtros);
  const grupos: Grupo[] = [];
  const faixas: Faixa[] = [];
  const topoDaBarra = new Map<string, number>();
  let topo = 0;

  if (visao === "recurso") {
    // Com filtro de OP/cliente/situação, esconde recursos sem barra; só com filtro de centro, mostra o centro inteiro.
    const esconderVazios = filtros.texto.trim() !== "" || filtros.cliente !== "" || filtros.situacao !== "todas";
    const comBarra = new Set(barras.map((b) => b.recursoId));
    let centroAtual = "";
    for (const r of recursos) {
      if (filtros.centroId && r.centroId !== filtros.centroId) continue;
      if (esconderVazios && !comBarra.has(r.id)) continue;
      if (r.centroId !== centroAtual) {
        grupos.push({ id: r.centroId, titulo: r.centroNome, topo });
        topo += ALTURA_GRUPO;
        centroAtual = r.centroId;
      }
      faixas.push({ tipo: "recurso", id: r.id, recursoId: r.id, titulo: r.nome, subtitulo: r.codigo, topo, altura: ALTURA_FAIXA });
      for (const b of barras) if (b.recursoId === r.id) topoDaBarra.set(b.operacaoId, topo + MARGEM_BARRA);
      topo += ALTURA_FAIXA;
    }
  } else {
    const porOrdem = new Map<string, BarraLayout[]>();
    for (const b of barras) porOrdem.set(b.ordemId, [...(porOrdem.get(b.ordemId) ?? []), b]);
    const ordens = [...porOrdem.values()].sort(
      (a, b) => Math.min(...a.map((x) => x.inicio)) - Math.min(...b.map((x) => x.inicio)) || a[0].ordemCodigo.localeCompare(b[0].ordemCodigo, "pt-BR"),
    );
    const blocos: { titulo: string; id: string; ordens: BarraLayout[][] }[] =
      visao === "op"
        ? [{ titulo: "", id: "", ordens }]
        : [...new Set(ordens.map((o) => o[0].cliente ?? SEM_CLIENTE))]
            .sort((a, b) => (a === SEM_CLIENTE ? 1 : b === SEM_CLIENTE ? -1 : a.localeCompare(b, "pt-BR")))
            .map((c) => ({
              id: c,
              titulo: c === SEM_CLIENTE ? "Sem cliente" : c,
              ordens: ordens.filter((o) => (o[0].cliente ?? SEM_CLIENTE) === c),
            }));
    for (const bloco of blocos) {
      if (bloco.titulo) {
        grupos.push({ id: bloco.id, titulo: `${bloco.titulo} · ${bloco.ordens.length} OP${bloco.ordens.length > 1 ? "s" : ""}`, topo });
        topo += ALTURA_GRUPO;
      }
      for (const lista of bloco.ordens) {
        const b = lista[0];
        const { sub, linhas } = empilhar(lista);
        const altura = ALTURA_FAIXA + (linhas - 1) * ALTURA_SUBLINHA;
        faixas.push({
          tipo: "op",
          id: b.ordemId,
          ordemId: b.ordemId,
          titulo: `OP ${b.ordemCodigo}`,
          subtitulo: `${b.produto} · entrega ${formatarPrazo(b.prazo)}`,
          topo,
          altura,
          prazoFim: fimDoDia(b.prazo, fuso),
          atrasoMin: Math.max(...lista.map((x) => x.atrasoMin)),
        });
        for (const x of lista) topoDaBarra.set(x.operacaoId, topo + MARGEM_BARRA + sub.get(x.operacaoId)! * ALTURA_SUBLINHA);
        topo += altura;
      }
    }
  }

  return { grupos, faixas, topoDaBarra, altura: topo, ordensVisiveis: new Set(barras.map((b) => b.ordemId)).size, totalOrdens, filtroAtivo: ativo };
}

"use client";

// Gantt com arraste, visto por recurso, por OP ou por cliente, com filtros.
// Soltar uma barra gera uma NOVA programação sugerida (o servidor reprograma tudo pela fila);
// a versão aprovada só muda quando alguém aprova a sugerida.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icone } from "@/components/layout/icone";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import {
  ALTURA_FAIXA,
  ALTURA_GRUPO,
  FILTROS_VAZIOS,
  MARGEM_BARRA,
  SEM_CLIENTE,
  montarLayout,
  type Filtros,
  type Situacao,
  type Visao,
} from "@/domain/aps/layout-gantt";
import { HORA, MINUTO, diaIsoLocal, formatarCurto, localParaInstante, partesLocais, somarDias } from "@/domain/tempo";
import { cn } from "@/lib/utils";
import type { DadosGantt, ItemGantt } from "@/server/aps/gantt";
import { simularArraste } from "./actions";
import { PainelDetalhe } from "./painel-detalhe";

type Zoom = "dia" | "semana" | "mes";
type Modo = "ordem" | "operacao";

const PX_HORA: Record<Zoom, number> = { dia: 44, semana: 11, mes: 3.5 };
const ALTURA_BARRA = ALTURA_FAIXA - 2 * MARGEM_BARRA;
const PASSO = 15 * MINUTO; // o arraste anda de 15 em 15 minutos
const LIMIAR_ARRASTE = 5; // px antes de considerar arraste (abaixo disso é clique)

const rotuloVisao: Record<Visao, string> = { recurso: "Recurso", op: "OP", cliente: "Cliente" };
const rotuloSituacao: Record<Situacao, string> = { todas: "Todas", atrasadas: "Só atrasadas", fixadas: "Com data fixada", em_execucao: "Em execução" };

type Arraste = {
  item: ItemGantt;
  x0: number;
  y0: number;
  dx: number;
  ativo: boolean;
  recursoAlvo: string;
  novoInicio: number;
  motivo: string | null; // por que não pode soltar ali
};

// Visão e filtros ficam no endereço (?ver=op&cliente=...), para recarregar e compartilhar.
function lerDoEndereco(): { visao: Visao; filtros: Filtros } {
  const p = new URLSearchParams(window.location.search);
  const ver = p.get("ver");
  const situacao = p.get("situacao");
  return {
    visao: ver === "op" || ver === "cliente" ? ver : "recurso",
    filtros: {
      texto: p.get("busca") ?? "",
      cliente: p.get("cliente") ?? "",
      centroId: p.get("centro") ?? "",
      situacao: situacao === "atrasadas" || situacao === "fixadas" || situacao === "em_execucao" ? situacao : "todas",
    },
  };
}

function gravarNoEndereco(visao: Visao, f: Filtros) {
  const p = new URLSearchParams(window.location.search);
  const definir = (k: string, v: string, padrao = "") => (v && v !== padrao ? p.set(k, v) : p.delete(k));
  definir("ver", visao, "recurso");
  definir("busca", f.texto.trim());
  definir("cliente", f.cliente);
  definir("centro", f.centroId);
  definir("situacao", f.situacao, "todas");
  const qs = p.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

export function Gantt({ dados, podeEditar }: { dados: DadosGantt; podeEditar: boolean }) {
  const router = useRouter();
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [modo, setModo] = useState<Modo>("ordem");
  const [visao, setVisao] = useState<Visao>("recurso");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [prontoEndereco, setProntoEndereco] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [arraste, setArraste] = useState<Arraste | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const [agora, setAgora] = useState(dados.programacao.agora);
  const rolagem = useRef<HTMLDivElement>(null);
  const linhasRef = useRef<HTMLDivElement>(null);

  const { janela, fuso } = dados;
  const px = PX_HORA[zoom];
  const xDe = (t: number) => ((t - janela.inicio) / HORA) * px;
  const largura = xDe(janela.fim);
  const editavel = podeEditar && (dados.programacao.status === "aprovada" || dados.programacao.status === "sugerida");
  const porRecurso = visao === "recurso";

  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const inicial = lerDoEndereco();
    setVisao(inicial.visao);
    setFiltros(inicial.filtros);
    setProntoEndereco(true);
  }, []);

  useEffect(() => {
    if (prontoEndereco) gravarNoEndereco(visao, filtros);
  }, [visao, filtros, prontoEndereco]);

  // Começa mostrando "agora" perto da esquerda.
  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollLeft = Math.max(0, xDe(Date.now()) - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const recursos = useMemo(
    () => dados.centros.flatMap((c) => c.recursos.map((r) => ({ id: r.id, codigo: r.codigo, nome: r.nome, centroId: c.id, centroNome: c.nome }))),
    [dados.centros],
  );
  const recursoPorId = useMemo(() => new Map(dados.centros.flatMap((c) => c.recursos.map((r) => [r.id, r] as const))), [dados.centros]);
  const nomeRecurso = useMemo(() => new Map(recursos.map((r) => [r.id, r.nome] as const)), [recursos]);
  const clientes = useMemo(() => [...new Set(dados.itens.map((i) => i.cliente).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "pt-BR")), [dados.itens]);
  const temSemCliente = dados.itens.some((i) => !i.cliente);

  const layout = useMemo(
    () => montarLayout({ visao, filtros, barras: dados.itens, recursos, fuso }),
    [visao, filtros, dados.itens, recursos, fuso],
  );
  const linhas = useMemo(
    () =>
      [...layout.grupos.map((g) => ({ tipo: "grupo" as const, ...g })), ...layout.faixas.map((f) => ({ ...f, tipoLinha: "faixa" as const }))].sort(
        (a, b) => a.topo - b.topo,
      ),
    [layout],
  );
  const topoFaixaRecurso = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of layout.faixas) if (f.tipo === "recurso") m.set(f.recursoId, f.topo);
    return m;
  }, [layout]);

  const itensPorOrdem = useMemo(() => {
    const m = new Map<string, ItemGantt[]>();
    for (const i of dados.itens) m.set(i.ordemId, [...(m.get(i.ordemId) ?? []), i]);
    return m;
  }, [dados.itens]);

  // Dias da janela para a escala de tempo.
  const dias = useMemo(() => {
    const lista: { iso: string; inicio: number; fim: number }[] = [];
    let d = diaIsoLocal(janela.inicio, fuso);
    while (true) {
      const inicio = localParaInstante(d, 0, fuso);
      if (inicio >= janela.fim) break;
      lista.push({ iso: d, inicio, fim: localParaInstante(somarDias(d, 1), 0, fuso) });
      d = somarDias(d, 1);
    }
    return lista;
  }, [janela, fuso]);

  function recursoNaPosicao(clientY: number) {
    if (!porRecurso) return null;
    const area = linhasRef.current?.getBoundingClientRect();
    if (!area) return null;
    const y = clientY - area.top;
    const faixa = layout.faixas.find((f) => f.tipo === "recurso" && y >= f.topo && y < f.topo + f.altura);
    return faixa?.tipo === "recurso" ? faixa.recursoId : null;
  }

  function validar(item: ItemGantt, novoInicio: number, recursoAlvo: string): string | null {
    if (novoInicio < Date.now() - 5 * MINUTO) return "Não é possível programar para antes de agora.";
    if (modo === "operacao") {
      if (!item.elegiveis.includes(recursoAlvo)) return `${nomeRecurso.get(recursoAlvo) ?? "Este recurso"} não está habilitado para "${item.operacaoNome}".`;
      const irmas = itensPorOrdem.get(item.ordemId) ?? [];
      const anteriores = irmas.filter((i) => i.sequencia < item.sequencia);
      if (anteriores.length) {
        const nivel = Math.max(...anteriores.map((i) => i.sequencia));
        const bloqueio = anteriores.filter((i) => i.sequencia === nivel).sort((a, b) => b.fim - a.fim)[0];
        if (bloqueio && bloqueio.fim > novoInicio) {
          return `Depende de "${bloqueio.operacaoNome}", que termina em ${formatarCurto(bloqueio.fim, fuso)}.`;
        }
      }
    }
    return null;
  }

  function aoPressionar(e: React.PointerEvent, item: ItemGantt) {
    if (e.button !== 0) return;
    setErro(null);
    if (!editavel || item.emExecucao || item.statusOperacao !== "pendente" || enviando) {
      setSelecionado(item.operacaoId);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setArraste({ item, x0: e.clientX, y0: e.clientY, dx: 0, ativo: false, recursoAlvo: item.recursoId, novoInicio: item.inicio, motivo: null });
  }

  function aoMover(e: React.PointerEvent) {
    if (!arraste) return;
    const dx = e.clientX - arraste.x0;
    const dy = e.clientY - arraste.y0;
    const ativo = arraste.ativo || Math.abs(dx) > LIMIAR_ARRASTE || Math.abs(dy) > LIMIAR_ARRASTE;
    if (!ativo) return;
    const bruto = arraste.item.inicio + (dx / px) * HORA;
    const novoInicio = Math.round(bruto / PASSO) * PASSO;
    // Trocar de recurso só na visão por recurso (nas outras, as linhas são OPs).
    const recursoAlvo = modo === "operacao" && porRecurso ? (recursoNaPosicao(e.clientY) ?? arraste.recursoAlvo) : arraste.item.recursoId;
    setArraste({ ...arraste, dx, ativo, novoInicio, recursoAlvo, motivo: validar(arraste.item, novoInicio, recursoAlvo) });
  }

  function aoSoltar() {
    const a = arraste;
    setArraste(null);
    if (!a) return;
    if (!a.ativo) {
      setSelecionado(a.item.operacaoId);
      return;
    }
    const mudou = a.novoInicio !== a.item.inicio || a.recursoAlvo !== a.item.recursoId;
    if (!mudou) return;
    if (a.motivo) {
      setErro(a.motivo);
      return;
    }
    mover({ operacaoId: a.item.operacaoId, novoInicio: a.novoInicio, recursoId: modo === "operacao" ? a.recursoAlvo : null, modo });
  }

  function mover(cmd: { operacaoId: string; novoInicio: number; recursoId: string | null; modo: Modo }) {
    iniciar(async () => {
      const r = await simularArraste({ programacaoId: dados.programacao.id, ...cmd });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setSelecionado(null);
      // Mantém a visão e os filtros na nova versão.
      const p = new URLSearchParams(window.location.search);
      p.set("versao", r.programacaoId!);
      router.push(`/programacao?${p.toString()}`);
    });
  }

  // Topo (px) da barra de um item, onde ele está ou para onde está sendo arrastado.
  function topoBarra(item: ItemGantt, recursoId = item.recursoId) {
    if (porRecurso) {
      const t = topoFaixaRecurso.get(recursoId);
      return t === undefined ? undefined : t + MARGEM_BARRA;
    }
    return layout.topoDaBarra.get(item.operacaoId);
  }

  // Deslocamento de cada barra durante o arraste (fantasma).
  function posicaoFantasma(item: ItemGantt) {
    if (!arraste?.ativo) return null;
    const delta = arraste.novoInicio - arraste.item.inicio;
    if (item.operacaoId === arraste.item.operacaoId) {
      return { inicio: arraste.novoInicio, fim: item.fim + delta, recursoId: arraste.recursoAlvo };
    }
    // Modo OP inteira: as demais operações pendentes da mesma OP acompanham (prévia aproximada).
    if (modo === "ordem" && item.ordemId === arraste.item.ordemId && !item.emExecucao) {
      return { inicio: item.inicio + delta, fim: item.fim + delta, recursoId: item.recursoId };
    }
    return null;
  }

  const atualizarFiltro = (parcial: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...parcial }));
  const itemSelecionado = dados.itens.find((i) => i.operacaoId === selecionado) ?? null;
  const ordemEmFoco = arraste?.item.ordemId ?? destaque ?? itemSelecionado?.ordemId ?? null;
  const topoDica = arraste?.ativo ? topoBarra(arraste.item, arraste.recursoAlvo) : undefined;

  return (
    <div id="gantt" className="flex flex-col gap-3">
      {/* Visão e filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-borda bg-surface-2 p-3">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs font-semibold text-muted">Ver por</legend>
          <div className="flex items-center gap-1 rounded-md border border-borda bg-surface p-1">
            {(Object.keys(rotuloVisao) as Visao[]).map((v) => (
              <label
                key={v}
                className={cn(
                  "flex h-9 cursor-pointer items-center rounded-sm px-3 text-sm font-semibold",
                  visao === v ? "degrade-marca text-primaria-texto" : "text-muted hover:text-ink",
                )}
              >
                <input type="radio" name="visao" value={v} checked={visao === v} onChange={() => setVisao(v)} className="sr-only" />
                {rotuloVisao[v]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor="filtro-busca" className="text-xs font-semibold text-muted">
            Buscar OP
          </label>
          <Input
            id="filtro-busca"
            type="search"
            className="h-11"
            placeholder="Código, produto ou cliente"
            value={filtros.texto}
            onChange={(e) => atualizarFiltro({ texto: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-cliente" className="text-xs font-semibold text-muted">
            Cliente
          </label>
          <Select id="filtro-cliente" className="w-48" value={filtros.cliente} onChange={(e) => atualizarFiltro({ cliente: e.target.value })}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {temSemCliente && <option value={SEM_CLIENTE}>Sem cliente</option>}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-centro" className="text-xs font-semibold text-muted">
            Centro de trabalho
          </label>
          <Select id="filtro-centro" className="w-48" value={filtros.centroId} onChange={(e) => atualizarFiltro({ centroId: e.target.value })}>
            <option value="">Todos</option>
            {dados.centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-situacao" className="text-xs font-semibold text-muted">
            Situação
          </label>
          <Select id="filtro-situacao" className="w-44" value={filtros.situacao} onChange={(e) => atualizarFiltro({ situacao: e.target.value as Situacao })}>
            {(Object.keys(rotuloSituacao) as Situacao[]).map((s) => (
              <option key={s} value={s}>
                {rotuloSituacao[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex min-h-11 items-center gap-3">
          <p className="text-xs text-muted" aria-live="polite">
            {layout.ordensVisiveis} de {layout.totalOrdens} OPs
          </p>
          {layout.filtroAtivo && (
            <Button variante="fantasma" tamanho="sm" onClick={() => setFiltros(FILTROS_VAZIOS)}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-3">
        {editavel && (
          <fieldset className="flex items-center gap-1 rounded-md border border-borda p-1" aria-label="O que o arraste move">
            <legend className="sr-only">O que o arraste move</legend>
            {(
              [
                ["ordem", "OP inteira"],
                ["operacao", "Só a operação"],
              ] as const
            ).map(([valor, rotulo]) => (
              <label
                key={valor}
                className={cn(
                  "flex h-9 cursor-pointer items-center rounded-sm px-3 text-sm font-semibold",
                  modo === valor ? "bg-primaria text-primaria-texto" : "text-muted hover:text-ink",
                )}
              >
                <input type="radio" name="modo" value={valor} checked={modo === valor} onChange={() => setModo(valor)} className="sr-only" />
                {rotulo}
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className="flex items-center gap-1 rounded-md border border-borda p-1">
          <legend className="sr-only">Escala de tempo</legend>
          {(
            [
              ["dia", "Dia"],
              ["semana", "Semana"],
              ["mes", "Mês"],
            ] as const
          ).map(([valor, rotulo]) => (
            <label
              key={valor}
              className={cn(
                "flex h-9 cursor-pointer items-center rounded-sm px-3 text-sm font-semibold",
                zoom === valor ? "bg-surface text-ink" : "text-muted hover:text-ink",
              )}
            >
              <input type="radio" name="zoom" value={valor} checked={zoom === valor} onChange={() => setZoom(valor)} className="sr-only" />
              {rotulo}
            </label>
          ))}
        </fieldset>
        <Button
          variante="secundaria"
          tamanho="sm"
          onClick={() => {
            if (rolagem.current) rolagem.current.scrollLeft = Math.max(0, xDe(Date.now()) - 120);
          }}
        >
          Agora
        </Button>
        <Legenda porRecurso={porRecurso} />
      </div>

      {editavel && (
        <p className="text-xs text-muted">
          Arraste uma barra para outra data{modo === "operacao" && porRecurso ? " ou para outro recurso elegível" : ""}: o sistema reprograma todas as OPs pela
          fila e mostra o antes × depois para você aprovar. Clique na barra para ver detalhes ou mover por data exata.
          {modo === "operacao" && !porRecurso && " Para trocar de recurso, use a visão por recurso."}
        </p>
      )}
      {erro && (
        <Alerta>
          <span className="flex items-start justify-between gap-3">
            {erro}
            <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso" className="text-muted hover:text-ink">
              <Icone nome="fechar" tamanho={16} />
            </button>
          </span>
        </Alerta>
      )}

      {layout.faixas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-borda px-6 py-12 text-center">
          <p className="font-display text-lg font-bold">Nenhuma OP com esses filtros</p>
          <Button variante="secundaria" onClick={() => setFiltros(FILTROS_VAZIOS)}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="relative flex overflow-hidden rounded-md border border-borda">
          {enviando && (
            <div role="status" className="absolute inset-0 z-30 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]">
              <p className="flex items-center gap-2 rounded-md border border-borda bg-surface-2 px-4 py-3 text-sm font-semibold">
                <Icone nome="atualizar" tamanho={18} /> Reprogramando todas as OPs…
              </p>
            </div>
          )}

          {/* Coluna da esquerda: recursos ou OPs */}
          <div className="w-36 shrink-0 border-r border-borda bg-surface-2 sm:w-56">
            <div className="h-12 border-b border-borda px-3 py-2 text-xs font-semibold text-muted">{porRecurso ? "Recurso" : "OP"}</div>
            <div className="relative" style={{ height: layout.altura }}>
              {linhas.map((l) =>
                l.tipo === "grupo" ? (
                  <div
                    key={`g-${l.id}`}
                    className="absolute inset-x-0 flex items-center border-b border-borda bg-surface px-3 text-xs font-bold uppercase tracking-wide text-muted"
                    style={{ top: l.topo, height: ALTURA_GRUPO }}
                  >
                    <span className="truncate">{l.titulo}</span>
                  </div>
                ) : (
                  <div
                    key={`f-${l.id}`}
                    className={cn(
                      "absolute inset-x-0 flex flex-col justify-center border-b border-borda px-3",
                      l.tipo === "recurso" && arraste?.ativo && modo === "operacao" && arraste.item.elegiveis.includes(l.recursoId) && "bg-primaria/15",
                      l.tipo === "op" && ordemEmFoco === l.ordemId && "bg-primaria/10",
                    )}
                    style={{ top: l.topo, height: l.altura }}
                  >
                    {l.tipo === "op" ? (
                      <a href={`/ordens/${l.ordemId}`} className="flex items-center gap-1 truncate text-sm font-semibold hover:text-destaque">
                        {l.atrasoMin > 0 && <Icone nome="alerta" tamanho={13} />}
                        {l.titulo}
                      </a>
                    ) : (
                      <span className="truncate text-sm font-semibold">{l.titulo}</span>
                    )}
                    <span className={cn("truncate text-xs text-muted", l.tipo === "recurso" && "font-mono")}>{l.subtitulo}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Área do tempo */}
          <div ref={rolagem} className="min-w-0 flex-1 overflow-x-auto">
            <div style={{ width: largura }} className="relative">
              <Escala dias={dias} xDe={xDe} zoom={zoom} fuso={fuso} />
              <div ref={linhasRef} className="relative" style={{ height: layout.altura }} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={() => setArraste(null)}>
                {/* Fundo: grupos, turnos, indisponibilidades e prazos */}
                {linhas.map((l) => {
                  if (l.tipo === "grupo") {
                    return <div key={`g-${l.id}`} className="absolute left-0 right-0 border-b border-borda bg-surface-2/60" style={{ top: l.topo, height: ALTURA_GRUPO }} />;
                  }
                  if (l.tipo === "op") {
                    return (
                      <div key={`f-${l.id}`} className="absolute left-0 right-0 border-b border-borda bg-surface" style={{ top: l.topo, height: l.altura }}>
                        {l.prazoFim >= janela.inicio && l.prazoFim <= janela.fim && (
                          <div
                            className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-ink/70"
                            style={{ left: xDe(l.prazoFim) }}
                            title={`Entrega: ${formatarCurto(l.prazoFim, fuso).slice(0, 5)}`}
                          >
                            <span className="absolute bottom-0.5 left-1 rounded-sm bg-ink px-1 text-[10px] font-bold text-surface">entrega</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  const r = recursoPorId.get(l.recursoId);
                  return (
                    <div key={`f-${l.id}`} className="absolute left-0 right-0 border-b border-borda bg-fora-turno" style={{ top: l.topo, height: l.altura }}>
                      {r?.disponibilidade.map((d) => (
                        <div key={d.inicio} className="absolute inset-y-0 bg-surface" style={{ left: xDe(d.inicio), width: Math.max(1, xDe(d.fim) - xDe(d.inicio)) }} />
                      ))}
                      {r?.paradas.map((p) => (
                        <div
                          key={p.inicio}
                          title={`Indisponível: ${p.motivo} (${formatarCurto(p.inicio, fuso)} → ${formatarCurto(p.fim, fuso)})`}
                          className="absolute inset-y-0"
                          style={{
                            left: xDe(p.inicio),
                            width: Math.max(2, xDe(p.fim) - xDe(p.inicio)),
                            background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--erro) 30%, transparent) 0 5px, transparent 5px 10px)",
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
                {/* Linhas dos dias */}
                {dias.map((d) => (
                  <div key={d.iso} className="pointer-events-none absolute inset-y-0 border-l border-borda/70" style={{ left: xDe(d.inicio) }} />
                ))}
                {/* Agora */}
                {agora >= janela.inicio && agora <= janela.fim && (
                  <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-erro" style={{ left: xDe(agora) }}>
                    <span className="absolute -top-0 left-1 rounded-sm bg-erro px-1 text-[10px] font-bold text-surface">agora</span>
                  </div>
                )}

                {/* Barras */}
                {dados.itens.map((item) => {
                  const topo = layout.topoDaBarra.get(item.operacaoId);
                  if (topo === undefined) return null;
                  const fantasma = posicaoFantasma(item);
                  const topoFantasma = fantasma ? topoBarra(item, fantasma.recursoId) : undefined;
                  const apagada = ordemEmFoco !== null && ordemEmFoco !== item.ordemId;
                  return (
                    <div key={item.operacaoId}>
                      <Barra
                        item={item}
                        rotulo={porRecurso ? `${item.ordemCodigo} · ${item.operacaoNome}` : `${item.operacaoNome} · ${nomeRecurso.get(item.recursoId) ?? ""}`}
                        x={xDe(item.inicio)}
                        largura={Math.max(6, xDe(item.fim) - xDe(item.inicio))}
                        topo={topo}
                        xDe={xDe}
                        apagada={apagada || !!fantasma}
                        selecionada={selecionado === item.operacaoId}
                        arrastavel={editavel && !item.emExecucao && item.statusOperacao === "pendente"}
                        fuso={fuso}
                        recursoNome={nomeRecurso.get(item.recursoId) ?? ""}
                        onPointerDown={(e) => aoPressionar(e, item)}
                        onSelecionar={() => setSelecionado(item.operacaoId)}
                        onEnter={() => setDestaque(item.ordemId)}
                        onLeave={() => setDestaque(null)}
                      />
                      {fantasma && topoFantasma !== undefined && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none absolute z-20 flex items-center rounded-sm border-2 border-dashed px-2 text-xs font-semibold",
                            arraste?.motivo && item.operacaoId === arraste.item.operacaoId ? "border-erro bg-erro/20 text-erro" : "border-acento bg-primaria/30 text-ink",
                          )}
                          style={{
                            left: xDe(fantasma.inicio),
                            width: Math.max(6, xDe(fantasma.fim) - xDe(fantasma.inicio)),
                            top: topoFantasma,
                            height: ALTURA_BARRA,
                          }}
                        >
                          <span className="truncate">{porRecurso ? item.ordemCodigo : item.operacaoNome}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Dica do arraste */}
                {arraste?.ativo && topoDica !== undefined && (
                  <div
                    role="status"
                    className={cn(
                      "pointer-events-none absolute z-30 max-w-xs rounded-sm border px-2 py-1 text-xs shadow-lg",
                      arraste.motivo ? "border-erro bg-surface-2 text-erro" : "border-borda bg-surface-2 text-ink",
                    )}
                    style={{ left: xDe(arraste.novoInicio), top: Math.max(0, topoDica - MARGEM_BARRA - 34) }}
                  >
                    {arraste.motivo ?? (
                      <>
                        Início: <strong className="font-mono">{formatarCurto(arraste.novoInicio, fuso)}</strong>
                        {modo === "operacao" && arraste.recursoAlvo !== arraste.item.recursoId && <> · {nomeRecurso.get(arraste.recursoAlvo)}</>}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {itemSelecionado && (
        <PainelDetalhe
          key={itemSelecionado.operacaoId}
          item={itemSelecionado}
          dados={dados}
          editavel={editavel}
          enviando={enviando}
          nomeRecurso={(id) => nomeRecurso.get(id) ?? id}
          aoFechar={() => setSelecionado(null)}
          aoMover={(cmd) => mover(cmd)}
          aoErro={setErro}
        />
      )}
    </div>
  );
}

function Barra({
  item,
  rotulo,
  recursoNome,
  x,
  largura,
  topo,
  xDe,
  apagada,
  selecionada,
  arrastavel,
  fuso,
  onPointerDown,
  onSelecionar,
  onEnter,
  onLeave,
}: {
  item: ItemGantt;
  rotulo: string;
  recursoNome: string;
  x: number;
  largura: number;
  topo: number;
  xDe: (t: number) => number;
  apagada: boolean;
  selecionada: boolean;
  arrastavel: boolean;
  fuso: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelecionar: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const atrasada = item.atrasoMin > 0;
  const cor = item.emExecucao ? "bg-barra-execucao" : item.fixada ? "bg-barra-fixada" : "bg-barra";
  const corTexto = item.emExecucao ? "text-barra-execucao-texto" : item.fixada ? "text-barra-fixada-texto" : "text-barra-texto";
  const descricao = `OP ${item.ordemCodigo} · ${item.operacaoNome} · ${recursoNome}. ${formatarCurto(item.inicio, fuso)} → ${formatarCurto(item.fim, fuso)}.${
    item.fixada ? " Data fixada." : ""
  }${item.emExecucao ? " Em execução." : ""}${atrasada ? " OP com atraso previsto." : ""}`;
  return (
    <button
      type="button"
      aria-label={descricao}
      title={descricao}
      onPointerDown={onPointerDown}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      // Teclado (Enter/Espaço gera clique com detail 0): abre o painel, onde dá para mover por data exata.
      onClick={(e) => {
        if (e.detail === 0) onSelecionar();
      }}
      className={cn(
        "absolute z-10 overflow-hidden rounded-sm text-left transition-opacity",
        arrastavel ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
        apagada && "opacity-35",
        selecionada && "ring-2 ring-ink ring-offset-1 ring-offset-surface",
        atrasada && "outline outline-2 -outline-offset-2 outline-erro",
      )}
      style={{ left: x, width: largura, top: topo, height: ALTURA_BARRA }}
    >
      {/* Trechos fora do turno ficam translúcidos: a operação para e continua no próximo turno. */}
      <span className={cn("absolute inset-0 opacity-30", cor)} />
      {item.segmentos.map((s) => (
        <span key={s.inicio} className={cn("absolute inset-y-0", cor)} style={{ left: xDe(s.inicio) - x, width: Math.max(1, xDe(s.fim) - xDe(s.inicio)) }} />
      ))}
      {/* Nome sobre etiqueta sólida: legível mesmo sobre o trecho translúcido (fora do turno). */}
      <span className="relative flex h-full max-w-full items-center px-0.5">
        <span className={cn("flex min-w-0 max-w-full items-center gap-1 rounded-sm px-1 py-0.5 text-xs font-semibold", cor, corTexto)}>
          {item.fixada && <Icone nome="alfinete" tamanho={12} />}
          {item.emExecucao && <Icone nome="iniciar" tamanho={10} />}
          {atrasada && <Icone nome="alerta" tamanho={12} />}
          <span className="truncate">{rotulo}</span>
        </span>
      </span>
    </button>
  );
}

function Escala({ dias, xDe, zoom, fuso }: { dias: { iso: string; inicio: number; fim: number }[]; xDe: (t: number) => number; zoom: Zoom; fuso: string }) {
  const nomes = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const passoHoras = zoom === "dia" ? 2 : zoom === "semana" ? 6 : 0;
  return (
    <div className="sticky top-0 z-20 h-12 border-b border-borda bg-surface-2">
      {dias.map((d) => {
        const p = partesLocais(d.inicio + HORA, fuso);
        const fimDeSemana = p.diaSemana === 0 || p.diaSemana === 6;
        return (
          <div key={d.iso} className="absolute inset-y-0 border-l border-borda" style={{ left: xDe(d.inicio), width: xDe(d.fim) - xDe(d.inicio) }}>
            <p className={cn("truncate px-1.5 pt-1 text-xs font-semibold", fimDeSemana ? "text-muted" : "text-ink")}>
              {zoom === "mes" ? `${String(p.dia).padStart(2, "0")}` : `${nomes[p.diaSemana]} ${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`}
            </p>
            {passoHoras > 0 &&
              Array.from({ length: 24 / passoHoras - 1 }, (_, i) => (i + 1) * passoHoras).map((h) => (
                <span key={h} className="absolute bottom-1 -translate-x-1/2 font-mono text-[10px] text-muted" style={{ left: xDe(d.inicio + h * HORA) - xDe(d.inicio) }}>
                  {String(h).padStart(2, "0")}h
                </span>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function Legenda({ porRecurso }: { porRecurso: boolean }) {
  const itens = [
    { cor: "bg-barra", texto: "Programada" },
    { cor: "bg-barra-fixada", texto: "Data fixada", icone: "alfinete" },
    { cor: "bg-barra-execucao", texto: "Em execução", icone: "iniciar" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
      {itens.map((i) => (
        <li key={i.texto} className="flex items-center gap-1.5">
          <span className={cn("inline-block h-3 w-5 rounded-sm", i.cor)} aria-hidden="true" />
          {i.texto}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm outline outline-2 -outline-offset-2 outline-erro" aria-hidden="true" />
        OP atrasada
      </li>
      {porRecurso ? (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-borda bg-fora-turno" aria-hidden="true" />
          Fora do turno
        </li>
      ) : (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0 border-l-2 border-dashed border-ink/70" aria-hidden="true" />
          Data de entrega
        </li>
      )}
      {porRecurso && (
      <li className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-5 rounded-sm"
          aria-hidden="true"
          style={{ background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--erro) 40%, transparent) 0 3px, transparent 3px 6px)" }}
        />
        Indisponível
      </li>
      )}
    </ul>
  );
}

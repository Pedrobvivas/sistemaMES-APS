"use client";

// Gantt por recurso com arraste.
// Soltar uma barra gera uma NOVA programação sugerida (o servidor reprograma tudo pela fila);
// a versão aprovada só muda quando alguém aprova a sugerida.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icone } from "@/components/layout/icone";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { HORA, MINUTO, diaIsoLocal, formatarCurto, localParaInstante, partesLocais, somarDias } from "@/domain/tempo";
import { cn } from "@/lib/utils";
import type { DadosGantt, ItemGantt, RecursoGantt } from "@/server/aps/gantt";
import { simularArraste } from "./actions";
import { PainelDetalhe } from "./painel-detalhe";

type Zoom = "dia" | "semana" | "mes";
type Modo = "ordem" | "operacao";

const PX_HORA: Record<Zoom, number> = { dia: 44, semana: 11, mes: 3.5 };
const ALTURA_LINHA = 52;
const ALTURA_CENTRO = 30;
const PASSO = 15 * MINUTO; // o arraste anda de 15 em 15 minutos
const LIMIAR_ARRASTE = 5; // px antes de considerar arraste (abaixo disso é clique)

type Linha = { tipo: "centro"; id: string; nome: string; topo: number } | { tipo: "recurso"; recurso: RecursoGantt; topo: number };

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

export function Gantt({ dados, podeEditar }: { dados: DadosGantt; podeEditar: boolean }) {
  const router = useRouter();
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [modo, setModo] = useState<Modo>("ordem");
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

  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Começa mostrando "agora" perto da esquerda.
  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollLeft = Math.max(0, xDe(Date.now()) - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const linhas = useMemo(() => {
    const lista: Linha[] = [];
    let topo = 0;
    for (const c of dados.centros) {
      lista.push({ tipo: "centro", id: c.id, nome: c.nome, topo });
      topo += ALTURA_CENTRO;
      for (const r of c.recursos) {
        lista.push({ tipo: "recurso", recurso: r, topo });
        topo += ALTURA_LINHA;
      }
    }
    return { lista, altura: topo };
  }, [dados.centros]);

  const topoRecurso = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of linhas.lista) if (l.tipo === "recurso") m.set(l.recurso.id, l.topo);
    return m;
  }, [linhas]);

  const nomeRecurso = useMemo(() => new Map(dados.centros.flatMap((c) => c.recursos.map((r) => [r.id, r.nome] as const))), [dados.centros]);
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
    const area = linhasRef.current?.getBoundingClientRect();
    if (!area) return null;
    const y = clientY - area.top;
    const linha = linhas.lista.find((l) => l.tipo === "recurso" && y >= l.topo && y < l.topo + ALTURA_LINHA);
    return linha?.tipo === "recurso" ? linha.recurso.id : null;
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
    const recursoAlvo = modo === "operacao" ? (recursoNaPosicao(e.clientY) ?? arraste.recursoAlvo) : arraste.item.recursoId;
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
      router.push(`/programacao?versao=${r.programacaoId}`);
    });
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

  const itemSelecionado = dados.itens.find((i) => i.operacaoId === selecionado) ?? null;
  const ordemEmFoco = arraste?.item.ordemId ?? destaque ?? itemSelecionado?.ordemId ?? null;

  return (
    <div className="flex flex-col gap-3">
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
        <Legenda />
      </div>

      {editavel && (
        <p className="text-xs text-muted">
          Arraste uma barra para outra data{modo === "operacao" ? " ou para outro recurso elegível" : ""}: o sistema reprograma todas as OPs pela fila e mostra o
          antes × depois para você aprovar. Clique na barra para ver detalhes ou mover por data exata.
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

      <div className="relative flex overflow-hidden rounded-md border border-borda">
        {enviando && (
          <div role="status" className="absolute inset-0 z-30 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]">
            <p className="flex items-center gap-2 rounded-md border border-borda bg-surface-2 px-4 py-3 text-sm font-semibold">
              <Icone nome="atualizar" tamanho={18} /> Reprogramando todas as OPs…
            </p>
          </div>
        )}

        {/* Coluna dos recursos */}
        <div className="w-36 shrink-0 border-r border-borda bg-surface-2 sm:w-56">
          <div className="h-12 border-b border-borda px-3 py-2 text-xs font-semibold text-muted">Recurso</div>
          {linhas.lista.map((l) =>
            l.tipo === "centro" ? (
              <div key={l.id} className="flex items-center border-b border-borda bg-surface px-3 text-xs font-bold uppercase tracking-wide text-muted" style={{ height: ALTURA_CENTRO }}>
                <span className="truncate">{l.nome}</span>
              </div>
            ) : (
              <div
                key={l.recurso.id}
                className={cn(
                  "flex flex-col justify-center border-b border-borda px-3",
                  arraste?.ativo && modo === "operacao" && arraste.item.elegiveis.includes(l.recurso.id) && "bg-primaria/15",
                )}
                style={{ height: ALTURA_LINHA }}
              >
                <span className="truncate text-sm font-semibold">{l.recurso.nome}</span>
                <span className="truncate font-mono text-xs text-muted">{l.recurso.codigo}</span>
              </div>
            ),
          )}
        </div>

        {/* Área do tempo */}
        <div ref={rolagem} className="min-w-0 flex-1 overflow-x-auto">
          <div style={{ width: largura }} className="relative">
            <Escala dias={dias} xDe={xDe} zoom={zoom} fuso={fuso} />
            <div ref={linhasRef} className="relative" style={{ height: linhas.altura }} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={() => setArraste(null)}>
              {/* Fundo: turnos, fora do turno e indisponibilidades */}
              {linhas.lista.map((l) =>
                l.tipo === "centro" ? (
                  <div key={l.id} className="absolute left-0 right-0 border-b border-borda bg-surface" style={{ top: l.topo, height: ALTURA_CENTRO }} />
                ) : (
                  <div key={l.recurso.id} className="absolute left-0 right-0 border-b border-borda bg-fora-turno" style={{ top: l.topo, height: ALTURA_LINHA }}>
                    {l.recurso.disponibilidade.map((d) => (
                      <div key={d.inicio} className="absolute inset-y-0 bg-surface" style={{ left: xDe(d.inicio), width: Math.max(1, xDe(d.fim) - xDe(d.inicio)) }} />
                    ))}
                    {l.recurso.paradas.map((p) => (
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
                ),
              )}
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
                const topo = topoRecurso.get(item.recursoId);
                if (topo === undefined) return null;
                const fantasma = posicaoFantasma(item);
                const apagada = ordemEmFoco !== null && ordemEmFoco !== item.ordemId;
                return (
                  <div key={item.operacaoId}>
                    <Barra
                      item={item}
                      x={xDe(item.inicio)}
                      largura={Math.max(6, xDe(item.fim) - xDe(item.inicio))}
                      topo={topo}
                      xDe={xDe}
                      apagada={apagada || !!fantasma}
                      selecionada={selecionado === item.operacaoId}
                      arrastavel={editavel && !item.emExecucao && item.statusOperacao === "pendente"}
                      fuso={fuso}
                      onPointerDown={(e) => aoPressionar(e, item)}
                      onSelecionar={() => setSelecionado(item.operacaoId)}
                      onEnter={() => setDestaque(item.ordemId)}
                      onLeave={() => setDestaque(null)}
                    />
                    {fantasma && topoRecurso.has(fantasma.recursoId) && (
                      <div
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute z-20 flex items-center rounded-sm border-2 border-dashed px-2 text-xs font-semibold",
                          arraste?.motivo && item.operacaoId === arraste.item.operacaoId ? "border-erro bg-erro/20 text-erro" : "border-azul-eletrico bg-primaria/30 text-ink",
                        )}
                        style={{
                          left: xDe(fantasma.inicio),
                          width: Math.max(6, xDe(fantasma.fim) - xDe(fantasma.inicio)),
                          top: topoRecurso.get(fantasma.recursoId)! + 8,
                          height: ALTURA_LINHA - 16,
                        }}
                      >
                        <span className="truncate">{item.ordemCodigo}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Dica do arraste */}
              {arraste?.ativo && topoRecurso.has(arraste.recursoAlvo) && (
                <div
                  role="status"
                  className={cn(
                    "pointer-events-none absolute z-30 max-w-xs rounded-sm border px-2 py-1 text-xs shadow-lg",
                    arraste.motivo ? "border-erro bg-surface-2 text-erro" : "border-borda bg-surface-2 text-ink",
                  )}
                  style={{ left: xDe(arraste.novoInicio), top: Math.max(0, topoRecurso.get(arraste.recursoAlvo)! - 34) }}
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
  const cor = item.emExecucao ? "bg-sucesso text-surface" : item.fixada ? "bg-violeta text-primaria-texto" : "bg-barra text-barra-texto";
  const descricao = `OP ${item.ordemCodigo} · ${item.operacaoNome}. ${formatarCurto(item.inicio, fuso)} → ${formatarCurto(item.fim, fuso)}.${
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
      style={{ left: x, width: largura, top: topo + 8, height: ALTURA_LINHA - 16 }}
    >
      {/* Trechos fora do turno ficam translúcidos: a operação para e continua no próximo turno. */}
      <span className={cn("absolute inset-0 opacity-30", cor)} />
      {item.segmentos.map((s) => (
        <span key={s.inicio} className={cn("absolute inset-y-0", cor)} style={{ left: xDe(s.inicio) - x, width: Math.max(1, xDe(s.fim) - xDe(s.inicio)) }} />
      ))}
      <span className={cn("relative flex h-full items-center gap-1 px-1.5 text-xs font-semibold", item.emExecucao ? "text-surface" : "text-primaria-texto")}>
        {item.fixada && <Icone nome="alfinete" tamanho={12} />}
        {item.emExecucao && <Icone nome="iniciar" tamanho={10} />}
        {atrasada && <Icone nome="alerta" tamanho={12} />}
        <span className="truncate">
          {item.ordemCodigo} · {item.operacaoNome}
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

function Legenda() {
  const itens = [
    { cor: "bg-barra", texto: "Programada" },
    { cor: "bg-violeta", texto: "Data fixada", icone: "alfinete" },
    { cor: "bg-sucesso", texto: "Em execução", icone: "iniciar" },
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
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm border border-borda bg-fora-turno" aria-hidden="true" />
        Fora do turno
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-5 rounded-sm"
          aria-hidden="true"
          style={{ background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--erro) 40%, transparent) 0 3px, transparent 3px 6px)" }}
        />
        Indisponível
      </li>
    </ul>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icone } from "@/components/layout/icone";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input, Select } from "@/components/ui/form";
import { formatarCurto, formatarDuracao } from "@/domain/tempo";
import { cn } from "@/lib/utils";
import { apontar, type RespostaApontamento } from "../actions";

type OperacaoAndamento = { id: string; nome: string; ordemCodigo: string; quantidade: number; status: string; inicioReal: number | null };
type OperacaoFila = { id: string; nome: string; ordemCodigo: string; quantidade: number; inicioPrevisto: number; fimPrevisto: number; bloqueio: string | null };

const botaoGrande = "h-16 px-6 text-base";

function novaChave() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PainelRecurso({
  recursoId,
  fuso,
  operadores,
  motivos,
  temProgramacao,
  emAndamento,
  proximas,
}: {
  recursoId: string;
  fuso: string;
  operadores: { id: string; nome: string; matricula: string }[];
  motivos: { id: string; nome: string; categoria: string }[];
  temProgramacao: boolean;
  emAndamento: OperacaoAndamento[];
  proximas: OperacaoFila[];
}) {
  const [operadorId, setOperadorId] = useState("");
  const [resposta, setResposta] = useState<RespostaApontamento | null>(null);
  const [pendente, iniciar] = useTransition();
  const [acao, setAcao] = useState<{ tipo: "pausa" | "fim"; operacaoId: string } | null>(null);
  const [boa, setBoa] = useState("");
  const [rejeitada, setRejeitada] = useState("0");
  const [excedente, setExcedente] = useState(false);
  // Uma chave por intenção de toque: reenviar a mesma intenção não duplica o evento.
  const chave = useRef<string>(novaChave());

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("terminal-operador");
      if (salvo && operadores.some((o) => o.id === salvo)) setOperadorId(salvo);
    } catch {}
  }, [operadores]);

  function escolherOperador(id: string) {
    setOperadorId(id);
    try {
      localStorage.setItem("terminal-operador", id);
    } catch {}
  }

  function enviar(cmd: { operacaoId: string; tipo: "inicio" | "pausa" | "retomada" | "fim"; motivoParadaId?: string; quantidades?: { boa: number; rejeitada: number } }) {
    if (!operadorId) {
      setResposta({ ok: false, erro: "Selecione o operador antes de apontar." });
      return;
    }
    iniciar(async () => {
      let r: RespostaApontamento;
      try {
        r = await apontar({ ...cmd, recursoId, operadorId, confirmarExcedente: excedente, chaveIdempotencia: chave.current });
      } catch {
        // Sem resposta (rede): mantém a chave, então tocar de novo não duplica o evento.
        setResposta({ ok: false, erro: "Sem conexão com o servidor. Toque de novo quando a rede voltar." });
        return;
      }
      // Houve resposta: a próxima intenção usa uma chave nova.
      chave.current = novaChave();
      setResposta(r);
      if (r.ok) {
        setAcao(null);
        setBoa("");
        setRejeitada("0");
        setExcedente(false);
      }
    });
  }

  const ocupado = emAndamento.some((o) => o.status === "em_execucao");
  const operador = operadores.find((o) => o.id === operadorId);

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-md">
        <Campo id="operador" rotulo="Operador">
          <Select id="operador" value={operadorId} onChange={(e) => escolherOperador(e.target.value)} className="h-14 text-base">
            <option value="">Selecione seu nome</option>
            {operadores.map((o) => (
              <option key={o.id} value={o.id}>
                {o.matricula} · {o.nome}
              </option>
            ))}
          </Select>
        </Campo>
      </div>

      <div aria-live="polite">
        {resposta && (resposta.ok ? <Alerta tom="sucesso">{resposta.mensagem}</Alerta> : <Alerta>{resposta.erro}</Alerta>)}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="em-andamento">
        <h2 id="em-andamento" className="text-lg font-bold">
          Em andamento neste recurso
        </h2>
        {emAndamento.length === 0 ? (
          <p className="rounded-md border border-dashed border-borda p-4 text-sm text-muted">Nada em andamento. Inicie a próxima operação da fila abaixo.</p>
        ) : (
          emAndamento.map((o) => (
            <div key={o.id} className={cn("flex flex-col gap-4 rounded-md border-2 bg-surface-2 p-4", o.status === "em_execucao" ? "border-sucesso" : "border-alerta")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xl font-bold">
                    OP {o.ordemCodigo} · {o.nome}
                  </p>
                  <p className="text-sm text-muted">
                    Quantidade da OP: {o.quantidade}
                    {o.inicioReal && ` · iniciada em ${formatarCurto(o.inicioReal, fuso)}`}
                  </p>
                </div>
                <span className={cn("flex items-center gap-1.5 text-base font-bold", o.status === "em_execucao" ? "text-sucesso" : "text-alerta")}>
                  <Icone nome={o.status === "em_execucao" ? "iniciar" : "pausar"} tamanho={18} />
                  {o.status === "em_execucao" ? "Produzindo" : "Pausada"}
                </span>
              </div>

              {acao?.operacaoId === o.id && acao.tipo === "pausa" ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-base font-semibold">Motivo da parada</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {motivos.map((m) => (
                      <Button key={m.id} variante="secundaria" className="h-14 justify-start text-base" disabled={pendente} onClick={() => enviar({ operacaoId: o.id, tipo: "pausa", motivoParadaId: m.id })}>
                        {m.nome}
                        <span className="ml-auto text-xs text-muted">{m.categoria === "planejada" ? "planejada" : "não planejada"}</span>
                      </Button>
                    ))}
                  </div>
                  {motivos.length === 0 && <Alerta tom="alerta">Não há motivos de parada cadastrados.</Alerta>}
                  <Button variante="fantasma" onClick={() => setAcao(null)}>
                    Voltar
                  </Button>
                </fieldset>
              ) : acao?.operacaoId === o.id && acao.tipo === "fim" ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviar({ operacaoId: o.id, tipo: "fim", quantidades: { boa: Number(boa), rejeitada: Number(rejeitada) } });
                  }}
                >
                  <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                    <Campo id={`boa-${o.id}`} rotulo="Quantidade boa">
                      <Input id={`boa-${o.id}`} type="number" inputMode="numeric" min={0} step={1} required value={boa} onChange={(e) => setBoa(e.target.value)} className="h-14 text-lg" />
                    </Campo>
                    <Campo id={`rej-${o.id}`} rotulo="Rejeitada">
                      <Input id={`rej-${o.id}`} type="number" inputMode="numeric" min={0} step={1} required value={rejeitada} onChange={(e) => setRejeitada(e.target.value)} className="h-14 text-lg" />
                    </Campo>
                  </div>
                  {resposta && !resposta.ok && resposta.erro.includes("excedente") && (
                    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                      <input type="checkbox" checked={excedente} onChange={(e) => setExcedente(e.target.checked)} className="h-5 w-5" />
                      Confirmo a quantidade acima do previsto na OP
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" className={botaoGrande} disabled={pendente}>
                      <Icone nome="concluir" /> Confirmar finalização
                    </Button>
                    <Button variante="fantasma" onClick={() => setAcao(null)}>
                      Voltar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {o.status === "em_execucao" ? (
                    <>
                      <Button variante="secundaria" className={botaoGrande} disabled={pendente} onClick={() => setAcao({ tipo: "pausa", operacaoId: o.id })}>
                        <Icone nome="pausar" /> Pausar
                      </Button>
                      <Button className={botaoGrande} disabled={pendente} onClick={() => setAcao({ tipo: "fim", operacaoId: o.id })}>
                        <Icone nome="concluir" /> Finalizar
                      </Button>
                    </>
                  ) : (
                    <Button className={botaoGrande} disabled={pendente || ocupado} onClick={() => enviar({ operacaoId: o.id, tipo: "retomada" })}>
                      <Icone nome="iniciar" /> Retomar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="fila">
        <h2 id="fila" className="text-lg font-bold">
          Próximas na programação aprovada
        </h2>
        {!temProgramacao ? (
          <Alerta tom="alerta">Ainda não há programação aprovada. Peça ao planejador para aprovar uma no Gantt.</Alerta>
        ) : proximas.length === 0 ? (
          <p className="rounded-md border border-dashed border-borda p-4 text-sm text-muted">Nenhuma operação programada para este recurso.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {proximas.map((o, i) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-md border border-borda bg-surface-2 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-borda font-mono font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    OP {o.ordemCodigo} · {o.nome}
                  </p>
                  <p className="text-sm text-muted">
                    Previsto {formatarCurto(o.inicioPrevisto, fuso)} → {formatarCurto(o.fimPrevisto, fuso)} · {formatarDuracao((o.fimPrevisto - o.inicioPrevisto) / 60000)} de calendário ·
                    qtd. {o.quantidade}
                  </p>
                  {o.bloqueio && <p className="text-sm font-semibold text-alerta">{o.bloqueio}</p>}
                </div>
                <Button
                  className="h-14 px-5 text-base"
                  disabled={pendente || ocupado || !!o.bloqueio}
                  onClick={() => enviar({ operacaoId: o.id, tipo: "inicio" })}
                  aria-label={`Iniciar OP ${o.ordemCodigo} ${o.nome}`}
                >
                  <Icone nome="iniciar" /> Iniciar
                </Button>
              </li>
            ))}
          </ol>
        )}
        {ocupado && proximas.length > 0 && <p className="text-sm text-muted">Para iniciar outra, pause ou finalize a operação em andamento.</p>}
        {operador && <p className="text-xs text-muted">Apontando como {operador.nome}.</p>}
      </section>
    </div>
  );
}

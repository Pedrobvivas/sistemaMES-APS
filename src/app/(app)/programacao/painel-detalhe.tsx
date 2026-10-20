"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icone } from "@/components/layout/icone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/feedback";
import { Campo, Input, Select } from "@/components/ui/form";
import { PrioridadeBadge, StatusOperacaoBadge } from "@/components/ui/status";
import { diaIsoLocal, formatarCurto, formatarDuracao, localParaInstante, partesLocais } from "@/domain/tempo";
import { formatarDiaIso } from "@/lib/utils";
import type { DadosGantt, ItemGantt } from "@/server/aps/gantt";
import { desafixarAcao } from "./actions";

function paraCampoLocal(t: number, fuso: string) {
  const p = partesLocais(t, fuso);
  return `${diaIsoLocal(t, fuso)}T${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}

function deCampoLocal(v: string, fuso: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  return localParaInstante(v.slice(0, 10), Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16)), fuso);
}

// Painel da barra selecionada: detalhes, justificativa do sequenciador e alternativa
// acessível ao arraste (mover por data exata).
export function PainelDetalhe({
  item,
  dados,
  editavel,
  enviando,
  nomeRecurso,
  aoFechar,
  aoMover,
  aoErro,
}: {
  item: ItemGantt;
  dados: DadosGantt;
  editavel: boolean;
  enviando: boolean;
  nomeRecurso: (id: string) => string;
  aoFechar: () => void;
  aoMover: (cmd: { operacaoId: string; novoInicio: number; recursoId: string | null; modo: "ordem" | "operacao" }) => void;
  aoErro: (msg: string) => void;
}) {
  const router = useRouter();
  const { fuso } = dados;
  const [quando, setQuando] = useState(() => paraCampoLocal(item.inicio, fuso));
  const [modo, setModo] = useState<"ordem" | "operacao">("ordem");
  const [recurso, setRecurso] = useState(item.recursoId);
  const [desafixando, iniciar] = useTransition();
  const movivel = editavel && !item.emExecucao && item.statusOperacao === "pendente";
  const fixadasDaOp = dados.itens.filter((i) => i.ordemId === item.ordemId && i.fixada).map((i) => i.operacaoId);

  function desafixar(operacaoIds: string[], descricao: string) {
    iniciar(async () => {
      const r = await desafixarAcao({ programacaoId: dados.programacao.id, operacaoIds, descricao });
      if (!r.ok) return aoErro(r.erro);
      aoFechar();
      router.push(`/programacao?versao=${r.programacaoId}`);
    });
  }

  return (
    <Card className="flex flex-col gap-4" aria-labelledby="detalhe-titulo">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="detalhe-titulo" className="text-lg font-bold">
            OP {item.ordemCodigo} · {item.operacaoNome}
          </h2>
          <p className="text-sm text-muted">
            {item.produto}
            {item.cliente ? ` · ${item.cliente}` : ""}
          </p>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar detalhes" className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink">
          <Icone nome="fechar" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusOperacaoBadge status={item.statusOperacao} />
        <PrioridadeBadge prioridade={item.prioridade} />
        {item.fixada && (
          <Badge tom="destaque" className="gap-1">
            <Icone nome="alfinete" tamanho={12} /> Data fixada
          </Badge>
        )}
        {item.atrasoMin > 0 ? <Badge tom="erro">OP atrasa {formatarDuracao(item.atrasoMin)}</Badge> : <Badge tom="sucesso">OP no prazo</Badge>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Recurso</dt>
          <dd className="font-semibold">{nomeRecurso(item.recursoId)}</dd>
        </div>
        <div>
          <dt className="text-muted">Início → fim</dt>
          <dd className="font-mono">
            {formatarCurto(item.inicio, fuso)} → {formatarCurto(item.fim, fuso)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Trabalho (inclui setup)</dt>
          <dd className="font-mono">
            {formatarDuracao(item.segmentos.reduce((s, x) => s + (x.fim - x.inicio), 0) / 60000)}
            {item.setupMin > 0 && <span className="text-muted"> · setup {item.setupMin} min</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Entrega da OP</dt>
          <dd className="font-mono">{formatarDiaIso(item.prazo)}</dd>
        </div>
      </dl>

      <div className="rounded-sm border border-borda bg-surface p-3 text-sm">
        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted">
          <Icone nome="info" tamanho={14} /> Por que está aqui (regra do sequenciador)
        </p>
        <p>{item.justificativa}</p>
      </div>

      {movivel ? (
        <form
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const novoInicio = deCampoLocal(quando, fuso);
            if (novoInicio === null) return aoErro("Informe data e hora válidas.");
            aoMover({ operacaoId: item.operacaoId, novoInicio, recursoId: modo === "operacao" ? recurso : null, modo });
          }}
        >
          <Campo id="mover-quando" rotulo="Mover para">
            <Input id="mover-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} step={900} required />
          </Campo>
          <Campo id="mover-modo" rotulo="O que mover">
            <Select id="mover-modo" value={modo} onChange={(e) => setModo(e.target.value as "ordem" | "operacao")}>
              <option value="ordem">OP inteira</option>
              <option value="operacao">Só esta operação</option>
            </Select>
          </Campo>
          <Campo id="mover-recurso" rotulo="Recurso" ajuda={modo === "ordem" ? "Na OP inteira o recurso não muda." : undefined}>
            <Select id="mover-recurso" value={recurso} onChange={(e) => setRecurso(e.target.value)} disabled={modo === "ordem"}>
              {item.elegiveis.map((id) => (
                <option key={id} value={id}>
                  {nomeRecurso(id)}
                </option>
              ))}
            </Select>
          </Campo>
          <Button type="submit" disabled={enviando}>
            Reprogramar
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted">
          {item.emExecucao ? "Operação em andamento no chão de fábrica: não pode ser movida." : !editavel ? "Esta versão é só para consulta." : "Operação não pendente."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {editavel && item.fixada && (
          <Button variante="secundaria" disabled={desafixando} onClick={() => desafixar([item.operacaoId], `OP ${item.ordemCodigo} · ${item.operacaoNome} desafixada`)}>
            <Icone nome="alfinete" tamanho={16} /> Desafixar esta operação
          </Button>
        )}
        {editavel && fixadasDaOp.length > 1 && (
          <Button variante="secundaria" disabled={desafixando} onClick={() => desafixar(fixadasDaOp, `OP ${item.ordemCodigo} desafixada`)}>
            Desafixar a OP inteira
          </Button>
        )}
        <Link href={`/ordens/${item.ordemId}`} className="inline-flex min-h-11 items-center text-sm text-destaque hover:underline">
          Abrir OP {item.ordemCodigo}
        </Link>
      </div>
    </Card>
  );
}

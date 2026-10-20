"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icone } from "@/components/layout/icone";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alerta, Badge } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { formatarCurto, formatarDuracao } from "@/domain/tempo";
import { formatarData } from "@/lib/utils";
import type { DadosGantt } from "@/server/aps/gantt";
import { aprovarAcao, descartarAcao, gerarAcao } from "./actions";

const rotuloStatus: Record<string, { texto: string; tom: "destaque" | "sucesso" | "neutro" | "alerta" }> = {
  sugerida: { texto: "Sugerida · aguardando aprovação", tom: "alerta" },
  aprovada: { texto: "Aprovada · em vigor", tom: "sucesso" },
  substituida: { texto: "Substituída", tom: "neutro" },
  descartada: { texto: "Descartada", tom: "neutro" },
};

const rotuloSituacao: Record<string, { texto: string; classe: string }> = {
  passou_a_atrasar: { texto: "Passou a atrasar", classe: "text-erro" },
  sem_programacao: { texto: "Ficou sem programação", classe: "text-erro" },
  atrasou: { texto: "Termina mais tarde", classe: "text-alerta" },
  saiu_do_atraso: { texto: "Saiu do atraso", classe: "text-sucesso" },
  adiantou: { texto: "Termina mais cedo", classe: "text-sucesso" },
  igual: { texto: "Sem mudança", classe: "text-muted" },
};

function delta(min: number | null) {
  if (min === null) return "—";
  if (min === 0) return "0";
  return `${min > 0 ? "+" : "−"}${formatarDuracao(Math.abs(min))}`;
}

// Cabeçalho da versão exibida + antes × depois + aprovar/descartar.
export function CabecalhoVersao({ dados, podeEditar, podeAprovar }: { dados: DadosGantt; podeEditar: boolean; podeAprovar: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tom: "erro" | "sucesso"; texto: string } | null>(null);
  const p = dados.programacao;
  const status = rotuloStatus[p.status];
  const m = p.metricas;
  const mudancas = dados.comparacao?.mudancas.filter((x) => x.situacao !== "igual") ?? [];

  function executar(acao: () => Promise<{ ok: true; programacaoId?: string; mensagem?: string } | { ok: false; erro: string }>, depois?: (id?: string) => void) {
    setAviso(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) return setAviso({ tom: "erro", texto: r.erro });
      if (r.mensagem) setAviso({ tom: "sucesso", texto: r.mensagem });
      depois?.(r.programacaoId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">Programação nº {p.numero}</h2>
            <Badge tom={status.tom}>{status.texto}</Badge>
          </div>
          <p className="text-sm text-muted">
            {p.descricao} · gerada em {formatarData(new Date(p.geradoEm))}
            {p.geradoPor ? ` por ${p.geradoPor}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === "sugerida" && podeAprovar && (
            <Button disabled={pendente} onClick={() => executar(() => aprovarAcao(p.id))}>
              <Icone nome="concluir" tamanho={18} /> Aprovar programação
            </Button>
          )}
          {p.status === "sugerida" && podeEditar && (
            <Button
              variante="secundaria"
              disabled={pendente}
              onClick={() =>
                executar(
                  () => descartarAcao(p.id),
                  () => router.push("/programacao"),
                )
              }
            >
              Descartar
            </Button>
          )}
          {podeEditar && (
            <Button
              variante="secundaria"
              disabled={pendente}
              onClick={() => {
                if (dados.sugeridaAberta && !confirm("Já existe uma programação sugerida em aberto. Gerar outra vai descartá-la. Continuar?")) return;
                executar(gerarAcao, (id) => id && router.push(`/programacao?versao=${id}`));
              }}
            >
              <Icone nome="atualizar" tamanho={18} /> {pendente ? "Gerando..." : "Gerar programação completa"}
            </Button>
          )}
        </div>
      </div>

      {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}
      {p.status === "aprovada" && dados.sugeridaAberta && (
        <Alerta tom="alerta">
          Há uma simulação em aberto (nº {dados.sugeridaAberta.numero}).{" "}
          <Link href={`/programacao?versao=${dados.sugeridaAberta.id}`} className="font-semibold underline">
            Abrir para revisar e aprovar
          </Link>
        </Alerta>
      )}
      {(p.status === "substituida" || p.status === "descartada") && (
        <Alerta tom="neutro">
          Versão antiga, só para consulta.{" "}
          <Link href="/programacao" className="font-semibold underline">
            Ver a programação atual
          </Link>
        </Alerta>
      )}
      {dados.opsForaDaVersao > 0 && (
        <Alerta tom="alerta">
          {dados.opsForaDaVersao} OP(s) liberada(s) depois desta versão não estão no Gantt. Use “Gerar programação completa” para incluí-las.
        </Alerta>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { rotulo: "OPs programadas", valor: `${m.ordensProgramadas}/${m.totalOrdens}` },
          { rotulo: "OPs atrasadas", valor: m.ordensAtrasadas, alerta: m.ordensAtrasadas > 0 },
          { rotulo: "Atraso total", valor: formatarDuracao(m.atrasoTotalMin) },
          { rotulo: "Operações sem lugar", valor: m.operacoesNaoProgramadas, alerta: m.operacoesNaoProgramadas > 0 },
          { rotulo: "Preparações (setups)", valor: `${m.operacoesComSetup} · ${formatarDuracao(m.setupTotalMin)}` },
          { rotulo: "Último término", valor: m.termino ? formatarCurto(m.termino, dados.fuso) : "—" },
        ].map((x) => (
          <div key={x.rotulo} className="rounded-md border border-borda bg-surface-2 px-3 py-2">
            <dt className="text-xs text-muted">{x.rotulo}</dt>
            <dd className={x.alerta ? "font-mono text-lg font-bold text-erro" : "font-mono text-lg font-bold"}>{x.valor}</dd>
          </div>
        ))}
      </dl>

      {dados.comparacao && (
        <section className="flex flex-col gap-3 rounded-md border border-alerta/50 p-4" aria-labelledby="antes-depois">
          <h3 id="antes-depois" className="font-display font-bold">
            Antes × depois (comparado com a aprovada nº {dados.aprovada?.numero})
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
            <Table>
              <thead>
                <tr>
                  <Th>Indicador</Th>
                  <Th className="text-right">Antes</Th>
                  <Th className="text-right">Depois</Th>
                </tr>
              </thead>
              <tbody>
                {dados.comparacao.metricas.map((c) => {
                  const melhor = c.melhorQuandoMenor ? c.depois < c.antes : c.depois > c.antes;
                  const pior = c.melhorQuandoMenor ? c.depois > c.antes : c.depois < c.antes;
                  return (
                    <tr key={c.chave}>
                      <Td className="py-2">{c.rotulo}</Td>
                      <Td className="py-2 text-right font-mono">{c.antes}</Td>
                      <Td className={`py-2 text-right font-mono font-semibold ${melhor ? "text-sucesso" : pior ? "text-erro" : ""}`}>
                        {c.depois}
                        <span className="sr-only">{melhor ? " (melhor)" : pior ? " (pior)" : ""}</span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {mudancas.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma OP muda de data de término.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>OP</Th>
                    <Th>Término antes</Th>
                    <Th>Término depois</Th>
                    <Th className="text-right">Diferença</Th>
                    <Th>Efeito</Th>
                  </tr>
                </thead>
                <tbody>
                  {mudancas.slice(0, 12).map((x) => (
                    <tr key={x.ordemId}>
                      <Td className="py-2 font-mono font-semibold">{x.ordemCodigo}</Td>
                      <Td className="py-2 font-mono text-xs">{x.fimAntes ? formatarCurto(x.fimAntes, dados.fuso) : "—"}</Td>
                      <Td className="py-2 font-mono text-xs">{x.fimDepois ? formatarCurto(x.fimDepois, dados.fuso) : "—"}</Td>
                      <Td className="py-2 text-right font-mono text-xs">{delta(x.deltaMin)}</Td>
                      <Td className={`py-2 text-sm font-semibold ${rotuloSituacao[x.situacao].classe}`}>
                        {rotuloSituacao[x.situacao].texto}
                        {x.atrasoDepoisMin > 0 && <span className="block text-xs font-normal">atraso: {formatarDuracao(x.atrasoDepoisMin)}</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
          {mudancas.length > 12 && <p className="text-xs text-muted">E mais {mudancas.length - 12} OP(s) com mudança.</p>}
        </section>
      )}

      {dados.conflitos.length > 0 && (
        <details className="rounded-md border border-erro/40 p-4" open={dados.conflitos.length <= 5}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-erro">
            <Icone nome="alerta" tamanho={18} /> {dados.conflitos.length} conflito(s) e aviso(s) desta programação
          </summary>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {dados.conflitos.map((c, i) => (
              <li key={i} className="rounded-sm bg-surface-2 px-3 py-2">
                {c.mensagem}
              </li>
            ))}
          </ul>
        </details>
      )}
      {p.status !== "aprovada" && !dados.aprovada && (
        <p className="text-sm text-muted">
          Ainda não há programação aprovada. Aprove esta para que ela valha no terminal de produção e no painel.{" "}
          <Link href="/ordens" className={buttonClasses({ variante: "fantasma", tamanho: "sm" })}>
            Ver OPs
          </Link>
        </p>
      )}
    </div>
  );
}

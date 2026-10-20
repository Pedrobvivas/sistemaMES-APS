import { asc, desc, eq, inArray, sum } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Icone } from "@/components/layout/icone";
import { Card, CardDescricao } from "@/components/ui/card";
import { Alerta, Badge, CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { PrioridadeBadge, StatusOperacaoBadge, StatusOrdemBadge } from "@/components/ui/status";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { apontamentos, clientes, gruposRecurso, operacoesOrdem, ordemHistorico, ordensProducao, produtos, programacaoItens, recursos, user } from "@/db/schema";
import { rotuloStatusOrdem } from "@/domain/ordens/status";
import { formatarCurto, formatarDuracao } from "@/domain/tempo";
import { exigirPermissao } from "@/lib/session";
import { formatarData, formatarDiaIso } from "@/lib/utils";
import { FUSO } from "@/server/aps/entrada";
import { programacaoAprovada } from "@/server/aps/programacoes";
import { camposEditaveis } from "@/server/ordens";
import { AcoesOrdem } from "./acoes";

export const metadata: Metadata = { title: "OP" };

export default async function OrdemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  await exigirPermissao("ordens:editar");
  const { id } = await params;
  const { salvo } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [linha] = await db
    .select({ o: ordensProducao, produto: produtos.nome, produtoCodigo: produtos.codigo, unidade: produtos.unidade, cliente: clientes.nome })
    .from(ordensProducao)
    .innerJoin(produtos, eq(produtos.id, ordensProducao.produtoId))
    .leftJoin(clientes, eq(clientes.id, ordensProducao.clienteId))
    .where(eq(ordensProducao.id, id))
    .limit(1);
  if (!linha) notFound();
  const o = linha.o;

  const aprovada = await programacaoAprovada();
  const [ops, historico, previstos, produzido] = await Promise.all([
    db
      .select({ op: operacoesOrdem, grupo: gruposRecurso.nome, recursoReal: recursos.nome })
      .from(operacoesOrdem)
      .innerJoin(gruposRecurso, eq(gruposRecurso.id, operacoesOrdem.grupoRecursoId))
      .leftJoin(recursos, eq(recursos.id, operacoesOrdem.recursoExecucaoId))
      .where(eq(operacoesOrdem.ordemId, id))
      .orderBy(asc(operacoesOrdem.sequencia), asc(operacoesOrdem.nome)),
    db
      .select({ h: ordemHistorico, usuario: user.name })
      .from(ordemHistorico)
      .leftJoin(user, eq(user.id, ordemHistorico.usuarioId))
      .where(eq(ordemHistorico.ordemId, id))
      .orderBy(desc(ordemHistorico.ocorridoEm)),
    aprovada
      ? db
          .select({ operacaoId: programacaoItens.operacaoId, inicio: programacaoItens.inicio, fim: programacaoItens.fim, recurso: recursos.nome, fixada: programacaoItens.fixada })
          .from(programacaoItens)
          .innerJoin(recursos, eq(recursos.id, programacaoItens.recursoId))
          .where(eq(programacaoItens.programacaoId, aprovada.id))
      : Promise.resolve([]),
    db
      .select({ operacaoId: apontamentos.operacaoId, boa: sum(apontamentos.quantidadeBoa), rejeitada: sum(apontamentos.quantidadeRejeitada) })
      .from(apontamentos)
      .innerJoin(operacoesOrdem, eq(operacoesOrdem.id, apontamentos.operacaoId))
      .where(inArray(operacoesOrdem.ordemId, [id]))
      .groupBy(apontamentos.operacaoId),
  ]);
  const prev = new Map(previstos.map((p) => [p.operacaoId, p]));
  const qtd = new Map(produzido.map((p) => [p.operacaoId, p]));
  const resumo = aprovada?.resumoOrdens.find((r) => r.ordemId === id);
  const concluidas = ops.filter((x) => x.op.status === "concluida").length;
  const ativas = ops.filter((x) => x.op.status !== "cancelada").length;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/ordens" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <Icone nome="voltar" tamanho={16} /> Ordens de produção
      </Link>
      <CabecalhoPagina
        titulo={`OP ${o.codigo}`}
        descricao={`${linha.produtoCodigo} · ${linha.produto}${linha.cliente ? ` · ${linha.cliente}` : ""}`}
        acoes={<StatusOrdemBadge status={o.status} />}
      />
      {salvo && <Alerta tom="sucesso">OP salva.</Alerta>}
      <AcoesOrdem id={o.id} status={o.status} podeEditar={camposEditaveis(o.status).demais} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="flex flex-col gap-1 p-4">
          <CardDescricao>Quantidade</CardDescricao>
          <p className="font-mono text-xl font-bold">
            {o.quantidade} <span className="text-sm font-normal text-muted">{linha.unidade}</span>
          </p>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <CardDescricao>Prioridade</CardDescricao>
          <PrioridadeBadge prioridade={o.prioridade} />
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <CardDescricao>Entrega</CardDescricao>
          <p className="font-mono text-xl font-bold">{formatarDiaIso(o.prazoEntrega)}</p>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <CardDescricao>Término previsto</CardDescricao>
          {resumo?.fimPrevisto ? (
            <>
              <p className="font-mono text-xl font-bold">{formatarCurto(resumo.fimPrevisto, FUSO)}</p>
              <p className={resumo.atrasoMin > 0 ? "text-xs text-erro" : "text-xs text-sucesso"}>
                {resumo.atrasoMin > 0 ? `Atraso de ${formatarDuracao(resumo.atrasoMin)}` : "No prazo"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">{o.status === "liberada" || o.status === "em_execucao" ? "Sem programação aprovada" : "—"}</p>
          )}
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <CardDescricao>Operações concluídas</CardDescricao>
          <p className="font-mono text-xl font-bold">
            {concluidas}/{ativas}
          </p>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Operações</h2>
        {ops.length === 0 ? (
          <Vazio titulo="Ainda sem operações" descricao="As operações do roteiro são copiadas para a OP quando ela é liberada." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Seq.</Th>
                <Th>Operação</Th>
                <Th>Grupo</Th>
                <Th className="text-right">Duração prevista</Th>
                <Th>Programado (aprovado)</Th>
                <Th>Realizado</Th>
                <Th className="text-right">Boas / rejeitadas</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {ops.map(({ op, grupo, recursoReal }) => {
                const p = prev.get(op.id);
                const q = qtd.get(op.id);
                return (
                  <tr key={op.id}>
                    <Td className="font-mono">{op.sequencia}</Td>
                    <Td className="font-medium">
                      {op.nome}
                      {op.fixadaInicio && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-destaque" title="Data fixada no Gantt">
                          <Icone nome="alfinete" tamanho={12} /> fixada
                        </span>
                      )}
                    </Td>
                    <Td className="text-muted">{grupo}</Td>
                    <Td className="text-right font-mono">{formatarDuracao(op.setupMin + op.processamentoMin)}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {p ? (
                        <>
                          <span className="font-mono">
                            {formatarCurto(p.inicio.getTime(), FUSO)} → {formatarCurto(p.fim.getTime(), FUSO)}
                          </span>
                          <span className="block text-muted">{p.recurso}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {op.inicioReal ? (
                        <>
                          <span className="font-mono">
                            {formatarCurto(op.inicioReal.getTime(), FUSO)} → {op.fimReal ? formatarCurto(op.fimReal.getTime(), FUSO) : "…"}
                          </span>
                          <span className="block text-muted">{recursoReal}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right font-mono">{q ? `${Number(q.boa ?? 0)} / ${Number(q.rejeitada ?? 0)}` : "—"}</Td>
                    <Td>
                      <StatusOperacaoBadge status={op.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Histórico de status</h2>
          {historico.length === 0 ? (
            <p className="text-sm text-muted">Sem mudanças de status ainda.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-borda rounded-md border border-borda">
              {historico.map(({ h, usuario }) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    {h.de ? `${rotuloStatusOrdem[h.de]} → ` : ""}
                    <strong>{rotuloStatusOrdem[h.para]}</strong>
                    {h.motivo && <span className="text-muted"> · {h.motivo}</span>}
                  </span>
                  <span className="text-xs text-muted">
                    {formatarData(h.ocorridoEm)}
                    {usuario ? ` · ${usuario}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Dados da OP</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md border border-borda p-4 text-sm">
            <dt className="text-muted">Pedido de venda</dt>
            <dd>{o.pedidoVenda ?? "—"}</dd>
            <dt className="text-muted">Início mais cedo</dt>
            <dd>{o.inicioMaisCedo ? formatarDiaIso(o.inicioMaisCedo) : "—"}</dd>
            <dt className="text-muted">Liberada em</dt>
            <dd>{o.liberadaEm ? formatarData(o.liberadaEm) : "—"}</dd>
            <dt className="text-muted">Observações</dt>
            <dd className="whitespace-pre-wrap">{o.observacoes ?? "—"}</dd>
          </dl>
          {o.status === "liberada" && !resumo && (
            <Badge tom="alerta" className="w-fit">
              Esta OP ainda não está na programação aprovada
            </Badge>
          )}
        </div>
      </section>
    </div>
  );
}

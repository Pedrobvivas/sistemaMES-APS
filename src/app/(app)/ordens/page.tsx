import { and, asc, count, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { PrioridadeBadge, StatusOrdemBadge } from "@/components/ui/status";
import { LinhaLink } from "@/components/ui/linha-link";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { clientes, ordensProducao, produtos } from "@/db/schema";
import { rotuloStatusOrdem, type StatusOrdem } from "@/domain/ordens/status";
import { formatarCurto, formatarDuracao } from "@/domain/tempo";
import { exigirPermissao } from "@/lib/session";
import { formatarDiaIso } from "@/lib/utils";
import { FUSO } from "@/server/aps/entrada";
import { programacaoAprovada } from "@/server/aps/programacoes";

export const metadata: Metadata = { title: "Ordens de produção" };

const POR_PAGINA = 25;
const ordenacoes = {
  entrega: [asc(ordensProducao.prazoEntrega), asc(ordensProducao.codigo)],
  codigo: [asc(ordensProducao.codigo)],
  prioridade: [asc(ordensProducao.prioridade), asc(ordensProducao.prazoEntrega)],
} as const;

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; pagina?: string; ordem?: string }>;
}) {
  await exigirPermissao("ordens:editar");
  const sp = await searchParams;
  const busca = (sp.q ?? "").trim();
  // Filtro de status: "abertas" (padrão: rascunho, liberada, em execução), "todas" ou um status.
  // Com busca por texto e sem filtro escolhido, procura em todas.
  const status = (Object.keys(rotuloStatusOrdem) as StatusOrdem[]).includes(sp.status as StatusOrdem) ? (sp.status as StatusOrdem) : null;
  const filtroStatus = status ?? (sp.status === "todas" || sp.status === "abertas" ? sp.status : busca ? "todas" : "abertas");
  const ordem = (sp.ordem && sp.ordem in ordenacoes ? sp.ordem : "entrega") as keyof typeof ordenacoes;
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const filtros: SQL[] = [];
  if (status) filtros.push(eq(ordensProducao.status, status));
  else if (filtroStatus === "abertas") filtros.push(inArray(ordensProducao.status, ["rascunho", "liberada", "em_execucao"]));
  if (busca) {
    filtros.push(
      or(
        ilike(ordensProducao.codigo, `%${busca}%`),
        ilike(ordensProducao.pedidoVenda, `%${busca}%`),
        ilike(clientes.nome, `%${busca}%`),
        ilike(produtos.nome, `%${busca}%`),
      )!,
    );
  }
  const onde = filtros.length ? and(...filtros) : undefined;

  const [lista, [{ total }], aprovada] = await Promise.all([
    db
      .select({ o: ordensProducao, produto: produtos.nome, produtoCodigo: produtos.codigo, cliente: clientes.nome })
      .from(ordensProducao)
      .innerJoin(produtos, eq(produtos.id, ordensProducao.produtoId))
      .leftJoin(clientes, eq(clientes.id, ordensProducao.clienteId))
      .where(onde)
      .orderBy(...ordenacoes[ordem])
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA),
    db
      .select({ total: count() })
      .from(ordensProducao)
      .innerJoin(produtos, eq(produtos.id, ordensProducao.produtoId))
      .leftJoin(clientes, eq(clientes.id, ordensProducao.clienteId))
      .where(onde),
    programacaoAprovada(),
  ]);
  const previsao = new Map((aprovada?.resumoOrdens ?? []).map((r) => [r.ordemId, r]));
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (mudar: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const base = { q: busca, status: filtroStatus === "abertas" && !busca ? "" : filtroStatus, ordem, pagina: String(pagina), ...mudar };
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== "" && !(k === "pagina" && v === "1")) p.set(k, String(v));
    return `/ordens?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Ordens de produção"
        descricao={aprovada ? `Previsões da programação aprovada nº ${aprovada.numero}.` : "Ainda não há programação aprovada: as previsões aparecem depois de aprovar uma no Gantt."}
        acoes={
          <Link href="/ordens/nova" className={buttonClasses()}>
            <Icone nome="mais" tamanho={18} />
            Nova OP
          </Link>
        }
      />

      <form className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-xs font-semibold text-muted">
            Buscar
          </label>
          <Input id="q" name="q" type="search" placeholder="OP, pedido, cliente ou produto" defaultValue={busca} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs font-semibold text-muted">
            Status
          </label>
          <Select id="status" name="status" defaultValue={filtroStatus} className="w-44">
            <option value="abertas">Em aberto</option>
            <option value="todas">Todas</option>
            {Object.entries(rotuloStatusOrdem).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ordem" className="text-xs font-semibold text-muted">
            Ordenar por
          </label>
          <Select id="ordem" name="ordem" defaultValue={ordem} className="w-44">
            <option value="entrega">Data de entrega</option>
            <option value="prioridade">Prioridade</option>
            <option value="codigo">Código</option>
          </Select>
        </div>
        <Button type="submit" variante="secundaria">
          Filtrar
        </Button>
        {(busca || filtroStatus !== "abertas") && (
          <Link href="/ordens" className={buttonClasses({ variante: "fantasma" })}>
            Limpar filtros
          </Link>
        )}
      </form>

      {lista.length === 0 ? (
        <Vazio
          titulo={busca || status ? "Nenhuma OP encontrada" : filtroStatus === "abertas" ? "Nenhuma OP em aberto" : "Nenhuma OP cadastrada"}
          descricao={busca || status ? "Ajuste os filtros." : filtroStatus === "abertas" ? "Crie uma OP ou escolha “Todas” no filtro de status." : "Crie a primeira ordem de produção."}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>OP</Th>
                <Th>Produto</Th>
                <Th>Cliente</Th>
                <Th className="text-right">Qtd.</Th>
                <Th>Prioridade</Th>
                <Th>Entrega</Th>
                <Th>Término previsto</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ o, produto, produtoCodigo, cliente }) => {
                const p = previsao.get(o.id);
                return (
                  <LinhaLink key={o.id} href={`/ordens/${o.id}`}>
                    <Td>
                      <Link href={`/ordens/${o.id}`} className="inline-flex min-h-11 items-center font-mono font-semibold text-destaque hover:underline">
                        {o.codigo}
                      </Link>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-muted">{produtoCodigo}</span>
                      <span className="block">{produto}</span>
                    </Td>
                    <Td>{cliente ?? "—"}</Td>
                    <Td className="text-right font-mono">{o.quantidade}</Td>
                    <Td>
                      <PrioridadeBadge prioridade={o.prioridade} />
                    </Td>
                    <Td className="whitespace-nowrap font-mono">{formatarDiaIso(o.prazoEntrega)}</Td>
                    <Td className="whitespace-nowrap">
                      {o.status === "liberada" || o.status === "em_execucao" ? (
                        !p ? (
                          <span className="text-muted">Fora da programação</span>
                        ) : !p.completa || p.fimPrevisto === null ? (
                          <Badge tom="erro">Com conflito</Badge>
                        ) : (
                          <span className="flex flex-col">
                            <span className="font-mono">{formatarCurto(p.fimPrevisto, FUSO)}</span>
                            {p.atrasoMin > 0 ? (
                              <span className="text-xs text-erro">Atraso de {formatarDuracao(p.atrasoMin)}</span>
                            ) : (
                              <span className="text-xs text-sucesso">No prazo</span>
                            )}
                          </span>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusOrdemBadge status={o.status} />
                    </Td>
                  </LinhaLink>
                );
              })}
            </tbody>
          </Table>
          <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
            <p className="text-muted">
              {total} OP(s) · página {pagina} de {paginas}
            </p>
            <div className="flex gap-2">
              {pagina > 1 && (
                <Link href={link({ pagina: pagina - 1 })} className={buttonClasses({ variante: "secundaria", tamanho: "sm" })}>
                  Anterior
                </Link>
              )}
              {pagina < paginas && (
                <Link href={link({ pagina: pagina + 1 })} className={buttonClasses({ variante: "secundaria", tamanho: "sm" })}>
                  Próxima
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Icone } from "@/components/layout/icone";
import { Card, CardTitulo } from "@/components/ui/card";
import { Alerta, CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { gruposRecurso, produtos, roteiroOperacoes } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { removerOperacaoRoteiro, salvarOperacaoRoteiro, salvarProduto } from "../../actions";
import { BotaoRemover } from "../../calendario/botao-remover";

export const metadata: Metadata = { title: "Roteiro do produto" };

const numero = (v: string | number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default async function ProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string; salvo?: string }>;
}) {
  await exigirPermissao("cadastros:editar");
  const { id } = await params;
  const { editar, salvo } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [produto] = await db.select().from(produtos).where(eq(produtos.id, id)).limit(1);
  if (!produto) notFound();
  const [ops, grupos] = await Promise.all([
    db
      .select({ o: roteiroOperacoes, grupo: gruposRecurso.nome })
      .from(roteiroOperacoes)
      .innerJoin(gruposRecurso, eq(gruposRecurso.id, roteiroOperacoes.grupoRecursoId))
      .where(eq(roteiroOperacoes.produtoId, id))
      .orderBy(asc(roteiroOperacoes.sequencia), asc(roteiroOperacoes.nome)),
    db.select().from(gruposRecurso).orderBy(asc(gruposRecurso.nome)),
  ]);
  const atual = ops.find((x) => x.o.id === editar)?.o;
  const proximaSeq = ops.length ? Math.max(...ops.map((x) => x.o.sequencia)) + 10 : 10;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/cadastros/produtos" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <Icone nome="voltar" tamanho={16} /> Produtos
      </Link>
      <CabecalhoPagina
        titulo={`${produto.codigo} · ${produto.nome}`}
        descricao="Duração da operação na OP = tempo fixo + tempo por unidade × quantidade. A preparação (setup) entra antes. Operações com a mesma sequência podem correr em paralelo."
      />
      {salvo && <Alerta tom="sucesso">Alterações salvas. OPs já liberadas mantêm o roteiro copiado na liberação.</Alerta>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-bold">Roteiro</h2>
          {ops.length === 0 ? (
            <Vazio titulo="Roteiro vazio" descricao="Sem operações, OPs deste produto não podem ser liberadas." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Seq.</Th>
                  <Th>Operação</Th>
                  <Th>Grupo de recursos</Th>
                  <Th className="text-right">Setup (min)</Th>
                  <Th className="text-right">Fixo (min)</Th>
                  <Th className="text-right">Por unidade (min)</Th>
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {ops.map(({ o, grupo }) => (
                  <tr key={o.id}>
                    <Td className="font-mono">{o.sequencia}</Td>
                    <Td className="font-medium">{o.nome}</Td>
                    <Td>{grupo}</Td>
                    <Td className="text-right font-mono">{o.setupMin}</Td>
                    <Td className="text-right font-mono">{numero(o.tempoFixoMin)}</Td>
                    <Td className="text-right font-mono">{numero(o.tempoPorUnidadeMin)}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <Link href={`/cadastros/produtos/${id}?editar=${o.id}`} className="mr-2 inline-flex min-h-11 items-center text-destaque hover:underline">
                        Editar
                      </Link>
                      <BotaoRemover
                        acao={removerOperacaoRoteiro.bind(null, id, o.id)}
                        pergunta={`Remover "${o.nome}" do roteiro? OPs já liberadas não mudam.`}
                        rotulo={`Remover ${o.nome}`}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <CardTitulo>{atual ? `Editar ${atual.nome}` : "Nova operação"}</CardTitulo>
            {grupos.length === 0 ? (
              <Alerta tom="alerta">
                Cadastre antes um <Link href="/cadastros/grupos" className="underline">grupo de recursos</Link>.
              </Alerta>
            ) : (
              <FormCadastro
                key={atual?.id ?? "nova"}
                acao={salvarOperacaoRoteiro.bind(null, id, atual?.id ?? null)}
                cancelarHref={atual ? `/cadastros/produtos/${id}` : undefined}
                campos={[
                  { nome: "sequencia", rotulo: "Sequência", tipo: "numero", valor: atual?.sequencia ?? proximaSeq, min: 1, obrigatorio: true, largura: "metade" },
                  { nome: "setupMin", rotulo: "Preparação (min)", tipo: "numero", valor: atual?.setupMin ?? 0, min: 0, largura: "metade" },
                  { nome: "nome", rotulo: "Nome da operação", valor: atual?.nome, obrigatorio: true },
                  {
                    nome: "grupoRecursoId",
                    rotulo: "Grupo de recursos",
                    tipo: "select",
                    obrigatorio: true,
                    valor: atual?.grupoRecursoId ?? grupos[0]?.id,
                    opcoes: grupos.map((g) => ({ valor: g.id, rotulo: g.nome })),
                  },
                  { nome: "tempoFixoMin", rotulo: "Tempo fixo (min)", tipo: "numero", passo: "0.01", min: 0, valor: atual ? Number(atual.tempoFixoMin) : 0, largura: "metade" },
                  {
                    nome: "tempoPorUnidadeMin",
                    rotulo: "Por unidade (min)",
                    tipo: "numero",
                    passo: "0.01",
                    min: 0,
                    valor: atual ? Number(atual.tempoPorUnidadeMin) : 0,
                    largura: "metade",
                  },
                ]}
              />
            )}
          </Card>
          <Card className="flex flex-col gap-4">
            <CardTitulo>Dados do produto</CardTitulo>
            <FormCadastro
              idPrefixo="produto"
              acao={salvarProduto.bind(null, produto.id)}
              campos={[
                { nome: "codigo", rotulo: "Código", valor: produto.codigo, obrigatorio: true, largura: "metade" },
                { nome: "unidade", rotulo: "Unidade", valor: produto.unidade, obrigatorio: true, largura: "metade" },
                { nome: "nome", rotulo: "Nome", valor: produto.nome, obrigatorio: true },
                { nome: "ativo", rotulo: "Ativo", tipo: "caixa", valor: produto.ativo },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

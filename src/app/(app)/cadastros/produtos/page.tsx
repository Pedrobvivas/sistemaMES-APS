import { asc, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Vazio } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { PaginaCadastro } from "@/components/ui/pagina-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { produtos, roteiroOperacoes } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { salvarProduto } from "../actions";

export const metadata: Metadata = { title: "Produtos e roteiros" };

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { salvo } = await searchParams;
  const lista = await db
    .select({ p: produtos, nOperacoes: count(roteiroOperacoes.id) })
    .from(produtos)
    .leftJoin(roteiroOperacoes, eq(roteiroOperacoes.produtoId, produtos.id))
    .groupBy(produtos.id)
    .orderBy(asc(produtos.codigo));

  return (
    <PaginaCadastro
      titulo="Produtos e roteiros"
      descricao="Abra o produto para montar o roteiro: a sequência de operações, o grupo de recursos e os tempos."
      salvo={!!salvo}
      tituloForm="Novo produto"
      form={
        <FormCadastro
          acao={salvarProduto.bind(null, null)}
          campos={[
            { nome: "codigo", rotulo: "Código", obrigatorio: true, largura: "metade" },
            { nome: "unidade", rotulo: "Unidade", valor: "un", obrigatorio: true, largura: "metade" },
            { nome: "nome", rotulo: "Nome", obrigatorio: true },
            { nome: "ativo", rotulo: "Ativo", tipo: "caixa", valor: true },
          ]}
        />
      }
    >
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum produto cadastrado" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Nome</Th>
              <Th>Operações no roteiro</Th>
              <Th>Situação</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map(({ p, nOperacoes }) => (
              <tr key={p.id}>
                <Td className="font-mono font-semibold">{p.codigo}</Td>
                <Td>{p.nome}</Td>
                <Td className="font-mono">{nOperacoes || <span className="font-sans text-alerta">Sem roteiro</span>}</Td>
                <Td>
                  <Badge tom={p.ativo ? "sucesso" : "neutro"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                </Td>
                <Td className="text-right">
                  <Link href={`/cadastros/produtos/${p.id}`} className="inline-flex min-h-11 items-center text-destaque hover:underline">
                    Abrir roteiro
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </PaginaCadastro>
  );
}

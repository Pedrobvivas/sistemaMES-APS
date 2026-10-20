import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { Badge, Vazio } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { LinkEditar, PaginaCadastro } from "@/components/ui/pagina-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { operadores } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { salvarOperador } from "../actions";

export const metadata: Metadata = { title: "Operadores" };

export default async function OperadoresPage({ searchParams }: { searchParams: Promise<{ editar?: string; salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { editar, salvo } = await searchParams;
  const lista = await db.select().from(operadores).orderBy(asc(operadores.nome));
  const atual = lista.find((o) => o.id === editar);

  return (
    <PaginaCadastro
      titulo="Operadores"
      descricao="Pessoas que apontam a produção no terminal. Não precisam de login próprio."
      salvo={!!salvo}
      tituloForm={atual ? `Editar ${atual.matricula}` : "Novo operador"}
      form={
        <FormCadastro
          key={atual?.id ?? "novo"}
          acao={salvarOperador.bind(null, atual?.id ?? null)}
          cancelarHref={atual ? "/cadastros/operadores" : undefined}
          campos={[
            { nome: "matricula", rotulo: "Matrícula", valor: atual?.matricula, obrigatorio: true, largura: "metade" },
            { nome: "nome", rotulo: "Nome", valor: atual?.nome, obrigatorio: true },
            { nome: "ativo", rotulo: "Ativo (aparece no terminal)", tipo: "caixa", valor: atual?.ativo ?? true },
          ]}
        />
      }
    >
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum operador cadastrado" descricao="Cadastre quem vai apontar a produção." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Matrícula</Th>
              <Th>Nome</Th>
              <Th>Situação</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono font-semibold">{o.matricula}</Td>
                <Td>{o.nome}</Td>
                <Td>
                  <Badge tom={o.ativo ? "sucesso" : "neutro"}>{o.ativo ? "Ativo" : "Inativo"}</Badge>
                </Td>
                <Td className="text-right">
                  <LinkEditar href={`/cadastros/operadores?editar=${o.id}`} rotulo={`Editar ${o.nome}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </PaginaCadastro>
  );
}

import { asc, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Badge, Vazio } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { LinkEditar, PaginaCadastro } from "@/components/ui/pagina-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { centrosTrabalho, recursos } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { salvarCentro } from "../actions";

export const metadata: Metadata = { title: "Centros de trabalho" };

export default async function CentrosPage({ searchParams }: { searchParams: Promise<{ editar?: string; salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { editar, salvo } = await searchParams;
  const lista = await db
    .select({ c: centrosTrabalho, nRecursos: count(recursos.id) })
    .from(centrosTrabalho)
    .leftJoin(recursos, eq(recursos.centroId, centrosTrabalho.id))
    .groupBy(centrosTrabalho.id)
    .orderBy(asc(centrosTrabalho.ordem), asc(centrosTrabalho.nome));
  const atual = lista.find((l) => l.c.id === editar)?.c;

  return (
    <PaginaCadastro
      titulo="Centros de trabalho"
      descricao="Setores da fábrica. A ordem define a posição das linhas no Gantt."
      salvo={!!salvo}
      tituloForm={atual ? `Editar ${atual.codigo}` : "Novo centro"}
      form={
        <FormCadastro
          key={atual?.id ?? "novo"}
          acao={salvarCentro.bind(null, atual?.id ?? null)}
          cancelarHref={atual ? "/cadastros/centros" : undefined}
          campos={[
            { nome: "codigo", rotulo: "Código", valor: atual?.codigo, obrigatorio: true, largura: "metade" },
            { nome: "ordem", rotulo: "Ordem no Gantt", tipo: "numero", valor: atual?.ordem ?? lista.length + 1, min: 0, largura: "metade" },
            { nome: "nome", rotulo: "Nome", valor: atual?.nome, obrigatorio: true },
            { nome: "ativo", rotulo: "Ativo", tipo: "caixa", valor: atual?.ativo ?? true },
          ]}
        />
      }
    >
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum centro cadastrado" descricao="Cadastre os setores da fábrica, por exemplo: Corte, Montagem, Pintura." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ordem</Th>
              <Th>Código</Th>
              <Th>Nome</Th>
              <Th>Recursos</Th>
              <Th>Situação</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map(({ c, nRecursos }) => (
              <tr key={c.id}>
                <Td className="font-mono">{c.ordem}</Td>
                <Td className="font-mono font-semibold">{c.codigo}</Td>
                <Td>{c.nome}</Td>
                <Td className="font-mono">{nRecursos}</Td>
                <Td>
                  <Badge tom={c.ativo ? "sucesso" : "neutro"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                </Td>
                <Td className="text-right">
                  <LinkEditar href={`/cadastros/centros?editar=${c.id}`} rotulo={`Editar ${c.nome}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </PaginaCadastro>
  );
}

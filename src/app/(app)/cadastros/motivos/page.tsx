import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { Badge, Vazio } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { LinkEditar, PaginaCadastro } from "@/components/ui/pagina-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { motivosParada } from "@/db/schema";
import { rotuloCategoriaParada } from "@/lib/rotulos";
import { exigirPermissao } from "@/lib/session";
import { salvarMotivo } from "../actions";

export const metadata: Metadata = { title: "Motivos de parada" };

export default async function MotivosPage({ searchParams }: { searchParams: Promise<{ editar?: string; salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { editar, salvo } = await searchParams;
  const lista = await db.select().from(motivosParada).orderBy(asc(motivosParada.categoria), asc(motivosParada.nome));
  const atual = lista.find((m) => m.id === editar);

  return (
    <PaginaCadastro
      titulo="Motivos de parada"
      descricao="Escolhidos pelo operador ao pausar. Alimentam o Pareto de paradas do painel."
      salvo={!!salvo}
      tituloForm={atual ? `Editar ${atual.codigo}` : "Novo motivo"}
      form={
        <FormCadastro
          key={atual?.id ?? "novo"}
          acao={salvarMotivo.bind(null, atual?.id ?? null)}
          cancelarHref={atual ? "/cadastros/motivos" : undefined}
          campos={[
            { nome: "codigo", rotulo: "Código", valor: atual?.codigo, obrigatorio: true, largura: "metade" },
            {
              nome: "categoria",
              rotulo: "Categoria",
              tipo: "select",
              obrigatorio: true,
              largura: "metade",
              valor: atual?.categoria ?? "nao_planejada",
              opcoes: Object.entries(rotuloCategoriaParada).map(([valor, rotulo]) => ({ valor, rotulo })),
            },
            { nome: "nome", rotulo: "Nome", valor: atual?.nome, obrigatorio: true },
            { nome: "ativo", rotulo: "Ativo (aparece no terminal)", tipo: "caixa", valor: atual?.ativo ?? true },
          ]}
        />
      }
    >
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum motivo cadastrado" descricao="Sem motivos, o operador não consegue registrar uma pausa." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Nome</Th>
              <Th>Categoria</Th>
              <Th>Situação</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id}>
                <Td className="font-mono font-semibold">{m.codigo}</Td>
                <Td>{m.nome}</Td>
                <Td className="text-muted">{rotuloCategoriaParada[m.categoria]}</Td>
                <Td>
                  <Badge tom={m.ativo ? "sucesso" : "neutro"}>{m.ativo ? "Ativo" : "Inativo"}</Badge>
                </Td>
                <Td className="text-right">
                  <LinkEditar href={`/cadastros/motivos?editar=${m.id}`} rotulo={`Editar ${m.nome}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </PaginaCadastro>
  );
}

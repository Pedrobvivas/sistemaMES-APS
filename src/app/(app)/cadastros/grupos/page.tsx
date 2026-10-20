import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Alerta, Badge, Vazio } from "@/components/ui/feedback";
import { LinkEditar, PaginaCadastro } from "@/components/ui/pagina-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { centrosTrabalho, grupoRecursoMembros, gruposRecurso, recursos } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { salvarGrupo } from "../actions";
import { FormGrupo } from "./form";

export const metadata: Metadata = { title: "Grupos de recursos" };

export default async function GruposPage({ searchParams }: { searchParams: Promise<{ editar?: string; salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { editar, salvo } = await searchParams;
  const [grupos, membros, listaRecursos] = await Promise.all([
    db.select().from(gruposRecurso).orderBy(asc(gruposRecurso.codigo)),
    db
      .select({ grupoId: grupoRecursoMembros.grupoId, recursoId: grupoRecursoMembros.recursoId, preferencia: grupoRecursoMembros.preferencia, codigo: recursos.codigo, ativo: recursos.ativo })
      .from(grupoRecursoMembros)
      .innerJoin(recursos, eq(recursos.id, grupoRecursoMembros.recursoId))
      .orderBy(asc(grupoRecursoMembros.preferencia), asc(recursos.codigo)),
    db
      .select({ id: recursos.id, codigo: recursos.codigo, nome: recursos.nome, centro: centrosTrabalho.nome })
      .from(recursos)
      .innerJoin(centrosTrabalho, eq(centrosTrabalho.id, recursos.centroId))
      .orderBy(asc(centrosTrabalho.ordem), asc(recursos.codigo)),
  ]);
  const atual = grupos.find((g) => g.id === editar);
  const membrosAtual = Object.fromEntries(membros.filter((m) => m.grupoId === atual?.id).map((m) => [m.recursoId, m.preferencia]));

  return (
    <PaginaCadastro
      titulo="Grupos de recursos"
      descricao="Cada operação do roteiro aponta para um grupo: são os recursos elegíveis para ela."
      salvo={!!salvo}
      tituloForm={atual ? `Editar ${atual.codigo}` : "Novo grupo"}
      form={
        listaRecursos.length === 0 ? (
          <Alerta tom="alerta">
            Cadastre antes os <Link href="/cadastros/recursos" className="underline">recursos</Link>.
          </Alerta>
        ) : (
          <FormGrupo key={atual?.id ?? "novo"} acao={salvarGrupo.bind(null, atual?.id ?? null)} grupo={atual} recursos={listaRecursos} membros={membrosAtual} />
        )
      }
    >
      {grupos.length === 0 ? (
        <Vazio titulo="Nenhum grupo cadastrado" descricao="Exemplo: “Eletricistas” com os eletricistas A, B e C." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Nome</Th>
              <Th>Recursos (preferencial primeiro)</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const lista = membros.filter((m) => m.grupoId === g.id);
              return (
                <tr key={g.id}>
                  <Td className="font-mono font-semibold">{g.codigo}</Td>
                  <Td>{g.nome}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {lista.length === 0 && <span className="text-alerta">Nenhum recurso</span>}
                      {lista.map((m) => (
                        <Badge key={m.recursoId} tom={m.ativo ? (m.preferencia === 1 ? "destaque" : "neutro") : "erro"}>
                          {m.codigo}
                          {m.preferencia === 2 ? " · alt." : ""}
                          {!m.ativo ? " · inativo" : ""}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <LinkEditar href={`/cadastros/grupos?editar=${g.id}`} rotulo={`Editar ${g.nome}`} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </PaginaCadastro>
  );
}

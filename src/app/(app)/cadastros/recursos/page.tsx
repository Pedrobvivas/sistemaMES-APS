import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Alerta, Badge, Vazio } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { LinkEditar, PaginaCadastro } from "@/components/ui/pagina-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { centrosTrabalho, recursos, turnos } from "@/db/schema";
import { rotuloTipoRecurso } from "@/lib/rotulos";
import { exigirPermissao } from "@/lib/session";
import { salvarRecurso } from "../actions";

export const metadata: Metadata = { title: "Recursos" };

export default async function RecursosPage({ searchParams }: { searchParams: Promise<{ editar?: string; salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { editar, salvo } = await searchParams;
  const [lista, centros, listaTurnos] = await Promise.all([
    db
      .select({ r: recursos, centro: centrosTrabalho.nome, turno: turnos.nome })
      .from(recursos)
      .innerJoin(centrosTrabalho, eq(centrosTrabalho.id, recursos.centroId))
      .leftJoin(turnos, eq(turnos.id, recursos.turnoId))
      .orderBy(asc(centrosTrabalho.ordem), asc(recursos.codigo)),
    db.select().from(centrosTrabalho).orderBy(asc(centrosTrabalho.ordem)),
    db.select().from(turnos).orderBy(asc(turnos.nome)),
  ]);
  const atual = lista.find((l) => l.r.id === editar)?.r;

  return (
    <PaginaCadastro
      titulo="Recursos"
      descricao="Máquinas, postos e pessoas que executam operações. Sem turno, o recurso não recebe programação."
      salvo={!!salvo}
      tituloForm={atual ? `Editar ${atual.codigo}` : "Novo recurso"}
      form={
        centros.length === 0 ? (
          <Alerta tom="alerta">
            Cadastre antes um <Link href="/cadastros/centros" className="underline">centro de trabalho</Link>.
          </Alerta>
        ) : (
          <FormCadastro
            key={atual?.id ?? "novo"}
            acao={salvarRecurso.bind(null, atual?.id ?? null)}
            cancelarHref={atual ? "/cadastros/recursos" : undefined}
            campos={[
              { nome: "codigo", rotulo: "Código", valor: atual?.codigo, obrigatorio: true, largura: "metade" },
              {
                nome: "tipo",
                rotulo: "Tipo",
                tipo: "select",
                obrigatorio: true,
                largura: "metade",
                valor: atual?.tipo ?? "posto",
                opcoes: Object.entries(rotuloTipoRecurso).map(([valor, rotulo]) => ({ valor, rotulo })),
              },
              { nome: "nome", rotulo: "Nome", valor: atual?.nome, obrigatorio: true },
              {
                nome: "centroId",
                rotulo: "Centro de trabalho",
                tipo: "select",
                obrigatorio: true,
                valor: atual?.centroId ?? centros[0]?.id,
                opcoes: centros.map((c) => ({ valor: c.id, rotulo: c.nome })),
              },
              {
                nome: "turnoId",
                rotulo: "Turno",
                tipo: "select",
                valor: atual?.turnoId,
                ajuda: "Define quando o recurso trabalha.",
                opcoes: listaTurnos.map((t) => ({ valor: t.id, rotulo: t.nome })),
              },
              { nome: "ativo", rotulo: "Ativo (recebe programação)", tipo: "caixa", valor: atual?.ativo ?? true },
            ]}
          />
        )
      }
    >
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum recurso cadastrado" descricao="Cadastre máquinas, postos ou pessoas e associe um turno." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Nome</Th>
              <Th>Tipo</Th>
              <Th>Centro</Th>
              <Th>Turno</Th>
              <Th>Situação</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map(({ r, centro, turno }) => (
              <tr key={r.id}>
                <Td className="font-mono font-semibold">{r.codigo}</Td>
                <Td>{r.nome}</Td>
                <Td className="text-muted">{rotuloTipoRecurso[r.tipo]}</Td>
                <Td>{centro}</Td>
                <Td>{turno ?? <span className="text-alerta">Sem turno</span>}</Td>
                <Td>
                  <Badge tom={r.ativo ? "sucesso" : "neutro"}>{r.ativo ? "Ativo" : "Inativo"}</Badge>
                </Td>
                <Td className="text-right">
                  <LinkEditar href={`/cadastros/recursos?editar=${r.id}`} rotulo={`Editar ${r.nome}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </PaginaCadastro>
  );
}

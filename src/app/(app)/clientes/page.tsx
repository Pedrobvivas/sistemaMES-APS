import { desc, ilike, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { clientes } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { formatarData } from "@/lib/utils";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession();
  const { q = "" } = await searchParams;
  const busca = q.trim();

  const lista = await db
    .select()
    .from(clientes)
    .where(busca ? or(ilike(clientes.nome, `%${busca}%`), ilike(clientes.email, `%${busca}%`)) : undefined)
    .orderBy(desc(clientes.criadoEm))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Cadastro de exemplo: use como molde para novas telas."
        acoes={
          <Link href="/clientes/novo" className={buttonClasses()}>
            <Icone nome="mais" tamanho={18} />
            Novo cliente
          </Link>
        }
      />

      <form className="flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Buscar clientes
        </label>
        <Input id="q" name="q" type="search" placeholder="Buscar por nome ou e-mail" defaultValue={busca} />
        <Button type="submit" variante="secundaria">
          Buscar
        </Button>
      </form>

      {lista.length === 0 ? (
        <Vazio
          titulo={busca ? "Nenhum resultado" : "Nenhum cliente cadastrado"}
          descricao={busca ? `Nada encontrado para "${busca}".` : "Comece cadastrando o primeiro cliente."}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Contato</Th>
              <Th>Status</Th>
              <Th>Cadastrado em</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((cliente) => (
              <tr key={cliente.id}>
                <Td className="font-medium">{cliente.nome}</Td>
                <Td className="text-muted">{cliente.email ?? cliente.telefone ?? "—"}</Td>
                <Td>
                  <Badge tom={cliente.status === "ativo" ? "sucesso" : "neutro"}>
                    {cliente.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatarData(cliente.criadoEm)}</Td>
                <Td className="text-right">
                  <Link href={`/clientes/${cliente.id}/editar`} className="text-destaque hover:underline">
                    Editar
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

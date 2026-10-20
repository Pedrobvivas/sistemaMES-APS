import { count, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescricao } from "@/components/ui/card";
import { CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { db } from "@/db";
import { clientes, user } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { formatarData } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel" };

export default async function PainelPage() {
  const { user: usuario } = await requireSession();

  const [[totalClientes], [ativos], [totalUsuarios], recentes] = await Promise.all([
    db.select({ n: count() }).from(clientes),
    db.select({ n: count() }).from(clientes).where(eq(clientes.status, "ativo")),
    db.select({ n: count() }).from(user),
    db.select().from(clientes).orderBy(desc(clientes.criadoEm)).limit(5),
  ]);

  const indicadores = [
    { rotulo: "Clientes cadastrados", valor: totalClientes.n },
    { rotulo: "Clientes ativos", valor: ativos.n },
    { rotulo: "Usuários do sistema", valor: totalUsuarios.n },
  ];

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo={`Olá, ${usuario.name.split(" ")[0]}`} descricao="Resumo do sistema." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {indicadores.map((item) => (
          <Card key={item.rotulo} className="flex flex-col gap-2">
            <CardDescricao>{item.rotulo}</CardDescricao>
            <p className="font-display text-3xl font-bold">{item.valor}</p>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Últimos clientes</h2>
          <Link href="/clientes" className="text-sm text-destaque hover:underline">
            Ver todos
          </Link>
        </div>
        {recentes.length === 0 ? (
          <Vazio
            titulo="Nenhum cliente ainda"
            descricao="Cadastre o primeiro para ver o resumo aqui."
            acao={
              <Link href="/clientes/novo" className={buttonClasses()}>
                Cadastrar cliente
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-borda rounded-md border border-borda">
            {recentes.map((cliente) => (
              <li key={cliente.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <Link href={`/clientes/${cliente.id}/editar`} className="font-medium hover:text-destaque">
                  {cliente.nome}
                </Link>
                <span className="text-xs text-muted">{formatarData(cliente.criadoEm)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

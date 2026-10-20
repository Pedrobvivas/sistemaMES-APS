import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CabecalhoPagina } from "@/components/ui/feedback";
import { db } from "@/db";
import { clientes } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { formatarData } from "@/lib/utils";
import { BotaoExcluirCliente } from "../../botao-excluir";
import { FormCliente } from "../../form";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await exigirPermissao("ordens:editar");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  if (!cliente) notFound();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={cliente.nome}
        descricao={`Cadastrado em ${formatarData(cliente.criadoEm)}`}
        acoes={user.role === "admin" ? <BotaoExcluirCliente id={cliente.id} nome={cliente.nome} /> : undefined}
      />
      <FormCliente cliente={cliente} />
    </div>
  );
}

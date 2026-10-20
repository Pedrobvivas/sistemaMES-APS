import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Icone } from "@/components/layout/icone";
import { Alerta, CabecalhoPagina } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { db } from "@/db";
import { clientes, ordensProducao, produtos } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { camposEditaveis } from "@/server/ordens";
import { salvarOrdem } from "../../actions";
import { camposOrdem } from "../../campos";

export const metadata: Metadata = { title: "Editar OP" };

export default async function EditarOrdemPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao("ordens:editar");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [ordem] = await db.select().from(ordensProducao).where(eq(ordensProducao.id, id)).limit(1);
  if (!ordem) notFound();
  const [listaProdutos, listaClientes] = await Promise.all([
    db.select().from(produtos).orderBy(asc(produtos.codigo)),
    db.select().from(clientes).orderBy(asc(clientes.nome)),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href={`/ordens/${id}`} className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <Icone nome="voltar" tamanho={16} /> OP {ordem.codigo}
      </Link>
      <CabecalhoPagina titulo={`Editar OP ${ordem.codigo}`} />
      {camposEditaveis(ordem.status).demais ? (
        <>
          {ordem.status !== "rascunho" && (
            <Alerta tom="alerta">Mudanças de prazo, prioridade ou quantidade só entram no Gantt depois de gerar uma nova programação.</Alerta>
          )}
          <FormCadastro
            acao={salvarOrdem.bind(null, ordem.id)}
            cancelarHref={`/ordens/${id}`}
            campos={camposOrdem(ordem, { produtos: listaProdutos, clientes: listaClientes })}
          />
        </>
      ) : (
        <Alerta tom="neutro">OPs concluídas ou canceladas não podem ser alteradas.</Alerta>
      )}
    </div>
  );
}

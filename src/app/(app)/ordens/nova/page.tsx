import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { Alerta, CabecalhoPagina } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { db } from "@/db";
import { clientes, produtos } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { salvarOrdem } from "../actions";
import { camposOrdem } from "../campos";

export const metadata: Metadata = { title: "Nova OP" };

export default async function NovaOrdemPage() {
  await exigirPermissao("ordens:editar");
  const [listaProdutos, listaClientes] = await Promise.all([
    db.select().from(produtos).where(eq(produtos.ativo, true)).orderBy(asc(produtos.codigo)),
    db.select().from(clientes).where(eq(clientes.status, "ativo")).orderBy(asc(clientes.nome)),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/ordens" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <Icone nome="voltar" tamanho={16} /> Ordens de produção
      </Link>
      <CabecalhoPagina titulo="Nova ordem de produção" descricao="A OP nasce como rascunho. Ao liberar, o roteiro do produto é copiado para ela." />
      {listaProdutos.length === 0 ? (
        <Alerta tom="alerta">
          Cadastre antes um <Link href="/cadastros/produtos" className="underline">produto com roteiro</Link>.
        </Alerta>
      ) : (
        <FormCadastro acao={salvarOrdem.bind(null, null)} cancelarHref="/ordens" rotuloBotao="Criar OP" campos={camposOrdem(null, { produtos: listaProdutos, clientes: listaClientes })} />
      )}
    </div>
  );
}

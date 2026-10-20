import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { Card, CardTitulo } from "@/components/ui/card";
import { Alerta, CabecalhoPagina } from "@/components/ui/feedback";

// Molde das telas de cadastro: lista à esquerda, formulário (novo ou edição) à direita.
export function PaginaCadastro({
  titulo,
  descricao,
  salvo,
  tituloForm,
  form,
  children,
}: {
  titulo: string;
  descricao: string;
  salvo?: boolean;
  tituloForm: string;
  form: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/cadastros" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <Icone nome="voltar" tamanho={16} /> Cadastros
      </Link>
      <CabecalhoPagina titulo={titulo} descricao={descricao} />
      {salvo && <Alerta tom="sucesso">Alterações salvas.</Alerta>}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0">{children}</div>
        <Card className="flex flex-col gap-4 self-start">
          <CardTitulo>{tituloForm}</CardTitulo>
          {form}
        </Card>
      </div>
    </div>
  );
}

export function LinkEditar({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-destaque hover:underline" aria-label={rotulo}>
      Editar
    </Link>
  );
}

import Link from "next/link";
import { BotaoSair } from "@/components/layout/acoes-usuario";
import { Marca } from "@/components/layout/marca";
import { SeloDemonstracao } from "@/components/ui/selo-demonstracao";
import { pode } from "@/lib/papeis";
import { exigirPermissao } from "@/lib/session";
import { appName } from "@/lib/utils";
import { estadoDemonstracao } from "@/server/demonstracao";

// Terminal do chão de fábrica: tema claro de alto contraste e botões grandes,
// independente do tema escolhido no escritório.
export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await exigirPermissao("execucao:apontar");
  const demonstracao = await estadoDemonstracao();
  return (
    <div data-theme="light" className="min-h-screen bg-surface text-ink">
      <header className="flex h-16 items-center gap-3 border-b border-borda bg-surface-2 px-4">
        <Link href="/terminal" className="flex items-center gap-2 font-display text-lg font-bold">
          <Marca tamanho={28} /> Terminal de produção
        </Link>
        <span className="hidden text-sm text-muted md:inline">{appName}</span>
        {demonstracao && <SeloDemonstracao />}
        <div className="ml-auto flex items-center gap-2">
          {pode(user.role, "painel:ver") && (
            <Link href="/painel" className="inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold text-destaque hover:bg-surface">
              Voltar ao sistema
            </Link>
          )}
          <span className="hidden text-sm font-semibold sm:inline">{user.name}</span>
          <BotaoSair />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl p-4 lg:p-6">{children}</main>
    </div>
  );
}

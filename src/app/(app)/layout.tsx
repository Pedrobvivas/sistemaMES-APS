import { BotaoSair, BotaoTema } from "@/components/layout/acoes-usuario";
import { Icone } from "@/components/layout/icone";
import { itensMenu } from "@/components/layout/menu";
import { Nav } from "@/components/layout/nav";
import { SeloDemonstracao } from "@/components/ui/selo-demonstracao";
import { normalizarPapel, pode, rotuloPapel } from "@/lib/papeis";
import { requireSession } from "@/lib/session";
import { appName } from "@/lib/utils";
import { estadoDemonstracao } from "@/server/demonstracao";

// Estrutura de todas as telas internas: menu lateral + cabeçalho.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  const demonstracao = await estadoDemonstracao();
  const itens = itensMenu.filter((item) => !item.permissao || pode(user.role, item.permissao));
  const iniciais = user.name
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col gap-8 border-r border-borda bg-surface-2 p-4 lg:flex">
        <div className="px-3 pt-2">
          <p className="font-display text-lg font-bold">{appName}</p>
          <p className="text-xs text-muted">PCP · APS · MES — Camargo TI</p>
        </div>
        <Nav itens={itens} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-borda px-4 lg:px-8">
          <details className="relative lg:hidden">
            <summary
              aria-label="Abrir menu"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md hover:bg-surface-2"
            >
              <Icone nome="menu" />
            </summary>
            <div className="absolute left-0 top-12 z-30 w-64 rounded-md border border-borda bg-surface-2 p-2 shadow-lg">
              <Nav itens={itens} />
            </div>
          </details>
          <p className="font-display font-bold lg:hidden">{appName}</p>
          {demonstracao && <SeloDemonstracao />}

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-muted">{rotuloPapel[normalizarPapel(user.role)]}</p>
            </div>
            <div
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primaria text-xs font-bold text-primaria-texto"
            >
              {iniciais}
            </div>
            <BotaoTema />
            <BotaoSair />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

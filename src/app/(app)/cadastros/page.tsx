import { count } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { CabecalhoPagina } from "@/components/ui/feedback";
import { db } from "@/db";
import { centrosTrabalho, gruposRecurso, indisponibilidades, motivosParada, operadores, produtos, recursos, turnos } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";

export const metadata: Metadata = { title: "Cadastros" };

export default async function CadastrosPage() {
  await exigirPermissao("cadastros:editar");
  const [[nCentros], [nRecursos], [nGrupos], [nTurnos], [nIndisp], [nProdutos], [nMotivos], [nOperadores]] = await Promise.all([
    db.select({ n: count() }).from(centrosTrabalho),
    db.select({ n: count() }).from(recursos),
    db.select({ n: count() }).from(gruposRecurso),
    db.select({ n: count() }).from(turnos),
    db.select({ n: count() }).from(indisponibilidades),
    db.select({ n: count() }).from(produtos),
    db.select({ n: count() }).from(motivosParada),
    db.select({ n: count() }).from(operadores),
  ]);

  const cartoes = [
    { href: "/cadastros/centros", titulo: "Centros de trabalho", texto: "Setores da fábrica; agrupam as linhas do Gantt.", n: nCentros.n },
    { href: "/cadastros/recursos", titulo: "Recursos", texto: "Máquinas, postos e pessoas que recebem operações.", n: nRecursos.n },
    { href: "/cadastros/grupos", titulo: "Grupos de recursos", texto: "Quem pode executar cada operação (recursos alternativos).", n: nGrupos.n },
    { href: "/cadastros/turnos", titulo: "Turnos", texto: "Dias e horários de trabalho de cada recurso.", n: nTurnos.n },
    { href: "/cadastros/calendario", titulo: "Feriados e indisponibilidades", texto: "Dias sem expediente e paradas programadas.", n: nIndisp.n },
    { href: "/cadastros/produtos", titulo: "Produtos e roteiros", texto: "Etapas de fabricação, tempos e preparação.", n: nProdutos.n },
    { href: "/cadastros/motivos", titulo: "Motivos de parada", texto: "Causas usadas no apontamento e no Pareto.", n: nMotivos.n },
    { href: "/cadastros/operadores", titulo: "Operadores", texto: "Quem aponta a produção no terminal.", n: nOperadores.n },
  ];

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Cadastros" descricao="Tudo que o sequenciador precisa para programar a fábrica." />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="flex h-full flex-col gap-2 rounded-md border border-borda bg-surface-2 p-5 transition-colors hover:border-muted"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-base font-bold">{c.titulo}</h2>
                <span className="font-mono text-sm text-muted">{c.n}</span>
              </div>
              <p className="text-sm text-muted">{c.texto}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm text-destaque">
                Abrir <Icone nome="avancar" tamanho={14} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

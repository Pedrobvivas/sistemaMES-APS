import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { Vazio } from "@/components/ui/feedback";
import { db } from "@/db";
import { centrosTrabalho } from "@/db/schema";
import { formatarDuracao } from "@/domain/tempo";
import { exigirPermissao } from "@/lib/session";
import { cn } from "@/lib/utils";
import { situacaoRecursos } from "@/server/mes";
import { Atualizador } from "@/components/layout/atualizador";

export const metadata: Metadata = { title: "Terminal de produção" };

const estilo = {
  produzindo: { texto: "Produzindo", classe: "border-sucesso", icone: "iniciar" },
  parado: { texto: "Parado", classe: "border-alerta", icone: "pausar" },
  ocioso: { texto: "Livre", classe: "border-borda", icone: "relogio" },
} as const;

export default async function TerminalPage() {
  await exigirPermissao("execucao:apontar");
  const [recursos, centros] = await Promise.all([situacaoRecursos(), db.select().from(centrosTrabalho).orderBy(asc(centrosTrabalho.ordem))]);

  return (
    <div className="flex flex-col gap-6">
      <Atualizador />
      <div>
        <h1 className="text-2xl font-bold">Escolha o recurso</h1>
        <p className="text-sm text-muted">Toque no posto, máquina ou pessoa onde você vai apontar. A tela se atualiza sozinha.</p>
      </div>
      {recursos.length === 0 ? (
        <Vazio titulo="Nenhum recurso ativo" />
      ) : (
        centros
          .filter((c) => recursos.some((r) => r.centroId === c.id))
          .map((c) => (
            <section key={c.id} className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{c.nome}</h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recursos
                  .filter((r) => r.centroId === c.id)
                  .map((r) => {
                    const e = estilo[r.estado];
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/terminal/${r.id}`}
                          className={cn("flex min-h-28 flex-col gap-2 rounded-md border-2 bg-surface-2 p-4 transition-colors hover:bg-surface", e.classe)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-lg font-bold">{r.nome}</span>
                            <span className="font-mono text-xs text-muted">{r.codigo}</span>
                          </div>
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            <Icone nome={e.icone} tamanho={16} /> {e.texto}
                          </span>
                          {r.atual && <span className="text-sm">{r.atual}</span>}
                          {r.estado === "parado" && r.motivoParada && (
                            <span className="text-sm text-alerta">
                              {r.motivoParada}
                              {r.desde && ` · há ${formatarDuracao((Date.now() - r.desde.getTime()) / 60000)}`}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}

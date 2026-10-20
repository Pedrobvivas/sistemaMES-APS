import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Icone } from "@/components/layout/icone";
import { db } from "@/db";
import { motivosParada, operadores, recursos } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { FUSO } from "@/server/aps/entrada";
import { filaDoRecurso } from "@/server/mes";
import { Atualizador } from "@/components/layout/atualizador";
import { PainelRecurso } from "./painel";

export const metadata: Metadata = { title: "Apontamento" };

export default async function RecursoTerminalPage({ params }: { params: Promise<{ recursoId: string }> }) {
  await exigirPermissao("execucao:apontar");
  const { recursoId } = await params;
  if (!z.string().uuid().safeParse(recursoId).success) notFound();
  const [recurso] = await db.select().from(recursos).where(eq(recursos.id, recursoId)).limit(1);
  if (!recurso || !recurso.ativo) notFound();
  const [fila, listaOperadores, motivos] = await Promise.all([
    filaDoRecurso(recursoId),
    db.select().from(operadores).where(eq(operadores.ativo, true)).orderBy(asc(operadores.nome)),
    db.select().from(motivosParada).where(eq(motivosParada.ativo, true)).orderBy(asc(motivosParada.categoria), asc(motivosParada.nome)),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Atualizador />
      <Link href="/terminal" className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <Icone nome="voltar" tamanho={18} /> Trocar de recurso
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{recurso.nome}</h1>
        <p className="font-mono text-sm text-muted">{recurso.codigo}</p>
      </div>
      <PainelRecurso
        recursoId={recurso.id}
        fuso={FUSO}
        operadores={listaOperadores.map((o) => ({ id: o.id, nome: o.nome, matricula: o.matricula }))}
        motivos={motivos.map((m) => ({ id: m.id, nome: m.nome, categoria: m.categoria }))}
        temProgramacao={fila.temProgramacao}
        emAndamento={fila.emAndamento.map((o) => ({ id: o.id, nome: o.nome, ordemCodigo: o.ordemCodigo, quantidade: o.quantidade, status: o.status, inicioReal: o.inicioReal?.getTime() ?? null }))}
        proximas={fila.proximas.map((o) => ({
          id: o.id,
          nome: o.nome,
          ordemCodigo: o.ordemCodigo,
          quantidade: o.quantidade,
          inicioPrevisto: o.inicioPrevisto.getTime(),
          fimPrevisto: o.fimPrevisto.getTime(),
          bloqueio: o.bloqueio,
        }))}
      />
    </div>
  );
}

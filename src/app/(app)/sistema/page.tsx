import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Card, CardDescricao, CardTitulo } from "@/components/ui/card";
import { CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { auditoria, user } from "@/db/schema";
import { exigirPermissao } from "@/lib/session";
import { formatarData } from "@/lib/utils";
import { estadoDemonstracao } from "@/server/demonstracao";
import { AcoesDemonstracao } from "./acoes";

export const metadata: Metadata = { title: "Sistema" };

export default async function SistemaPage() {
  await exigirPermissao("sistema:administrar");
  const [demo, registros] = await Promise.all([
    estadoDemonstracao(),
    db
      .select({ a: auditoria, usuario: user.name })
      .from(auditoria)
      .leftJoin(user, eq(user.id, auditoria.usuarioId))
      .orderBy(desc(auditoria.ocorridoEm))
      .limit(50),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Sistema" descricao="Dados de demonstração e trilha de auditoria." />

      <Card className="flex max-w-3xl flex-col gap-3">
        <CardTitulo>Dados de demonstração</CardTitulo>
        <CardDescricao>
          Cria uma fábrica fictícia de quadros elétricos: 5 centros, 9 recursos, 4 produtos com roteiro, 12 OPs (3 já em execução), paradas no histórico e uma
          programação aprovada. Enquanto existirem, o sistema mostra o selo “Demonstração”. Não use junto com dados reais.
        </CardDescricao>
        {demo && <p className="text-sm">Carregados em {formatarData(new Date(demo.carregadoEm))}.</p>}
        <AcoesDemonstracao carregada={!!demo} />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Auditoria (últimos 50 registros)</h2>
        {registros.length === 0 ? (
          <Vazio titulo="Nenhum registro ainda" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Quando</Th>
                <Th>Quem</Th>
                <Th>Área</Th>
                <Th>O que aconteceu</Th>
              </tr>
            </thead>
            <tbody>
              {registros.map(({ a, usuario }) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{formatarData(a.ocorridoEm)}</Td>
                  <Td>{usuario ?? "—"}</Td>
                  <Td className="font-mono text-xs">{a.entidade}</Td>
                  <Td>{a.resumo}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}

import { asc, desc, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { Card, CardTitulo } from "@/components/ui/card";
import { Alerta, Badge, CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { FormCadastro } from "@/components/ui/form-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { feriados, indisponibilidades, recursos } from "@/db/schema";
import { DIA, formatarCurto } from "@/domain/tempo";
import { rotuloTipoIndisponibilidade } from "@/lib/rotulos";
import { exigirPermissao } from "@/lib/session";
import { formatarDiaIso } from "@/lib/utils";
import { FUSO } from "@/server/aps/entrada";
import { removerFeriado, removerIndisponibilidade, salvarFeriado, salvarIndisponibilidade } from "../actions";
import { BotaoRemover } from "./botao-remover";

export const metadata: Metadata = { title: "Feriados e indisponibilidades" };

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { salvo } = await searchParams;
  const [listaFeriados, paradas, listaRecursos] = await Promise.all([
    db.select().from(feriados).orderBy(asc(feriados.data)),
    db
      .select({ i: indisponibilidades, recurso: recursos.nome, codigo: recursos.codigo })
      .from(indisponibilidades)
      .innerJoin(recursos, eq(recursos.id, indisponibilidades.recursoId))
      .where(gte(indisponibilidades.fim, new Date(Date.now() - 30 * DIA)))
      .orderBy(desc(indisponibilidades.inicio)),
    db.select().from(recursos).where(eq(recursos.ativo, true)).orderBy(asc(recursos.codigo)),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/cadastros" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <Icone nome="voltar" tamanho={16} /> Cadastros
      </Link>
      <CabecalhoPagina
        titulo="Feriados e indisponibilidades"
        descricao="Feriados valem para toda a fábrica. Indisponibilidades bloqueiam um recurso (manutenção, treinamento, férias)."
      />
      {salvo && <Alerta tom="sucesso">Alterações salvas. Gere uma nova programação para que elas entrem no Gantt.</Alerta>}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-bold">Indisponibilidades de recursos</h2>
          {paradas.length === 0 ? (
            <Vazio titulo="Nenhuma indisponibilidade" descricao="Mostramos as dos últimos 30 dias em diante." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Recurso</Th>
                  <Th>Período</Th>
                  <Th>Tipo</Th>
                  <Th>Motivo</Th>
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {paradas.map(({ i, recurso, codigo }) => (
                  <tr key={i.id}>
                    <Td>
                      <span className="font-mono font-semibold">{codigo}</span> {recurso}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {formatarCurto(i.inicio.getTime(), FUSO)} → {formatarCurto(i.fim.getTime(), FUSO)}
                    </Td>
                    <Td>
                      <Badge tom={i.tipo === "planejada" ? "neutro" : "alerta"}>{rotuloTipoIndisponibilidade[i.tipo]}</Badge>
                    </Td>
                    <Td>{i.motivo}</Td>
                    <Td className="text-right">
                      <BotaoRemover
                        acao={removerIndisponibilidade.bind(null, i.id)}
                        pergunta={`Remover a indisponibilidade de ${codigo} (${i.motivo})?`}
                        rotulo={`Remover indisponibilidade de ${codigo}`}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Card className="flex flex-col gap-4 self-start">
          <CardTitulo>Nova indisponibilidade</CardTitulo>
          <FormCadastro
            acao={salvarIndisponibilidade}
            rotuloBotao="Incluir"
            campos={[
              {
                nome: "recursoId",
                rotulo: "Recurso",
                tipo: "select",
                obrigatorio: true,
                opcoes: listaRecursos.map((r) => ({ valor: r.id, rotulo: `${r.codigo} · ${r.nome}` })),
              },
              { nome: "inicio", rotulo: "Início", tipo: "datahora", obrigatorio: true, largura: "metade" },
              { nome: "fim", rotulo: "Fim", tipo: "datahora", obrigatorio: true, largura: "metade" },
              {
                nome: "tipo",
                rotulo: "Tipo",
                tipo: "select",
                obrigatorio: true,
                valor: "planejada",
                opcoes: Object.entries(rotuloTipoIndisponibilidade).map(([valor, rotulo]) => ({ valor, rotulo })),
              },
              { nome: "motivo", rotulo: "Motivo", obrigatorio: true },
            ]}
          />
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-bold">Feriados</h2>
          {listaFeriados.length === 0 ? (
            <Vazio titulo="Nenhum feriado cadastrado" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {listaFeriados.map((f) => (
                  <tr key={f.data}>
                    <Td className="font-mono">{formatarDiaIso(f.data)}</Td>
                    <Td>{f.descricao}</Td>
                    <Td className="text-right">
                      <BotaoRemover acao={removerFeriado.bind(null, f.data)} pergunta={`Remover o feriado de ${formatarDiaIso(f.data)}?`} rotulo={`Remover feriado ${f.descricao}`} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Card className="flex flex-col gap-4 self-start">
          <CardTitulo>Novo feriado</CardTitulo>
          <FormCadastro
            acao={salvarFeriado}
            rotuloBotao="Incluir"
            campos={[
              { nome: "data", rotulo: "Data", tipo: "data", obrigatorio: true, largura: "metade" },
              { nome: "descricao", rotulo: "Descrição", obrigatorio: true },
            ]}
          />
        </Card>
      </section>
    </div>
  );
}

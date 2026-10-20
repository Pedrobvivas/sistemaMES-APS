import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/layout/icone";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescricao } from "@/components/ui/card";
import { Alerta, Badge, CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { LinhaLink } from "@/components/ui/linha-link";
import { Table, Td, Th } from "@/components/ui/table";
import { formatarCurto, formatarDuracao } from "@/domain/tempo";
import { pode } from "@/lib/papeis";
import { exigirPermissao } from "@/lib/session";
import { cn, formatarData, formatarDiaIso } from "@/lib/utils";
import { FUSO } from "@/server/aps/entrada";
import { DIAS_PARETO, carregarPainel } from "@/server/painel";
import { Atualizador } from "@/components/layout/atualizador";

export const metadata: Metadata = { title: "Painel" };

const motivoAtencao = {
  atrasada: { texto: "Atraso previsto", tom: "erro" as const },
  incompleta: { texto: "Com conflito na programação", tom: "erro" as const },
  sem_programacao: { texto: "Fora da programação aprovada", tom: "alerta" as const },
  vence_logo: { texto: "Entrega em até 2 dias", tom: "alerta" as const },
};

export default async function PainelPage() {
  const { user } = await exigirPermissao("painel:ver");
  const p = await carregarPainel();
  const c = p.contagem;
  const produzindo = p.recursos.filter((r) => r.estado === "produzindo").length;
  const parados = p.recursos.filter((r) => r.estado === "parado");

  return (
    <div className="flex flex-col gap-8">
      <Atualizador segundos={60} />
      <CabecalhoPagina
        titulo={`Olá, ${user.name.split(" ")[0]}`}
        descricao={`Situação da fábrica em ${formatarData(new Date(p.agora))}. Atualiza a cada minuto.`}
        acoes={
          pode(user.role, "programacao:editar") ? (
            <Link href="/programacao" className={buttonClasses({ variante: "secundaria" })}>
              <Icone nome="programacao" tamanho={18} /> Abrir Gantt
            </Link>
          ) : undefined
        }
      />

      {!p.aprovada && (
        <Alerta tom="alerta">
          Não há programação aprovada: atrasos previstos e planejado × realizado ficam indisponíveis.{" "}
          <Link href="/programacao" className="font-semibold underline">
            Gerar e aprovar uma programação
          </Link>
        </Alerta>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="OPs liberadas" valor={c.liberada ?? 0} ajuda="Aguardando início" />
        <Indicador rotulo="OPs em execução" valor={c.em_execucao ?? 0} ajuda="Com ao menos uma operação iniciada" />
        <Indicador
          rotulo="OPs com atraso previsto"
          valor={p.aprovada ? p.atencao.filter((a) => a.motivo === "atrasada").length : "—"}
          ajuda={p.aprovada ? `Programação aprovada nº ${p.aprovada.numero}` : "Requer programação aprovada"}
          alerta={p.atencao.some((a) => a.motivo === "atrasada")}
        />
        <Indicador rotulo="Recursos produzindo agora" valor={`${produzindo}/${p.recursos.length}`} ajuda={`${parados.length} parado(s) com motivo informado`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex flex-col gap-3" aria-labelledby="atencao">
          <h2 id="atencao" className="text-lg font-bold">
            OPs que pedem atenção
          </h2>
          {p.atencao.length === 0 ? (
            <Vazio titulo="Nada em atenção" descricao="Todas as OPs liberadas estão programadas e no prazo." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>OP</Th>
                  <Th>Entrega</Th>
                  <Th>Término previsto</Th>
                  <Th>Situação</Th>
                </tr>
              </thead>
              <tbody>
                {p.atencao.slice(0, 10).map((a) => (
                  <LinhaLink key={a.id} href={`/ordens/${a.id}`}>
                    <Td>
                      <Link href={`/ordens/${a.id}`} className="inline-flex min-h-11 items-center font-mono font-semibold text-destaque hover:underline">
                        {a.codigo}
                      </Link>
                    </Td>
                    <Td className="font-mono">{formatarDiaIso(a.prazo)}</Td>
                    <Td className="font-mono text-xs">{a.fimPrevisto ? formatarCurto(a.fimPrevisto, FUSO) : "—"}</Td>
                    <Td>
                      <Badge tom={motivoAtencao[a.motivo].tom}>
                        {motivoAtencao[a.motivo].texto}
                        {a.atrasoMin > 0 ? ` · ${formatarDuracao(a.atrasoMin)}` : ""}
                      </Badge>
                    </Td>
                  </LinhaLink>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="hoje">
          <h2 id="hoje" className="text-lg font-bold">
            Hoje: planejado × realizado
          </h2>
          <Card className="flex flex-col gap-4">
            {p.aprovada ? (
              <>
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <CardDescricao>Operações previstas para terminar hoje</CardDescricao>
                    <p className="font-mono text-3xl font-bold">
                      {p.hoje.planejadasConcluidas}
                      <span className="text-lg text-muted">/{p.hoje.planejadas}</span>
                    </p>
                    <p className="text-xs text-muted">concluídas / previstas</p>
                  </div>
                  <div>
                    <CardDescricao>Operações concluídas hoje (todas)</CardDescricao>
                    <p className="font-mono text-3xl font-bold">{p.hoje.concluidas}</p>
                  </div>
                </div>
                {p.hoje.planejadas > 0 && (
                  <div
                    className="h-3 w-full overflow-hidden rounded-full bg-surface"
                    role="progressbar"
                    aria-label="Cumprimento do planejado de hoje"
                    aria-valuemin={0}
                    aria-valuemax={p.hoje.planejadas}
                    aria-valuenow={p.hoje.planejadasConcluidas}
                  >
                    <div className="h-full bg-sucesso" style={{ width: `${(p.hoje.planejadasConcluidas / p.hoje.planejadas) * 100}%` }} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Indisponível: sem programação aprovada para comparar.</p>
            )}
            <div className="flex flex-wrap gap-6 border-t border-borda pt-3 text-sm">
              <p>
                Peças boas apontadas hoje: <strong className="font-mono">{p.hoje.quantidadeBoa}</strong>
              </p>
              <p>
                Rejeitadas: <strong className="font-mono">{p.hoje.quantidadeRejeitada}</strong>
              </p>
            </div>
          </Card>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex flex-col gap-3" aria-labelledby="pareto">
          <h2 id="pareto" className="text-lg font-bold">
            Paradas dos últimos {DIAS_PARETO} dias
          </h2>
          <p className="text-xs text-muted">
            Tempo entre “Pausar” e “Retomar/Finalizar” apontado no terminal, por motivo. Total: {formatarDuracao(p.totalParadasMin)}.
          </p>
          {p.pareto.length === 0 ? (
            <Vazio titulo="Nenhuma parada apontada" />
          ) : (
            <ul className="flex flex-col gap-3">
              {p.pareto.map((x) => (
                <li key={x.motivo} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold">
                      {x.motivo} <span className="text-xs font-normal text-muted">{x.categoria === "planejada" ? "planejada" : "não planejada"}</span>
                    </span>
                    <span className="font-mono">
                      {formatarDuracao(x.minutos)} · {Math.round(x.percentual * 100)}%
                      <span className="text-xs text-muted"> (acum. {Math.round(x.acumulado * 100)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <div className={cn("h-full", x.categoria === "planejada" ? "bg-muted" : "bg-alerta")} style={{ width: `${x.percentual * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="oee">
          <h2 id="oee" className="text-lg font-bold">
            OEE
          </h2>
          <Card className="flex flex-col gap-2">
            <Badge tom="neutro" className="w-fit">
              Indisponível neste protótipo
            </Badge>
            <p className="text-sm">
              OEE = Disponibilidade × Desempenho × Qualidade. Para calcular sem inventar números faltam critérios a definir com o cliente: ciclo ideal por operação,
              quais paradas descontam da disponibilidade e como contar o tempo planejado por turno.
            </p>
            <p className="text-xs text-muted">Os dados já registrados (turnos, paradas e quantidades boas/rejeitadas) servem de base para essa etapa.</p>
          </Card>
          <h3 className="mt-2 font-display font-bold">Recursos agora</h3>
          <ul className="flex flex-col divide-y divide-borda rounded-md border border-borda text-sm">
            {p.recursos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  <span className="font-mono text-xs text-muted">{r.codigo}</span> {r.nome}
                </span>
                <span className={cn("flex items-center gap-1 font-semibold", r.estado === "produzindo" ? "text-sucesso" : r.estado === "parado" ? "text-alerta" : "text-muted")}>
                  <Icone nome={r.estado === "produzindo" ? "iniciar" : r.estado === "parado" ? "pausar" : "relogio"} tamanho={14} />
                  {r.estado === "produzindo" ? r.atual : r.estado === "parado" ? `Parado: ${r.motivoParada ?? "sem motivo"}` : "Livre"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, ajuda, alerta }: { rotulo: string; valor: number | string; ajuda: string; alerta?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <CardDescricao>{rotulo}</CardDescricao>
      <p className={cn("font-display text-3xl font-bold", alerta && "text-erro")}>{valor}</p>
      <p className="text-xs text-muted">{ajuda}</p>
    </Card>
  );
}

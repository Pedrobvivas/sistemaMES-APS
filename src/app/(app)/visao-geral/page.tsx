import type { Metadata } from "next";
import Link from "next/link";
import { Atualizador } from "@/components/layout/atualizador";
import { Icone } from "@/components/layout/icone";
import { Badge, Vazio } from "@/components/ui/feedback";
import { LinhaLink } from "@/components/ui/linha-link";
import type { Variacao } from "@/domain/indicadores/visao-geral";
import { formatarCurto, formatarDuracao } from "@/domain/tempo";
import { pode, type Permissao } from "@/lib/papeis";
import { exigirPermissao } from "@/lib/session";
import { cn, formatarData, formatarDiaIso } from "@/lib/utils";
import { FUSO } from "@/server/aps/entrada";
import { DIAS_CARGA, DIAS_PERIODO, carregarVisaoGeral, type Indicador } from "@/server/visao-geral";
import { GraficoProducao } from "./grafico-producao";

export const metadata: Metadata = { title: "Visão geral" };

const acoes: { href: string; rotulo: string; texto: string; icone: string; permissao: Permissao }[] = [
  { href: "/ordens/nova", rotulo: "Nova OP", texto: "Criar ordem de produção", icone: "mais", permissao: "ordens:editar" },
  { href: "/programacao", rotulo: "Programação", texto: "Gantt e reprogramação", icone: "programacao", permissao: "programacao:editar" },
  { href: "/terminal", rotulo: "Terminal de produção", texto: "Apontar no chão de fábrica", icone: "terminal", permissao: "execucao:apontar" },
  { href: "/painel", rotulo: "Painel do dia", texto: "Atenção, paradas e recursos", icone: "painel", permissao: "painel:ver" },
];

const motivoRisco = {
  atraso: { texto: "Atraso previsto", tom: "erro" as const },
  conflito: { texto: "Conflito na programação", tom: "erro" as const },
  fora: { texto: "Fora da programação", tom: "alerta" as const },
};

export default async function VisaoGeralPage() {
  const { user } = await exigirPermissao("painel:ver");
  const d = await carregarVisaoGeral();
  const [destaque, ...demais] = d.indicadores;

  return (
    <div className="flex flex-col gap-6">
      <Atualizador segundos={60} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">Olá, {user.name.split(" ")[0]}</p>
          <h1 className="text-3xl font-bold">
            Visão geral <span className="texto-degrade">da fábrica</span>
          </h1>
        </div>
        <p className="text-xs text-muted">
          Atualizado em {formatarData(new Date(d.agora))} · indicadores de {DIAS_PERIODO} dias comparados aos {DIAS_PERIODO} anteriores
        </p>
      </div>

      {/* Ações rápidas */}
      <nav aria-label="Ações rápidas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {acoes
          .filter((a) => pode(user.role, a.permissao))
          .map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex min-h-16 items-center gap-3 rounded-md border border-borda bg-surface-2 px-3 py-3 sm:px-4 transition-colors hover:border-violeta-claro"
            >
              <span className="degrade-marca flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primaria-texto sm:h-10 sm:w-10">
                <Icone nome={a.icone} tamanho={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight sm:text-base">{a.rotulo}</span>
                <span className="hidden truncate text-xs text-muted sm:block">{a.texto}</span>
              </span>
            </Link>
          ))}
      </nav>

      {/* Indicadores */}
      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoIndicador indicador={destaque} destaque />
        {demais.map((i) => (
          <CartaoIndicador key={i.chave} indicador={i} />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Produção diária */}
        <section aria-labelledby="titulo-producao" className="flex flex-col gap-4 rounded-md border border-borda bg-surface-2 p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="titulo-producao" className="text-base font-bold">
                Produção diária — últimos {DIAS_PERIODO} dias
              </h2>
              <p className="text-xs text-muted">Produtos acabados (última operação de cada OP), em peças</p>
            </div>
            <ul className="flex items-center gap-4 text-xs text-muted" aria-label="Legenda">
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-serie-1" aria-hidden="true" /> Boas
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-serie-2" aria-hidden="true" /> Rejeitadas
              </li>
            </ul>
          </div>
          <GraficoProducao dias={d.producaoDiaria} />
        </section>

        {/* Ocupação por centro */}
        <section aria-labelledby="titulo-ocupacao" className="flex flex-col gap-4 rounded-md border border-borda bg-surface-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-ocupacao" className="text-base font-bold">
                Ocupação por centro
              </h2>
              <p className="text-xs text-muted">Programado ÷ tempo de turno, próximos {DIAS_CARGA} dias</p>
            </div>
            <span className="whitespace-nowrap text-xs text-muted">{d.aprovada ? `Programação nº ${d.aprovada.numero}` : ""}</span>
          </div>
          {!d.aprovada ? (
            <p className="text-sm text-muted">Indisponível: aprove uma programação no Gantt.</p>
          ) : d.ocupacaoCentros.length === 0 ? (
            <p className="text-sm text-muted">Nenhum centro com recursos ativos.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {d.ocupacaoCentros.map((c) => (
                <li key={c.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{c.nome}</span>
                    <span className="font-semibold tabular-nums">{c.taxa === null ? "—" : `${Math.round(c.taxa * 100)}%`}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
                    <div className="degrade-marca h-full rounded-full" style={{ width: `${Math.min(100, (c.taxa ?? 0) * 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-muted">
                    {formatarDuracao(c.ocupadoMin)} de {formatarDuracao(c.disponivelMin)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* OPs em risco */}
        <section aria-labelledby="titulo-risco" className="flex flex-col gap-3 rounded-md border border-borda bg-surface-2 p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="titulo-risco" className="text-base font-bold">
                OPs em risco
              </h2>
              <p className="text-xs text-muted">Pela programação aprovada · {d.totalEmRisco} no total</p>
            </div>
            <Link href="/painel" className="inline-flex min-h-11 items-center rounded-full border border-borda px-4 text-sm font-semibold hover:border-violeta-claro">
              Ver todas
            </Link>
          </div>
          {d.emRisco.length === 0 ? (
            <Vazio titulo="Nenhuma OP em risco" descricao="Todas as OPs em carteira estão programadas e no prazo." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-2 pr-3 font-semibold">OP</th>
                    <th className="py-2 pr-3 font-semibold">Cliente</th>
                    <th className="py-2 pr-3 font-semibold">Entrega</th>
                    <th className="py-2 pr-3 font-semibold">Término previsto</th>
                    <th className="py-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {d.emRisco.map((o) => (
                    <LinhaLink key={o.id} href={`/ordens/${o.id}`} className="border-t border-borda">
                      <td className="py-2 pr-3">
                        <Link href={`/ordens/${o.id}`} className="inline-flex min-h-11 items-center font-mono font-semibold text-destaque hover:underline">
                          {o.codigo}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{o.cliente ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono">{formatarDiaIso(o.prazo)}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{o.fimPrevisto ? formatarCurto(o.fimPrevisto, FUSO) : "—"}</td>
                      <td className="py-2">
                        <Badge tom={motivoRisco[o.motivo].tom}>
                          {motivoRisco[o.motivo].texto}
                          {o.atrasoMin > 0 ? ` · ${formatarDuracao(o.atrasoMin)}` : ""}
                        </Badge>
                      </td>
                    </LinhaLink>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Paradas por motivo */}
        <section aria-labelledby="titulo-paradas" className="flex flex-col gap-4 rounded-md border border-borda bg-surface-2 p-5">
          <div>
            <h2 id="titulo-paradas" className="text-base font-bold">
              Principais paradas
            </h2>
            <p className="text-xs text-muted">
              Últimos {DIAS_PERIODO} dias · total {formatarDuracao(d.totalParadasMin)}
            </p>
          </div>
          {d.paradas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma parada apontada no período.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {d.paradas.map((p) => (
                <li key={p.motivo} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{p.motivo}</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatarDuracao(p.minutos)} <span className="text-xs text-muted">· {Math.round(p.percentual * 100)}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
                    <div className="h-full rounded-full bg-rosa" style={{ width: `${p.percentual * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function textoVariacao(v: Variacao) {
  if (!v) return null;
  const arredondado = Math.round(v.valor * 10) / 10;
  if (Math.abs(arredondado) < 0.5) return { texto: "estável", sinal: 0 };
  const n = Math.abs(arredondado).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return { texto: `${arredondado > 0 ? "+" : "−"}${n}${v.tipo === "percentual" ? "%" : " p.p."}`, sinal: Math.sign(arredondado) };
}

function CartaoIndicador({ indicador: i, destaque = false }: { indicador: Indicador; destaque?: boolean }) {
  const v = textoVariacao(i.variacao);
  const bom = v && v.sinal !== 0 ? (v.sinal > 0) === i.melhorQuandoSobe : null;
  return (
    <article
      className={cn(
        "relative flex min-h-36 flex-col gap-2 overflow-hidden rounded-md p-5",
        destaque ? "degrade-marca text-primaria-texto shadow-lg" : "borda-degrade",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className={cn("min-w-0 text-sm font-semibold", destaque ? "text-primaria-texto/90" : "text-muted")}>
          <span className="block truncate">{i.rotulo}</span>
          <span className={cn("block text-[11px] font-normal", destaque ? "text-primaria-texto/75" : "text-muted/80")}>{i.periodo}</span>
        </h2>
        <button
          type="button"
          title={i.definicao}
          aria-label={`Como é calculado: ${i.definicao}`}
          className={cn("-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", destaque ? "text-primaria-texto/80 hover:bg-primaria-texto/10" : "text-muted hover:text-ink")}
        >
          <Icone nome="info" tamanho={16} />
        </button>
      </div>
      <p className="font-display text-3xl font-bold tracking-tight tabular-nums">{i.valor}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
        {v && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-semibold tabular-nums",
              destaque
                ? "bg-primaria-texto/20 text-primaria-texto"
                : bom === null
                  ? "bg-surface text-muted"
                  : bom
                    ? "bg-sucesso/15 text-sucesso"
                    : "bg-erro/15 text-erro",
            )}
          >
            {v.texto}
            <span className="sr-only">{bom === null ? "" : bom ? " (melhor)" : " (pior)"} em relação ao período anterior</span>
          </span>
        )}
        <span className={destaque ? "text-primaria-texto/85" : "text-muted"}>{i.detalhe}</span>
      </div>
      {destaque && (
        <span aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-8 opacity-20">
          <Icone nome={i.icone} tamanho={120} />
        </span>
      )}
    </article>
  );
}

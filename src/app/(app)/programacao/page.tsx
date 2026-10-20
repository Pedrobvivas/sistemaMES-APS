import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina, Vazio } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { pode } from "@/lib/papeis";
import { exigirPermissao } from "@/lib/session";
import { formatarData } from "@/lib/utils";
import { carregarGantt, escolherVersao, listarVersoes } from "@/server/aps/gantt";
import { BotaoGerar } from "./botao-gerar";
import { Gantt } from "./gantt";
import { CabecalhoVersao } from "./versao";

export const metadata: Metadata = { title: "Programação" };

const rotuloStatus: Record<string, string> = { sugerida: "Sugerida", aprovada: "Aprovada", substituida: "Substituída", descartada: "Descartada" };
const rotuloOrigem: Record<string, string> = { completa: "Completa", arraste: "Arraste", desafixar: "Desafixar" };

export default async function ProgramacaoPage({ searchParams }: { searchParams: Promise<{ versao?: string }> }) {
  const { user } = await exigirPermissao("programacao:editar");
  const { versao } = await searchParams;
  const id = await escolherVersao(versao);
  const [dados, versoes] = await Promise.all([id ? carregarGantt(id) : Promise.resolve(null), listarVersoes()]);
  const podeEditar = pode(user.role, "programacao:editar");
  const podeAprovar = pode(user.role, "programacao:aprovar");

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Programação da produção"
        descricao="Sequenciamento por regras explícitas (fila por prioridade e entrega, capacidade finita, turnos e dependências). Não é uma otimização matemática."
      />

      {!dados ? (
        <Vazio
          titulo="Nenhuma programação gerada"
          descricao="Libere OPs e gere a primeira programação. Ela é criada como sugerida e só vale depois de aprovada."
          acao={podeEditar ? <BotaoGerar /> : undefined}
        />
      ) : (
        <>
          <CabecalhoVersao dados={dados} podeEditar={podeEditar} podeAprovar={podeAprovar} />
          {dados.centros.length === 0 ? (
            <Vazio titulo="Nenhum recurso ativo" descricao="Cadastre centros de trabalho e recursos com turno." />
          ) : (
            <Gantt dados={dados} podeEditar={podeEditar} />
          )}
        </>
      )}

      {versoes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Histórico de versões</h2>
          <Table>
            <thead>
              <tr>
                <Th>Nº</Th>
                <Th>Situação</Th>
                <Th>Origem</Th>
                <Th>Descrição</Th>
                <Th className="text-right">OPs atrasadas</Th>
                <Th>Gerada</Th>
              </tr>
            </thead>
            <tbody>
              {versoes.map((v) => (
                <tr key={v.id} className={v.id === dados?.programacao.id ? "bg-surface-2" : undefined}>
                  <Td>
                    <Link href={`/programacao?versao=${v.id}`} className="inline-flex min-h-11 items-center font-mono font-semibold text-destaque hover:underline">
                      {v.numero}
                    </Link>
                  </Td>
                  <Td>{rotuloStatus[v.status]}</Td>
                  <Td className="text-muted">{rotuloOrigem[v.origem]}</Td>
                  <Td>{v.descricao}</Td>
                  <Td className="text-right font-mono">{v.metricas.ordensAtrasadas}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    {formatarData(v.geradoEm)}
                    {v.geradoPor ? ` · ${v.geradoPor}` : ""}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
    </div>
  );
}

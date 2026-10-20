import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { Badge, Vazio } from "@/components/ui/feedback";
import { LinkEditar, PaginaCadastro } from "@/components/ui/pagina-cadastro";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { turnoPeriodos, turnos } from "@/db/schema";
import { minutosParaHora } from "@/lib/formularios";
import { diasDaSemana } from "@/lib/rotulos";
import { exigirPermissao } from "@/lib/session";
import { salvarTurno } from "../actions";
import { FormTurno } from "./form";

export const metadata: Metadata = { title: "Turnos" };

function resumir(periodos: { diaSemana: number; inicioMin: number; fimMin: number }[]) {
  const dias = [...new Set(periodos.map((p) => p.diaSemana))].sort();
  const assinatura = (d: number) =>
    periodos
      .filter((p) => p.diaSemana === d)
      .sort((a, b) => a.inicioMin - b.inicioMin)
      .map((p) => `${minutosParaHora(p.inicioMin)}–${minutosParaHora(p.fimMin)}`)
      .join(", ");
  const primeira = dias.length ? assinatura(dias[0]) : "";
  const variaPorDia = dias.some((d) => assinatura(d) !== primeira);
  const horasDia = periodos.filter((p) => p.diaSemana === dias[0]).reduce((s, p) => s + (p.fimMin - p.inicioMin), 0) / 60;
  return { dias, horarios: primeira, variaPorDia, horasDia };
}

export default async function TurnosPage({ searchParams }: { searchParams: Promise<{ editar?: string; salvo?: string }> }) {
  await exigirPermissao("cadastros:editar");
  const { editar, salvo } = await searchParams;
  const [lista, periodos] = await Promise.all([db.select().from(turnos).orderBy(asc(turnos.nome)), db.select().from(turnoPeriodos)]);
  const atual = lista.find((t) => t.id === editar);
  const resumoAtual = atual ? resumir(periodos.filter((p) => p.turnoId === atual.id)) : null;
  const periodosAtual = atual
    ? periodos
        .filter((p) => p.turnoId === atual.id && p.diaSemana === resumoAtual!.dias[0])
        .sort((a, b) => a.inicioMin - b.inicioMin)
        .map((p) => ({ inicio: minutosParaHora(p.inicioMin), fim: minutosParaHora(p.fimMin) }))
    : [];

  return (
    <PaginaCadastro
      titulo="Turnos"
      descricao="Horários em que os recursos trabalham. O sequenciador só programa dentro deles."
      salvo={!!salvo}
      tituloForm={atual ? `Editar ${atual.nome}` : "Novo turno"}
      form={
        <FormTurno
          key={atual?.id ?? "novo"}
          acao={salvarTurno.bind(null, atual?.id ?? null)}
          turno={
            atual && resumoAtual
              ? { nome: atual.nome, ativo: atual.ativo, dias: resumoAtual.dias, periodos: periodosAtual, variaPorDia: resumoAtual.variaPorDia }
              : undefined
          }
        />
      }
    >
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum turno cadastrado" descricao="Exemplo: Comercial, de segunda a sexta, 07:00–12:00 e 13:00–17:00." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Dias</Th>
              <Th>Horários</Th>
              <Th>Horas/dia</Th>
              <Th>Situação</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => {
              const r = resumir(periodos.filter((p) => p.turnoId === t.id));
              return (
                <tr key={t.id}>
                  <Td className="font-medium">{t.nome}</Td>
                  <Td>{r.dias.map((d) => diasDaSemana[d]).join(", ") || "—"}</Td>
                  <Td className="font-mono text-xs">
                    {r.horarios || "—"}
                    {r.variaPorDia && <span className="ml-2 font-sans text-alerta">(varia por dia)</span>}
                  </Td>
                  <Td className="font-mono">{r.horasDia ? r.horasDia.toLocaleString("pt-BR") : "—"}</Td>
                  <Td>
                    <Badge tom={t.ativo ? "sucesso" : "neutro"}>{t.ativo ? "Ativo" : "Inativo"}</Badge>
                  </Td>
                  <Td className="text-right">
                    <LinkEditar href={`/cadastros/turnos?editar=${t.id}`} rotulo={`Editar ${t.nome}`} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </PaginaCadastro>
  );
}

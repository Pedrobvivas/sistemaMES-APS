import { Icone } from "@/components/layout/icone";
import { Badge } from "@/components/ui/feedback";
import { rotuloStatusOrdem, type StatusOrdem } from "@/domain/ordens/status";

// Status sempre com texto e ícone; a cor só reforça.
const tomOrdem: Record<StatusOrdem, "neutro" | "destaque" | "sucesso" | "erro" | "alerta"> = {
  rascunho: "neutro",
  liberada: "destaque",
  em_execucao: "sucesso",
  concluida: "neutro",
  cancelada: "erro",
};
const iconeOrdem: Record<StatusOrdem, string> = {
  rascunho: "ordens",
  liberada: "programacao",
  em_execucao: "iniciar",
  concluida: "concluir",
  cancelada: "fechar",
};

export function StatusOrdemBadge({ status }: { status: StatusOrdem }) {
  return (
    <Badge tom={tomOrdem[status]} className="gap-1">
      <Icone nome={iconeOrdem[status]} tamanho={12} />
      {rotuloStatusOrdem[status]}
    </Badge>
  );
}

export const rotuloStatusOperacao: Record<string, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function StatusOperacaoBadge({ status }: { status: string }) {
  const tom = status === "em_execucao" ? "sucesso" : status === "pausada" ? "alerta" : status === "cancelada" ? "erro" : "neutro";
  const icone = status === "em_execucao" ? "iniciar" : status === "pausada" ? "pausar" : status === "concluida" ? "concluir" : status === "cancelada" ? "fechar" : "relogio";
  return (
    <Badge tom={tom} className="gap-1">
      <Icone nome={icone} tamanho={12} />
      {rotuloStatusOperacao[status] ?? status}
    </Badge>
  );
}

export const rotuloPrioridade: Record<number, string> = { 1: "Alta", 2: "Normal", 3: "Baixa" };

export function PrioridadeBadge({ prioridade }: { prioridade: number }) {
  return (
    <Badge tom={prioridade === 1 ? "alerta" : "neutro"} className="gap-1">
      {prioridade === 1 && <Icone nome="alerta" tamanho={12} />}
      {rotuloPrioridade[prioridade] ?? prioridade}
    </Badge>
  );
}

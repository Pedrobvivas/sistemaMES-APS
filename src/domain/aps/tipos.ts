import type { Intervalo } from "../calendario.ts";

export type StatusOperacao = "pendente" | "em_execucao" | "pausada" | "concluida" | "cancelada";

export type RecursoEntrada = {
  id: string;
  nome: string;
  disponibilidade: Intervalo[]; // já com turnos, feriados e indisponibilidades
};

export type OperacaoEntrada = {
  id: string;
  sequencia: number; // mesma sequência = podem correr em paralelo
  nome: string;
  setupMin: number;
  processamentoMin: number;
  recursosElegiveis: string[]; // em ordem de preferência
  status: StatusOperacao;
  recursoAtualId?: string | null; // onde está sendo executada (em execução/pausada)
  minutosRestantes?: number | null; // para operações já iniciadas
  fimReal?: number | null; // para concluídas
};

export type OrdemEntrada = {
  id: string;
  codigo: string;
  prioridade: number; // 1 = alta, 2 = normal, 3 = baixa
  prazoEntrega: number; // fim do dia de entrega
  inicioMaisCedo?: number | null;
  operacoes: OperacaoEntrada[];
};

// Data fixada pelo usuário (arraste no Gantt). Fica valendo até ser desfeita.
export type Fixacao = {
  operacaoId: string;
  inicio: number;
  recursoId?: string | null;
};

export type EntradaSequenciamento = {
  agora: number;
  horizonteFim: number;
  fuso: string;
  recursos: RecursoEntrada[];
  ordens: OrdemEntrada[];
  fixacoes: Fixacao[];
};

export type ItemProgramado = {
  operacaoId: string;
  ordemId: string;
  recursoId: string;
  inicio: number;
  fim: number;
  setupMin: number;
  segmentos: Intervalo[];
  fixada: boolean; // data definida pelo usuário
  emExecucao: boolean; // já iniciada no chão de fábrica
  justificativa: string;
};

export type TipoConflito =
  | "sem_recurso_elegivel"
  | "sem_turno"
  | "fora_horizonte"
  | "predecessora_nao_programada"
  | "fixacao_nao_cumprida"
  | "fixacao_ignorada";

export type Conflito = {
  tipo: TipoConflito;
  ordemId: string;
  operacaoId: string | null;
  mensagem: string;
};

export type ResumoOrdem = {
  ordemId: string;
  posicaoFila: number;
  inicioPrevisto: number | null;
  fimPrevisto: number | null; // null se alguma operação ficou sem programação
  atrasoMin: number; // 0 quando no prazo
  completa: boolean;
};

export type UtilizacaoRecurso = {
  recursoId: string;
  disponivelMin: number;
  ocupadoMin: number;
};

export type Metricas = {
  totalOrdens: number;
  ordensProgramadas: number;
  ordensAtrasadas: number;
  atrasoTotalMin: number;
  operacoesProgramadas: number;
  operacoesNaoProgramadas: number;
  operacoesComSetup: number;
  setupTotalMin: number;
  ociosidadeMin: number; // tempo de turno sem operação entre agora e o último término
  termino: number | null;
  utilizacao: UtilizacaoRecurso[];
};

export type ResultadoSequenciamento = {
  itens: ItemProgramado[];
  conflitos: Conflito[];
  ordens: ResumoOrdem[];
  metricas: Metricas;
  fixacoesAplicadas: Fixacao[]; // as que entraram na versão (inclusive não cumpridas)
};

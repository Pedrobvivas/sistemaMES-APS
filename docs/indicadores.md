# Indicadores — definições

Código: `src/server/visao-geral.ts` (consultas) e `src/domain/indicadores/visao-geral.ts` (cálculos, com testes em `tests/domain/visao-geral.test.ts`).

Período padrão da Visão geral: **últimos 30 dias**, comparados com os **30 dias anteriores**. A variação só aparece quando o período anterior tem base de cálculo; sem base, o card mostra "—". "Estável" = variação menor que 0,5.

| Indicador | Fórmula | Fonte |
| --- | --- | --- |
| Entregas no prazo | OPs concluídas no período cujo término da última operação ≤ fim do dia de entrega ÷ OPs concluídas no período. Variação em pontos percentuais. | `operacoes_ordem.fim_real`, `ordens_producao.prazo_entrega` |
| Produtos acabados | Soma das quantidades **boas** apontadas na **última operação** de cada OP (maior sequência). Etapas intermediárias não entram, para não contar a mesma peça várias vezes. | `apontamentos` |
| Qualidade | Boas ÷ (boas + rejeitadas), na última operação de cada OP. Variação em pontos percentuais. | `apontamentos` |
| OPs concluídas | OPs com status Concluída cuja última operação terminou no período. | `ordens_producao`, `operacoes_ordem` |
| OPs em carteira | OPs liberadas ou em execução agora; "com atraso previsto" vem da programação aprovada. | `ordens_producao`, `programacoes` |
| Carga programada (7 dias) | Horas de trabalho da programação aprovada (trechos dentro do turno) que caem entre agora e +7 dias. | `programacao_itens.segmentos` |
| Ocupação dos recursos (7 dias) | Carga programada ÷ horas de turno disponíveis (turnos − feriados − indisponibilidades) dos recursos ativos, no mesmo intervalo. Também por centro de trabalho. | programação aprovada, turnos, calendário |
| Tempo parado | Soma dos trechos "Pausar → Retomar/Finalizar" apontados no terminal, recortados no período; parada aberta conta até agora. Mesmo critério do Pareto do Painel do dia. | `eventos_execucao` |
| Produção diária | Produtos acabados por dia (fuso da fábrica), boas e rejeitadas. | `apontamentos` |

## OEE

Ainda não calculado. Falta definir com o cliente o ciclo ideal por operação, quais paradas descontam da disponibilidade e o tempo planejado por turno. Enquanto isso, o sistema não mostra um OEE estimado.

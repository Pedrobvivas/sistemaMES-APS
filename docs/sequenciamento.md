# Sequenciamento (APS) — regra do protótipo

Código: `src/domain/aps/sequenciador.ts` · Testes: `tests/domain/sequenciador.test.ts`

## Entrada

- **OPs** liberadas ou em execução, com operações copiadas do roteiro na liberação.
- **Recursos** ativos com disponibilidade = períodos do turno − feriados − indisponibilidades, no fuso da fábrica (`FUSO_FABRICA`, padrão `America/Sao_Paulo`).
- **Recursos elegíveis** de cada operação: membros ativos do grupo de recursos, na ordem de preferência.
- **Datas fixadas** pelo usuário no Gantt.
- **Horizonte:** 60 dias a partir de agora.

## Regra

1. **Já iniciadas** ficam no recurso onde estão, a partir de agora, com o tempo restante estimado (previsto − trabalhado, mínimo 15 min).
2. **Datas fixadas** reservam o recurso a partir da data (ou do próximo horário de turno). Se o recurso já estiver reservado, começam no primeiro horário livre e um conflito "fixação não cumprida" é registrado.
3. **Fila** das demais: prioridade (1 alta) → data de entrega → código da OP.
   - Cada OP é programada inteira antes da próxima.
   - Cada operação começa depois do fim de todas as operações do nível de sequência anterior (mesma sequência = em paralelo), do início mais cedo da OP e de agora.
   - Entre os recursos elegíveis, vence o que **termina mais cedo**; em empate, o preferencial.
   - A operação ocupa o primeiro trecho do recurso em que cabe **inteira** sem cruzar outra reservada; pode parar no fim do turno e continuar no próximo.
4. Se uma data fixada ficar antes do fim da operação anterior, a fixação vira "não começar antes de" e o motivo é informado.

A regra é determinística: a mesma entrada produz sempre a mesma programação.

## Saída

- Itens (operação, recurso, início, fim, trechos de trabalho, justificativa em texto).
- Conflitos: sem recurso elegível, sem turno, fora do horizonte, predecessora não programada, fixação não cumprida ou ignorada.
- Resumo por OP (término previsto, atraso) e métricas: OPs atrasadas, atraso total, operações sem programação, setups e tempo ocioso.

## O que não é

Não é otimização: não busca o menor atraso possível. Para comparar alternativas, gere versões e compare as métricas no antes × depois.

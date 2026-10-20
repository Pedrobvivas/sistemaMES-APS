# Camargo MES — protótipo de PCP · APS · MES

Protótipo funcional de gestão industrial da Camargo TI, inspirado nos conceitos públicos da Aloee, com identidade e código próprios. Construído sobre o projeto-base Camargo TI.

> **Situação:** protótipo para demonstração comercial. Os dados de demonstração são fictícios e o sistema mostra o selo "Demonstração" enquanto eles existirem.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript estrito · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Better Auth · Docker

## O que o protótipo faz

| Módulo | O que tem |
| --- | --- |
| Cadastros | Centros de trabalho, recursos (máquina, posto, pessoa), grupos de recursos (elegíveis/alternativos), turnos, feriados, indisponibilidades, produtos com roteiro, motivos de parada, operadores |
| Ordens de produção | Criar, editar, filtrar, liberar (copia o roteiro para a OP), cancelar; histórico de status; previsão de término e atraso |
| Programação (APS) | Sequenciador determinístico com capacidade finita; versões sugerida/aprovada/substituída; conflitos explicados; antes × depois; aprovação humana |
| **Gantt com arraste** | Arrastar a OP inteira ou só uma operação para outra data (e outro recurso elegível); o sistema reprograma todas as OPs e mostra a nova versão para aprovar |
| Terminal (MES) | Iniciar, pausar com motivo, retomar e finalizar com quantidades; eventos idempotentes; tema claro e botões grandes |
| Painel | OPs em atenção, planejado × realizado do dia, Pareto de paradas, situação dos recursos. OEE aparece como indisponível (critérios ainda não definidos) |
| Perfis | Administrador, planejador e operador, checados no servidor |

## Regras do arraste no Gantt

Combinadas com a Camargo TI em 19/10/2026:

1. A data solta vira a **data de início** da OP (ou da operação) e fica **fixada** até alguém clicar em "Desafixar".
2. A **prioridade não muda**. As demais OPs são reprogramadas pela fila normal e ocupam o espaço liberado.
3. Se outra OP não couber inteira antes da data fixada, ela vai para depois (a data fixada é garantida).
4. Mover **só uma operação** para antes do fim da anterior é recusado com explicação.
5. Trocar de recurso só vale para recurso **elegível** (do mesmo grupo).
6. O resultado é uma **versão sugerida**: só vale depois de aprovada. A anterior é mantida no histórico.
7. Não se move o que já começou no chão de fábrica, nem para antes de agora.

A regra completa do sequenciador está em `docs/sequenciamento.md`.

## Rodar na sua máquina

Pré-requisitos: Node.js 22.18 ou mais novo e Docker.

```bash
cp .env.example .env          # depois edite o BETTER_AUTH_SECRET
npm install
npm run db:up                 # sobe o Postgres local no Docker
npm run dev
```

Abra http://localhost:3000, crie o administrador e vá em **Sistema → Carregar demonstração**. Depois abra **Programação (Gantt)**.

## Testes

| Comando | O que testa |
| --- | --- |
| `npm test` | Domínio, sem banco: calendário e turnos, sequenciador (capacidade, prioridade, dependências, paralelismo, indisponibilidade, atraso, conflitos, determinismo), fixação por arraste, regras de arraste, antes × depois, máquina de estados do MES e da OP |
| `npm run test:e2e` | Navegador real contra o build de produção e o banco do `DATABASE_URL`: configuração, demonstração, arraste no Gantt, recusa por dependência, aprovação, terminal, painel e permissões do operador |

O GitHub Actions (`.github/workflows/ci.yml`) roda tudo a cada push: testes, migration, typecheck, build e e2e.

## Publicar na VPS (Docker Swarm + Portainer + Traefik)

A VPS da Camargo TI usa Swarm com Traefik e a rede `network_public` (ver Notion "Instalação VPS"). O README do projeto-base cita Coolify, que não é o que está instalado.

1. Crie um banco e um usuário dedicados no Postgres existente (não use o usuário `admin`).
2. Gere a imagem (`docker build -t sistema-mes-aps .`) e publique em um registro.
3. Crie a stack no Portainer com rótulos do Traefik para o domínio (ex.: `mes.camargoti.cloud`) e as variáveis `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_NAME` (no build), `SMTP_*`.
4. As migrations rodam sozinhas ao iniciar.
5. Configure backup diário do banco antes de qualquer dado real.

## Limitações conhecidas do protótipo

- Sequenciamento por regra (fila por prioridade e entrega); não é otimização matemática e não afirma ser ótima.
- Programação gerada na própria requisição (sem fila de jobs); suficiente para dezenas de OPs.
- Atualização "em tempo real" por recarga periódica (30–60 s), não por eventos do servidor.
- Setup fixo por operação (sem matriz de troca dependente da sequência); materiais fora do sequenciamento.
- Roteiro sem versionamento (a OP guarda a cópia feita na liberação).
- Operador identificado por seleção do nome no terminal, sem PIN.
- OEE não calculado até definir ciclo ideal e critérios de parada com o cliente.
- Sem importação de planilha nesta fase.

## Estrutura

```
src/
  domain/          regras puras e testáveis: tempo, calendário, sequenciador, arraste, MES, OP
  server/          serviços: montagem da entrada, versões de programação, MES, painel, demonstração
  db/schema/       tabelas (cadastros, ordens, aps, mes, sistema)
  app/(app)/       telas do escritório (painel, ordens, programação, cadastros, sistema)
  app/(terminal)/  terminal do chão de fábrica
  components/      layout e UI do design system Camargo TI
tests/domain/      testes do domínio (node --test)
tests/e2e/         testes de ponta a ponta (Playwright)
```

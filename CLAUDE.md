# Instruções para o Claude Code

Protótipo de PCP/APS/MES da Camargo TI, criado a partir do projeto-base. Requisitos de negócio: documentos do projeto "Sistema MES + APS" no claude.ai; regra do sequenciador em `docs/sequenciamento.md`.

## Stack
Next.js 15 (App Router, server components e server actions) · TypeScript estrito · Tailwind CSS 4 · PostgreSQL com Drizzle ORM · Better Auth (email/senha + plugin admin) · Docker.

## Idioma
- Interface, mensagens de erro e textos para o usuário em português do Brasil.
- Nomes de domínio em português (`clientes`, `salvarCliente`, `EstadoCliente`); nomes técnicos de bibliotecas como estão.

## Padrões obrigatórios
- **Permissão:** toda página e toda server action começa com `exigirPermissao("<permissão>")` (perfis em `src/lib/papeis.ts`; `requireAdmin()` para usuários). O middleware é só um filtro rápido, não é segurança.
- **Domínio:** regras industriais ficam em `src/domain` (TypeScript puro, imports com extensão `.ts`, sem banco nem Next) e têm teste em `tests/domain`. Serviços com banco ficam em `src/server`.
- **Datas:** instantes em `timestamptz` (`instante()` em `src/db/schema/comum.ts`); conversões de turno e fuso só por `src/domain/tempo.ts`.
- **Produção:** eventos de execução são imutáveis e idempotentes; nunca apague histórico produtivo.
- **Validação:** toda entrada é validada com `zod` dentro da server action, antes de tocar no banco.
- **Banco:** tabelas em `src/db/schema/<nome>.ts`, exportadas em `src/db/schema/index.ts`. Depois de mudar o schema, rode `npm run db:generate` e inclua a migration gerada. Nunca edite migrations já aplicadas.
- **Molde de cadastro:** siga `src/app/(app)/clientes` (page.tsx lista, form.tsx com `useActionState`, actions.ts com validar → permissão → gravar → `revalidatePath` → `redirect`).
- **Menu:** telas novas entram em `src/components/layout/menu.ts`.
- **Visual:** use os componentes de `src/components/ui` e os tokens do tema (`bg-surface`, `bg-surface-2`, `border-borda`, `text-ink`, `text-muted`, `text-destaque`, `bg-primaria`, `text-acento`, `border-acento`, `text-sucesso`, `text-erro`, `text-alerta`). Regra de cor 60-30-10: 60% `surface` (#0F0F0F), 30% `surface-2` (#202020) e texto `ink` (#F8F8F8), 10% `acento` verde (#5DD62C) só para ação e destaque. Não use cores do Tailwind padrão (`blue-500`, `gray-700`...) nem hex soltos. Títulos usam `font-display`. Gráficos usam `serie-1`/`serie-2` (validadas para daltonismo).
- **Ícones:** SVG de traço em `src/components/layout/icone.tsx`. Sem emoji.
- **Acessibilidade:** `<button>` e `<a>` reais, `<label>` ligado a cada campo (use `Campo`), `aria-label` em botões só com ícone, alvos de toque com 44px.
- **Segredos:** nunca escreva senhas, tokens ou dados reais de clientes no código ou em arquivos versionados. Só em `.env`.

## Comandos
- `npm run dev` · `npm run typecheck` · `npm run build` · `npm test` (domínio) · `npm run test:e2e` (navegador)
- `npm run db:up` (Postgres local) · `npm run db:generate` · `npm run db:studio`

## Antes de dar uma tarefa como pronta
1. `npm test` e `npm run typecheck` sem erros.
2. `npm run build` sem erros.
3. Se mudou o schema, a migration nova está em `drizzle/`.

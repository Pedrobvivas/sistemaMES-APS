# Instruções para o Claude Code

Este é o projeto-base da Camargo TI para sistemas sob medida. Cada sistema de cliente é uma cópia dele.

## Stack
Next.js 15 (App Router, server components e server actions) · TypeScript estrito · Tailwind CSS 4 · PostgreSQL com Drizzle ORM · Better Auth (email/senha + plugin admin) · Docker.

## Idioma
- Interface, mensagens de erro e textos para o usuário em português do Brasil.
- Nomes de domínio em português (`clientes`, `salvarCliente`, `EstadoCliente`); nomes técnicos de bibliotecas como estão.

## Padrões obrigatórios
- **Permissão:** toda página e toda server action começa com `requireSession()` ou `requireAdmin()` (`src/lib/session.ts`). O middleware é só um filtro rápido, não é segurança.
- **Validação:** toda entrada é validada com `zod` dentro da server action, antes de tocar no banco.
- **Banco:** tabelas em `src/db/schema/<nome>.ts`, exportadas em `src/db/schema/index.ts`. Depois de mudar o schema, rode `npm run db:generate` e inclua a migration gerada. Nunca edite migrations já aplicadas.
- **Molde de cadastro:** siga `src/app/(app)/clientes` (page.tsx lista, form.tsx com `useActionState`, actions.ts com validar → permissão → gravar → `revalidatePath` → `redirect`).
- **Menu:** telas novas entram em `src/components/layout/menu.ts`.
- **Visual:** use os componentes de `src/components/ui` e as cores do tema (`bg-surface`, `bg-surface-2`, `border-borda`, `text-ink`, `text-muted`, `text-destaque`, `bg-primaria`, `text-sucesso`, `text-erro`). Não use cores do Tailwind padrão (`blue-500`, `gray-700`...) nem hex soltos. Títulos usam `font-display`.
- **Ícones:** SVG de traço em `src/components/layout/icone.tsx`. Sem emoji.
- **Acessibilidade:** `<button>` e `<a>` reais, `<label>` ligado a cada campo (use `Campo`), `aria-label` em botões só com ícone, alvos de toque com 44px.
- **Segredos:** nunca escreva senhas, tokens ou dados reais de clientes no código ou em arquivos versionados. Só em `.env`.

## Comandos
- `npm run dev` · `npm run typecheck` · `npm run build`
- `npm run db:up` (Postgres local) · `npm run db:generate` · `npm run db:studio`

## Antes de dar uma tarefa como pronta
1. `npm run typecheck` sem erros.
2. `npm run build` sem erros.
3. Se mudou o schema, a migration nova está em `drizzle/`.

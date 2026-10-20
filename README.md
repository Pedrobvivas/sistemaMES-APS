# Projeto-base Camargo TI

Ponto de partida para os sistemas sob medida da Camargo TI. Já vem com login, usuários e permissões, layout com o design system da marca, um cadastro de exemplo e deploy em Docker. Cada cliente novo começa daqui.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Better Auth · Docker

## O que já vem pronto

- **Acesso:** login por e-mail e senha, recuperação de senha por e-mail, sessão de 7 dias.
- **Usuários e perfis:** administrador e usuário comum; tela de usuários (só admin) para criar, promover e remover.
- **Configuração inicial:** no primeiro acesso, com o banco vazio, o sistema pede para criar o administrador.
- **Layout:** menu lateral, cabeçalho com usuário, tema escuro/claro, páginas de erro e 404, tudo responsivo.
- **Design system:** cores, fontes (Montserrat, Inter, JetBrains Mono) e componentes da Camargo TI.
- **Cadastro de exemplo:** Clientes, com listar, buscar, criar, editar e excluir. É o molde para telas novas.
- **Deploy:** Dockerfile de produção e migrations aplicadas automaticamente ao iniciar.

## Rodar na sua máquina

Pré-requisitos: Node.js 20 ou mais novo e Docker.

```bash
cp .env.example .env          # depois edite o BETTER_AUTH_SECRET
npm install
npm run db:up                 # sobe o Postgres local no Docker
npm run db:generate           # só na primeira vez: cria a migration inicial
npm run dev
```

Abra http://localhost:3000. Na primeira vez, você cai na tela de configuração para criar o administrador.

Depois do primeiro `npm install` e `npm run db:generate`, faça commit do `package-lock.json` e da pasta `drizzle/`.

> Sem SMTP configurado, o e-mail de recuperação de senha aparece no terminal onde o `npm run dev` está rodando.

## Criar uma tela nova (ex.: Produtos)

1. **Tabela:** copie `src/db/schema/clientes.ts` para `produtos.ts`, ajuste os campos e exporte em `src/db/schema/index.ts`.
2. **Migration:** rode `npm run db:generate`. O arquivo gerado em `drizzle/` vai junto no commit; ele é aplicado ao iniciar o servidor.
3. **Telas:** copie a pasta `src/app/(app)/clientes` para `src/app/(app)/produtos` e troque os campos no `actions.ts`, `form.tsx` e `page.tsx`.
4. **Menu:** adicione o item em `src/components/layout/menu.ts`.

Regras que valem para toda tela:
- Toda página e toda server action chama `requireSession()` (ou `requireAdmin()` para coisas de administrador).
- Toda entrada do usuário é validada com `zod` no servidor antes de gravar.
- Use os componentes de `src/components/ui` e as cores do tema (`bg-surface-2`, `text-muted`, `bg-primaria`...), nunca cores soltas.

## Marca do cliente

Para um cliente com marca própria, troque os valores das variáveis em `src/app/globals.css` (`:root` para o tema escuro e `[data-theme="light"]` para o claro) e o `NEXT_PUBLIC_APP_NAME` no `.env`. Todo o sistema acompanha.

## Publicar no servidor (Coolify)

1. No Coolify, crie um **PostgreSQL** (Resources → New → Database) e copie a URL de conexão interna.
2. Crie uma **Application** apontando para o repositório do GitHub, com build pack **Dockerfile** e porta **3000**.
3. Em Environment Variables, defina:
   - `DATABASE_URL` com a URL do passo 1
   - `BETTER_AUTH_SECRET` (gere com `openssl rand -base64 32`)
   - `BETTER_AUTH_URL` com o domínio do sistema, ex.: `https://sistema.cliente.com.br`
   - `NEXT_PUBLIC_APP_NAME` marcada como *Build Variable*
   - `SMTP_*` para o e-mail de recuperação de senha
4. Configure o domínio e faça o deploy. As migrations rodam sozinhas na subida.
5. Ative os **backups agendados** do banco no Coolify antes de entregar ao cliente.

Para testar a imagem de produção localmente: `docker compose --profile app up --build`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sistema em modo desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm run typecheck` | Checa os tipos do TypeScript |
| `npm run db:up` | Sobe o Postgres local |
| `npm run db:generate` | Gera migration a partir do schema |
| `npm run db:migrate` | Aplica migrations manualmente |
| `npm run db:studio` | Abre o Drizzle Studio para ver o banco |

## Estrutura

```
src/
  app/
    (auth)/        login, recuperação de senha, configuração inicial
    (app)/         telas internas (painel, clientes, usuários) + layout com menu
    api/auth/      rotas do Better Auth
  components/
    layout/        menu, ícones, ações do usuário
    ui/            botão, campos, card, tabela, badge, alerta
  db/
    schema/        tabelas (uma por arquivo)
    migrate.ts     aplica migrations ao iniciar
  lib/             auth, sessão, e-mail, utilitários
drizzle/           migrations geradas (vão no commit)
```

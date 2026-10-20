// Itens do menu lateral. Para uma tela nova, adicione uma linha aqui.
// "permissao" esconde o item de quem não tem acesso (a checagem real é no servidor).
import type { Permissao } from "@/lib/papeis";

export type ItemMenu = {
  href: string;
  rotulo: string;
  icone: "painel" | "ordens" | "programacao" | "terminal" | "cadastros" | "clientes" | "usuarios" | "sistema";
  permissao?: Permissao;
};

export const itensMenu: ItemMenu[] = [
  { href: "/painel", rotulo: "Painel", icone: "painel", permissao: "painel:ver" },
  { href: "/ordens", rotulo: "Ordens de produção", icone: "ordens", permissao: "ordens:editar" },
  { href: "/programacao", rotulo: "Programação (Gantt)", icone: "programacao", permissao: "programacao:editar" },
  { href: "/terminal", rotulo: "Terminal de produção", icone: "terminal", permissao: "execucao:apontar" },
  { href: "/cadastros", rotulo: "Cadastros", icone: "cadastros", permissao: "cadastros:editar" },
  { href: "/clientes", rotulo: "Clientes", icone: "clientes", permissao: "ordens:editar" },
  { href: "/usuarios", rotulo: "Usuários", icone: "usuarios", permissao: "sistema:administrar" },
  { href: "/sistema", rotulo: "Sistema", icone: "sistema", permissao: "sistema:administrar" },
];

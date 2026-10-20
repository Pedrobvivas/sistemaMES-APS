// Itens do menu lateral. Para uma tela nova, adicione uma linha aqui.
// "somenteAdmin" esconde o item de quem não é administrador.
export type ItemMenu = {
  href: string;
  rotulo: string;
  icone: "painel" | "clientes" | "gastos" | "usuarios";
  somenteAdmin?: boolean;
};

export const itensMenu: ItemMenu[] = [
  { href: "/painel", rotulo: "Painel", icone: "painel" },
  { href: "/clientes", rotulo: "Clientes", icone: "clientes" },
  { href: "/gastos", rotulo: "Gastos", icone: "gastos" },
  { href: "/usuarios", rotulo: "Usuários", icone: "usuarios", somenteAdmin: true },
];

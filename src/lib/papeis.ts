// Perfis do protótipo e o que cada um pode fazer.
// A checagem de verdade acontece no servidor (src/lib/session.ts → exigirPermissao).
export const papeis = ["admin", "planejador", "operador"] as const;
export type Papel = (typeof papeis)[number];

export const rotuloPapel: Record<Papel, string> = {
  admin: "Administrador",
  planejador: "Planejador",
  operador: "Operador",
};

export type Permissao =
  | "painel:ver"
  | "cadastros:editar"
  | "ordens:editar"
  | "programacao:editar"
  | "programacao:aprovar"
  | "execucao:apontar"
  | "sistema:administrar";

const matriz: Record<Permissao, Papel[]> = {
  "painel:ver": ["admin", "planejador"],
  "cadastros:editar": ["admin", "planejador"],
  "ordens:editar": ["admin", "planejador"],
  "programacao:editar": ["admin", "planejador"],
  "programacao:aprovar": ["admin", "planejador"],
  "execucao:apontar": ["admin", "operador"],
  "sistema:administrar": ["admin"],
};

// Usuários antigos do projeto-base têm papel "user": tratados com o menor acesso.
export function normalizarPapel(papel: string | null | undefined): Papel {
  return (papeis as readonly string[]).includes(papel ?? "") ? (papel as Papel) : "operador";
}

export function pode(papel: string | null | undefined, permissao: Permissao) {
  return matriz[permissao].includes(normalizarPapel(papel));
}

// Tela inicial de cada perfil.
export function inicioDoPapel(papel: string | null | undefined) {
  return normalizarPapel(papel) === "operador" ? "/terminal" : "/visao-geral";
}

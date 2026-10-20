// Ícones de traço, no padrão da marca (cantos arredondados, espessura uniforme).
const caminhos: Record<string, React.ReactNode> = {
  painel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" />
    </>
  ),
  gastos: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 6V4h10v2" />
      <circle cx="16" cy="15" r="1.5" />
    </>
  ),
  usuarios: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  sair: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </>
  ),
  tema: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  mais: <path d="M12 5v14M5 12h14" />,
};

export function Icone({ nome, tamanho = 20 }: { nome: keyof typeof caminhos | string; tamanho?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {caminhos[nome]}
    </svg>
  );
}

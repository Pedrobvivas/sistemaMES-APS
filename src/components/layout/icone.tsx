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
  ordens: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  programacao: (
    <>
      <path d="M3 4v16h18" />
      <rect x="6" y="6" width="8" height="3" rx="1" />
      <rect x="10" y="11" width="9" height="3" rx="1" />
      <rect x="7" y="16" width="6" height="2" rx="1" />
    </>
  ),
  terminal: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h5" />
      <circle cx="12" cy="17" r="1" />
    </>
  ),
  cadastros: (
    <>
      <path d="M12 3 3 8l9 5 9-5z" />
      <path d="m3 13 9 5 9-5M3 17.5 12 22l9-4.5" />
    </>
  ),
  sistema: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  alfinete: (
    <>
      <path d="M9 4h6l-1 6 3 3H7l3-3z" />
      <path d="M12 13v8" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  iniciar: <path d="M7 4v16l13-8z" />,
  pausar: <path d="M8 4v16M16 4v16" />,
  concluir: <path d="m4 12 5 5L20 6" />,
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
  voltar: <path d="m14 6-6 6 6 6" />,
  avancar: <path d="m10 6 6 6-6 6" />,
  atualizar: (
    <>
      <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
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

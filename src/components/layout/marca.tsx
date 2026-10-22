// Símbolo do Camargo MES (o mesmo do favicon): barras de Gantt em verde e branco.
export function Marca({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg aria-hidden="true" width={tamanho} height={tamanho} viewBox="0 0 32 32" className="shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--preto)" />
      <rect x="6" y="7.5" width="12" height="4.5" rx="2.25" fill="var(--verde)" />
      <rect x="10" y="14" width="16" height="4.5" rx="2.25" fill="var(--branco)" />
      <rect x="6" y="20.5" width="9" height="4.5" rx="2.25" fill="var(--verde)" />
    </svg>
  );
}

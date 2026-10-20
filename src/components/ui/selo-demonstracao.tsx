import { Icone } from "@/components/layout/icone";

// Aviso permanente enquanto os dados vierem da carga de demonstração.
export function SeloDemonstracao() {
  return (
    <p
      role="status"
      className="hidden items-center gap-2 rounded-full border border-alerta/50 px-3 py-1 text-xs font-semibold text-alerta sm:inline-flex"
      title="Os cadastros, ordens e apontamentos exibidos são fictícios, criados para demonstração."
    >
      <Icone nome="info" tamanho={14} />
      Demonstração · dados fictícios
    </p>
  );
}

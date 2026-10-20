import type { CampoConfig } from "@/components/ui/form-cadastro";
import type { OrdemProducao } from "@/db/schema";
import { camposEditaveis } from "@/server/ordens";

// Campos do formulário de OP; o que fica bloqueado depende do status.
export function camposOrdem(
  ordem: OrdemProducao | null,
  opcoes: { produtos: { id: string; codigo: string; nome: string }[]; clientes: { id: string; nome: string }[] },
): CampoConfig[] {
  const pode = ordem ? camposEditaveis(ordem.status) : { produto: true, quantidade: true, demais: true };
  return [
    { nome: "codigo", rotulo: "Código da OP", valor: ordem?.codigo, obrigatorio: true, largura: "metade" },
    { nome: "pedidoVenda", rotulo: "Pedido de venda", valor: ordem?.pedidoVenda, largura: "metade" },
    {
      nome: "produtoId",
      rotulo: "Produto",
      tipo: "select",
      obrigatorio: true,
      desabilitado: !pode.produto,
      ajuda: pode.produto ? undefined : "O produto não muda depois da liberação.",
      valor: ordem?.produtoId,
      opcoes: opcoes.produtos.map((p) => ({ valor: p.id, rotulo: `${p.codigo} · ${p.nome}` })),
    },
    {
      nome: "quantidade",
      rotulo: "Quantidade",
      tipo: "numero",
      min: 1,
      obrigatorio: true,
      desabilitado: !pode.quantidade,
      ajuda: pode.quantidade ? (ordem?.status === "liberada" ? "Os tempos das operações pendentes são recalculados." : undefined) : "Já há apontamentos nesta OP.",
      valor: ordem?.quantidade ?? 1,
      largura: "metade",
    },
    {
      nome: "prioridade",
      rotulo: "Prioridade",
      tipo: "select",
      obrigatorio: true,
      valor: ordem?.prioridade ?? 2,
      largura: "metade",
      opcoes: [
        { valor: "1", rotulo: "Alta" },
        { valor: "2", rotulo: "Normal" },
        { valor: "3", rotulo: "Baixa" },
      ],
    },
    { nome: "prazoEntrega", rotulo: "Data de entrega", tipo: "data", obrigatorio: true, valor: ordem?.prazoEntrega, largura: "metade" },
    {
      nome: "inicioMaisCedo",
      rotulo: "Início mais cedo",
      tipo: "data",
      valor: ordem?.inicioMaisCedo,
      ajuda: "Ex.: data de chegada do material.",
      largura: "metade",
    },
    {
      nome: "clienteId",
      rotulo: "Cliente",
      tipo: "select",
      valor: ordem?.clienteId,
      opcoes: opcoes.clientes.map((c) => ({ valor: c.id, rotulo: c.nome })),
    },
    { nome: "observacoes", rotulo: "Observações", tipo: "area", valor: ordem?.observacoes },
  ];
}
